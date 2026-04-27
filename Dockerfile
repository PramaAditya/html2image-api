# Use the official Puppeteer image which includes Chromium and its dependencies
FROM ghcr.io/puppeteer/puppeteer:22.10.0

# Set environment variables to tell Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# The puppeteer image runs as user "pptruser". 
# We need to copy files and set ownership appropriately.
COPY --chown=pptruser:pptruser package*.json ./

RUN npm install

COPY --chown=pptruser:pptruser . .

EXPOSE 3000

CMD ["npm", "start"]