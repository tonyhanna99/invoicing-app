FROM node:18-slim

# Install LibreOffice
RUN apt-get update && \
    apt-get install -y libreoffice && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy template files from root directory to container root
COPY Invoice\ Template.docx /Invoice\ Template.docx
COPY Invoice.pdf /Invoice.pdf

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy server code
COPY server/ .

# Expose port
EXPOSE 10000

# Start the application
CMD ["node", "index.js"]