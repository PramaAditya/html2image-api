# HTML to Image API

A Dockerized microservice REST API that uses Node.js, Express, and Puppeteer to render HTML and CSS inputs into an image (PNG).

## Prerequisites

- Docker
- Docker Compose

## Getting Started

1. Clone or download this repository.
2. Build and run the container:

```bash
docker-compose up --build -d
```

The service will be available at `http://localhost:3000`.

## API Usage

### `POST /render`

Accepts a JSON payload and returns a binary PNG image.

**Request Payload:**

- `html` (string, required): The HTML content to render.
- `css` (string, optional): CSS styles to apply.
- `viewport` (object, optional): Define the dimensions of the rendered image. Defaults to 1200x630.
  - `width` (number)
  - `height` (number)

**Example cURL Request:**

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{
    "viewport": { "width": 800, "height": 600 },
    "html": "<h1>Hello from Puppeteer!</h1><p style=\"font-family: '\''Roboto'\'', sans-serif;\">This supports Google Fonts as well.</p>",
    "css": "@import url('\''https://fonts.googleapis.com/css2?family=Roboto&display=swap'\''); body { background-color: #f0f0f0; display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; } h1 { color: #ff5722; }"
  }' \
  --output result.png
```

This will save the generated image as `result.png` in your current directory. The API uses `networkidle0` to ensure that external resources like Google Fonts are fully loaded before capturing the screenshot.

### `POST /render-template`

Accepts a JSON payload indicating a pre-defined Handlebars HTML template, injects data into it, and returns a binary PNG image. This is ideal for reusable designs.

**Request Payload:**

- `template` (string, required): The filename of the template (without `.html`) located in the `templates/` folder.
- `params` (object, required): The data payload to inject into the template variables.
- `viewport` (object, optional): Define the dimensions of the rendered image. Defaults depend on the template logic (usually 1080x1350 for portrait templates).

**Available Templates:**

#### `carousel_news_1_cover`
A 4:5 portrait (1080x1350) news layout with a top cover image and dynamic text fitting at the bottom.
**Params:**
- `image_url` (string): Absolute URL to the cover image.
- `title` (string): Title text (supports Markdown).
- `subtitle` (string, optional): Subtitle text (supports Markdown).
- `date` (string, optional): Display date. Defaults to current date in `Asia/Jakarta` timezone.
- `source` (string, optional): News source attribution.
- `my_handle` (string, optional): Social handle string. Defaults to `@poros.perjuangan`.

**Example cURL Request:**

```bash
curl -X POST http://localhost:3000/render-template \
  -H "Content-Type: application/json" \
  -d '{
    "template": "carousel_news_1_cover",
    "params": {
      "image_url": "https://images.unsplash.com/photo-1590424744257-fdb03ed78be0?auto=format&fit=crop&w=1080&q=80",
      "title": "Alarm Keamanan Israel: **Pergerakan Militer Mesir** di Dekat Gaza Picu Tuduhan.",
      "source": "t.Al-mehwar"
    }
  }' \
  --output template_result.png
```

## Adding New Templates

You can easily create new templates without rebuilding the Docker container. 
1. Create a new `.html` file inside the `templates/` directory (e.g., `templates/my_custom_layout.html`).
2. Use standard HTML, CSS (via `<style>`), and [Handlebars](https://handlebarsjs.com/) syntax (`{{variable}}` or `{{{html_variable}}}`) for your variables.
3. You can utilize external libraries like `textFit.js` or Google Fonts via CDN directly in the template's `<head>`. 
4. Call `POST /render-template` with `"template": "my_custom_layout"` and provide your custom parameters.