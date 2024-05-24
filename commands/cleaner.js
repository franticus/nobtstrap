#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const projectRoot = process.cwd();

const sourceDir = path.join(projectRoot, 'x1_original');
const targetDir = path.join(projectRoot, 'x2_cleaned');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

function cleanHtmlAttributes(htmlContent) {
  const $ = cheerio.load(htmlContent);

  // Remove div with id="preloader"
  $('#preloader').remove();
  $('.social').remove();

  $('*').each(function () {
    $(this).removeAttr('srcset');
    $(this).removeAttr('style');
    $(this).removeAttr('sizes');
    $(this).removeAttr('loading');
    $(this).removeAttr('data-name');
    $(this).removeAttr('role');
    $(this).removeAttr('aria-label');
    $(this).removeAttr('data-w-id');
    $(this).removeAttr('data-aos');
    $(this).removeAttr('data-aos-delay');
    $(this).removeAttr('data-aos-duration');
    $(this).removeAttr('data-aos-easing');
    $(this).removeAttr('data-aos-once');
    $(this).removeAttr('data-aos-anchor-placement');

    const classes = $(this).attr('class');
    if (classes) {
      const newClasses = classes
        .split(/\s+/)
        .filter(cls => !cls.startsWith('aos-'))
        .join(' ');
      if (newClasses) {
        $(this).attr('class', newClasses);
      } else {
        $(this).removeAttr('class');
      }
    }

    if ($(this).attr('alt')) {
      $(this).attr('alt', 'image');
    }
    if ($(this).is('span')) {
      $(this).replaceWith($(this).html());
    }
    $('[data-node-type="commerce-cart-wrapper"]').remove();
    $('[data-open-product=""]').remove();
    $('[data-wf-cart-type="rightSidebar"]').remove();
    // $('script').remove();
  });

  return $.html();
}

function cleanCssContent(cssContent) {
  cssContent = cssContent.replace(/@font-face\s*{[^}]*}/g, '');
  cssContent = cssContent.replace(/font-family:[^;]+;/g, '');
  return cssContent;
}

function processFile(filePath, targetPath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  let modifiedContent;
  if (filePath.endsWith('.html')) {
    modifiedContent = cleanHtmlAttributes(fileContent);
  } else if (filePath.endsWith('.css')) {
    modifiedContent = cleanCssContent(fileContent);
  } else {
    fs.copyFileSync(filePath, targetPath);
    return;
  }
  fs.writeFileSync(targetPath, modifiedContent);
}

function processDirectory(source, target) {
  fs.readdirSync(source).forEach(file => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    const stat = fs.statSync(sourcePath);
    if (stat.isDirectory()) {
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath);
      }
      processDirectory(sourcePath, targetPath);
    } else if (stat.isFile()) {
      processFile(sourcePath, targetPath);
    }
  });
}

processDirectory(sourceDir, targetDir);
