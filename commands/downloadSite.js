const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const { URL } = require('url');

const visitedUrls = new Set();
const baseDir = path.resolve('templink'); // Место сохранения скачанных файлов

function getFullUrl(currentUrl, relativeUrl) {
  if (relativeUrl.startsWith('http') || relativeUrl.startsWith('//')) {
    return relativeUrl;
  }
  const url = new URL(relativeUrl, currentUrl);
  return url.href;
}

async function download(resourceUrl, basePath) {
  if (
    visitedUrls.has(resourceUrl) ||
    resourceUrl.startsWith('javascript:') ||
    resourceUrl.startsWith('mailto:') ||
    resourceUrl.startsWith('tel:')
  )
    return;
  visitedUrls.add(resourceUrl);

  try {
    const response = await axios.get(resourceUrl, {
      responseType: 'arraybuffer',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
      },
    });
    await fs.ensureDir(path.dirname(basePath));
    await fs.writeFile(basePath, response.data);

    if (basePath.endsWith('.html')) {
      const $ = cheerio.load(response.data);
      $('a, link[rel="stylesheet"], img, script[src]').each((_, element) => {
        const href = $(element).attr('href') || $(element).attr('src');
        if (
          href &&
          !href.startsWith('mailto:') &&
          !href.startsWith('tel:') &&
          !href.startsWith('javascript:')
        ) {
          const fullUrl = getFullUrl(resourceUrl, href);
          const resourcePath = new URL(fullUrl).pathname;
          let localPath = path.join(
            baseDir,
            resourcePath.replace(/^\/|\/$/g, '')
          );

          if (!localPath.endsWith('.html') && !path.extname(localPath)) {
            localPath += '/index.html'; // Добавляем index.html к путям директорий
          }

          if (!visitedUrls.has(fullUrl)) {
            download(fullUrl, localPath).catch(console.error);
          }
        }
      });
    }
  } catch (error) {
    console.error(`Error downloading ${resourceUrl}: ${error.message}`);
  }
}

const args = process.argv.slice(2);
const siteUrl = args[0];
if (!siteUrl) {
  console.error('Please provide a URL as an argument');
  process.exit(1);
}

download(
  siteUrl,
  path.join(
    baseDir,
    new URL(siteUrl).pathname.replace(/^\/|\/$/g, ''),
    'index.html'
  )
).catch(console.error);
