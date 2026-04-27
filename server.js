const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const moment = require('moment-timezone');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

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
    `;

    await page.setContent(fullHtml, {
      waitUntil: ['networkidle0', 'load', 'domcontentloaded']
    });

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

    const htmlContent = compiledTemplate(templateParams);

    const width = parseInt(viewport?.width, 10) || 1080;
    const height = parseInt(viewport?.height, 10) || 1350;

    browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    await page.setContent(htmlContent, {
      waitUntil: ['networkidle0', 'load', 'domcontentloaded']
    });

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
