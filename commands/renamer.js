#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const sourceDir = './x2_cleaned';
const targetDir = './x3_renamed';

// Список библиотечных директорий для исключения из переименования
const libraryDirs = [
  'bootstrap',
  'aos',
  'swiper',
  'glightbox',
  'bootstrap-icons',
];

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const classMap = new Map();
const idMap = new Map();
const usedInJs = new Set();
const usedInHtml = new Set();
const usedInCss = new Set();
const excludeFromRenaming = new Set();

function generateRandomName() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function getClassName(cls) {
  if (!classMap.has(cls)) {
    classMap.set(cls, generateRandomName());
  }
  return classMap.get(cls);
}

function getIdName(id) {
  if (!idMap.has(id)) {
    idMap.set(id, generateRandomName());
  }
  return idMap.get(id);
}

function collectJsClassesAndIds(jsContent) {
  const regex = /(['"`])(?:\.|#)([\w-]+)\1/g;
  let match;
  while ((match = regex.exec(jsContent)) !== null) {
    usedInJs.add(match[2]);
  }
}

function collectHtmlClassesAndIds(htmlContent) {
  const $ = cheerio.load(htmlContent);
  $('[class]').each(function () {
    const classes = $(this).attr('class').split(/\s+/);
    classes.forEach(cls => usedInHtml.add(cls));
  });
  $('[id]').each(function () {
    const id = $(this).attr('id');
    if (id) usedInHtml.add(id);
  });
}

function collectCssClassesAndIds(cssContent) {
  const classRegex = /\.([\w-]+)(?![^\{]*\})/g;
  const idRegex = /#([\w-]+)/g;
  let match;
  while ((match = classRegex.exec(cssContent)) !== null) {
    usedInCss.add(match[1]);
  }
  while ((match = idRegex.exec(cssContent)) !== null) {
    usedInCss.add(match[1]);
  }
}

function processHtml(htmlContent) {
  const $ = cheerio.load(htmlContent);
  $('[class]').each(function () {
    const classes = $(this).attr('class').split(/\s+/);
    const modifiedClasses = classes.map(cls =>
      excludeFromRenaming.has(cls) ? cls : getClassName(cls)
    );
    $(this).attr('class', modifiedClasses.join(' '));
  });
  $('[id]').each(function () {
    const id = $(this).attr('id');
    const modifiedId = excludeFromRenaming.has(id) ? id : getIdName(id);
    $(this).attr('id', modifiedId);
  });
  return $.html();
}

function processCss(cssContent) {
  const classSelectorRegex = /\.([\w-]+)(?![^\{]*\})/g;
  const idSelectorRegex = /#([\w-]+)/g;
  return cssContent
    .replace(classSelectorRegex, (match, p1) =>
      excludeFromRenaming.has(p1) ? `.${p1}` : `.${getClassName(p1)}`
    )
    .replace(idSelectorRegex, (match, p1) =>
      excludeFromRenaming.has(p1) ? `#${p1}` : `#${getIdName(p1)}`
    );
}

function processJs(jsContent) {
  collectJsClassesAndIds(jsContent);
  return jsContent;
}

function shouldExclude(filePath) {
  return libraryDirs.some(dir => filePath.includes(dir));
}

function processFile(filePath, isFirstPass) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.js')) {
    return processJs(fileContent);
  } else if (filePath.endsWith('.html')) {
    if (isFirstPass) {
      collectHtmlClassesAndIds(fileContent);
    }
    return processHtml(fileContent);
  } else if (filePath.endsWith('.css')) {
    if (isFirstPass) {
      collectCssClassesAndIds(fileContent);
    }
    return processCss(fileContent);
  }
  return fileContent;
}

function processDirectory(directory, isFirstPass) {
  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file);
    const targetPath = path.join(targetDir, path.relative(sourceDir, fullPath));
    const stat = fs.statSync(fullPath);
    if (stat.isFile() && !shouldExclude(fullPath)) {
      const modifiedContent = processFile(fullPath, isFirstPass);
      if (!fs.existsSync(path.dirname(targetPath))) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      }
      if (!isFirstPass) {
        fs.writeFileSync(targetPath, modifiedContent);
      }
    } else if (stat.isDirectory()) {
      processDirectory(fullPath, isFirstPass);
    }
  });
}

// First pass to collect classes and IDs used in JS, HTML, and CSS files
processDirectory(sourceDir, true);

// Determine elements that should not be renamed
usedInJs.forEach(item => {
  if (usedInHtml.has(item) || usedInCss.has(item)) {
    excludeFromRenaming.add(item);
  }
});
usedInHtml.forEach(item => {
  if (usedInJs.has(item) || usedInCss.has(item)) {
    excludeFromRenaming.add(item);
  }
});
usedInCss.forEach(item => {
  if (usedInJs.has(item) || usedInHtml.has(item)) {
    excludeFromRenaming.add(item);
  }
});

// Second pass to process HTML and CSS files with renaming
processDirectory(sourceDir, false);
