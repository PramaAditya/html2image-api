const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const moment = require('moment-timezone');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID: uuidv4 } = require('crypto');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
});

// Helper to launch puppeteer
async function getBrowser() {
  return await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
  });
}

// 1. Original /render endpoint
app.post('/render', async (req, res) => {
  let browser;
  try {
    const { viewport, html, css } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'The "html" field is required' });
    }

    const width = parseInt(viewport?.width, 10) || 1200;
    const height = parseInt(viewport?.height, 10) || 630;

    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    const pendingRequests = new Set();
    page.on('request', request => pendingRequests.add(request.url()));
    page.on('requestfinished', request => pendingRequests.delete(request.url()));
    page.on('requestfailed', request => pendingRequests.delete(request.url()));

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 0; }
          ${css || ''}
        </style>
      </head>
      <body>
        <main>
          ${html}
        </main>
      </body>
      </html>
    `.replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/textfit\/2\.4\.0\/textFit\.min\.js/g, `http://localhost:${port}/textFit.min.js`);

    try {
      await page.setContent(fullHtml, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: 15000
      });
    } catch (e) {
      console.warn('Timeout waiting for networkidle0, proceeding with screenshot anyway.');
      console.warn('Pending requests:', Array.from(pendingRequests));
    }

    const imageBuffer = await page.screenshot({ type: 'png' });

    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Rendering error:', error);
    res.status(500).json({ error: 'Failed to render image', details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// 2. New /render-template endpoint
app.post('/render-template', async (req, res) => {
  let browser;
  try {
    const { template, params, viewport } = req.body;
    
    if (!template) {
      return res.status(400).json({ error: 'The "template" field is required' });
    }

    const templatePath = path.join(__dirname, 'templates', `${template}.html`);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: `Template "${template}" not found.` });
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(templateSource);

    // Prepare params
    const templateParams = { ...params };
    
    // Process Markdown for title and subtitle using dynamic import for the ESM module
    const { marked } = await import('marked');
    
    if (templateParams.title) {
      templateParams.title = marked.parseInline(templateParams.title);
    }
    if (templateParams.subtitle) {
      templateParams.subtitle = marked.parseInline(templateParams.subtitle);
    }

    // Default Date
    if (!templateParams.date) {
      // e.g. Senin, 27/04/2026
      moment.locale('id'); // Attempt Indonesian locale if available, else fallback
      templateParams.date = moment().tz('Asia/Jakarta').format('dddd, DD/MM/YYYY');
    }

    // Default Handle
    if (!templateParams.my_handle) {
      templateParams.my_handle = '@poros.perjuangan';
    }

    const htmlContent = compiledTemplate(templateParams)
      .replace(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/textfit\/2\.4\.0\/textFit\.min\.js/g, `http://localhost:${port}/textFit.min.js`);

    const width = parseInt(viewport?.width, 10) || 1080;
    const height = parseInt(viewport?.height, 10) || 1350;

    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    const pendingRequests = new Set();
    page.on('request', request => pendingRequests.add(request.url()));
    page.on('requestfinished', request => pendingRequests.delete(request.url()));
    page.on('requestfailed', request => pendingRequests.delete(request.url()));

    try {
      await page.setContent(htmlContent, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: 15000
      });
    } catch (e) {
      console.warn('Timeout waiting for networkidle0, proceeding with screenshot anyway.');
      console.warn('Pending requests:', Array.from(pendingRequests));
    }

    const imageBuffer = await page.screenshot({ type: 'png' });

    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Template Rendering error:', error);
    res.status(500).json({ error: 'Failed to render template', details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// Helper to render HTML to image buffer
async function renderHtmlToBuffer(htmlContent, width, height) {
  const browser = await getBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    const pendingRequests = new Set();
    page.on('request', request => pendingRequests.add(request.url()));
    page.on('requestfinished', request => pendingRequests.delete(request.url()));
    page.on('requestfailed', request => pendingRequests.delete(request.url()));

    try {
      await page.setContent(htmlContent, {
        waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
        timeout: 15000
      });
    } catch (e) {
      console.warn('Timeout waiting for networkidle0, proceeding with screenshot anyway.');
    }

    const imageBuffer = await page.screenshot({ type: 'png' });
    return imageBuffer;
  } finally {
    await browser.close();
  }
}

// Helper to upload buffer to S3
async function uploadToS3(buffer, filename) {
  const rootFolder = process.env.S3_ROOT_FOLDER ? `${process.env.S3_ROOT_FOLDER}/` : '';
  const key = `${rootFolder}${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/png',
  });

  await s3Client.send(command);
  
  if (process.env.S3_PUBLIC_URL_BASE) {
    // If a public URL base is provided, assume it maps directly to the bucket root
    // e.g. CDN or custom domain
    return `${process.env.S3_PUBLIC_URL_BASE}/${key}`;
  }
  
  // Fallback to endpoint + bucket name for standard path-style S3 URLs
  return `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${key}`;
}

// 3. New /render-template-multiple endpoint for Interval
app.post('/render-template-multiple', async (req, res) => {
  try {
    const { logo, cover_image, title, slides } = req.body;

    if (!title || !slides || !Array.isArray(slides)) {
      return res.status(400).json({ error: 'title and slides array are required' });
    }

    const viewport = { width: 1080, height: 1350 };
    const imageUrls = [];

    // Helper function to compile template
    const compileTemplate = (templateName) => {
      const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
      let templateSource = fs.readFileSync(templatePath);
      
      // Check for UTF-16 LE BOM
      if (templateSource.length >= 2 && templateSource[0] === 0xff && templateSource[1] === 0xfe) {
        templateSource = templateSource.toString('utf16le');
      } else {
        templateSource = templateSource.toString('utf8');
      }
      
      return Handlebars.compile(templateSource);
    };

    const coverTemplate = compileTemplate('interval_cover');
    const slideTemplate = compileTemplate('interval_slide');

    // Process Markdown for title using dynamic import for the ESM module
    const { marked } = await import('marked');
    const parsedTitle = marked.parseInline(title);

    // 1. Render Cover
    const coverHtml = coverTemplate({ logo: logo || 'interval', cover_image, title: parsedTitle });
    const coverBuffer = await renderHtmlToBuffer(coverHtml, viewport.width, viewport.height);
    const coverFilename = `interval-cover-${uuidv4()}.png`;
    const coverUrl = await uploadToS3(coverBuffer, coverFilename);
    imageUrls.push(coverUrl);

    // Helper for Roman numerals
    const toRoman = (num) => {
      const roman = {
        M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
      };
      let str = '';
      for (let i of Object.keys(roman)) {
        let q = Math.floor(num / roman[i]);
        num -= q * roman[i];
        str += i.repeat(q);
      }
      return str;
    };

    // 2. Render Slides
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const romanNumber = toRoman(i + 1);
      
      const parsedText = marked.parse(slide.text);

      const slideHtml = slideTemplate({ roman_number: romanNumber, text: parsedText });
      const slideBuffer = await renderHtmlToBuffer(slideHtml, viewport.width, viewport.height);
      const slideFilename = `interval-slide-${i+1}-${uuidv4()}.png`;
      const slideUrl = await uploadToS3(slideBuffer, slideFilename);
      imageUrls.push(slideUrl);
    }

    res.json({ urls: imageUrls });
  } catch (error) {
    console.error('Render Template Multiple error:', error);
    res.status(500).json({ error: 'Failed to render multiple templates', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
