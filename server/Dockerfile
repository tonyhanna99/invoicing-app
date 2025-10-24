FROM node:18-slim

# Install LibreOffice
RUN apt-get update && \
    apt-get install -y libreoffice && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all server files (including templates)
COPY . .

# Expose port
EXPOSE 10000

# Start the application
CMD ["node", "index.js"]