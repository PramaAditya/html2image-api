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