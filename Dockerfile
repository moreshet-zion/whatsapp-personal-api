# Optional Dockerfile (not needed with current Nixpacks setup)
# Only use this if you specifically want Docker deployment

FROM node:18-slim

# Install minimal dependencies for Puppeteer's bundled Chromium
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Let Puppeteer download and use its bundled Chromium for better compatibility
# No PUPPETEER_EXECUTABLE_PATH or PUPPETEER_SKIP_CHROMIUM_DOWNLOAD

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
