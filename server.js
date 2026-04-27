const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 3000;

// Increase limit to handle potentially large HTML/CSS payloads
app.use(express.json({ limit: '10mb' }));

app.post('/render', async (req, res) => {
  let browser;
  try {
    const { viewport, html, css } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'The "html" field is required' });
    }

    const width = viewport?.width || 1200;
    const height = viewport?.height || 630;

    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // Use the executable path provided by the docker image environment variable, or fallback
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

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

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});