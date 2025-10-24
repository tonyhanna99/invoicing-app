# Trinity Invoice Generator

A professional invoice generation system that combines the power of DOCX templates with PDF merging capabilities. Built as a Progressive Web App (PWA) for easy access on any device.

![Trinity Logo](TrinityLogo.png)

## Features

- 🖋 Fill in customer details through a user-friendly form
- 📄 Generate first page from customizable DOCX template
- 📑 Automatically merge with existing PDF pages
- 🔢 Auto-incrementing invoice numbers
- 📱 PWA support for mobile and desktop
- 💼 Professional formatting preserved

## Setup

### Prerequisites

1. Node.js and npm installed
2. LibreOffice installed for DOCX to PDF conversion

```bash
# On macOS with Homebrew
brew install --cask libreoffice
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/andrewgindi/invoicing-app.git
cd invoicing-app
```

2. Install dependencies for both frontend and backend
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Running the Application

1. Start the backend server (in one terminal)
```bash
cd server
npm start
```

2. Start the frontend development server (in another terminal)
```bash
npm run dev
```

3. Open your browser and navigate to the URL shown in the terminal (typically http://localhost:5173)

## Usage

1. Fill in the customer details:
   - First and Last Name
   - Issue and Due Date
   - Amount

2. Click "Generate PDF" to create the invoice

3. The generated PDF will automatically download, combining your customized first page with the standard remaining pages

## Technical Details

The application uses:
- Frontend: React + Vite
- Backend: Express.js
- DOCX templating: docxtemplater
- PDF processing: pdf-lib
- Format conversion: LibreOffice

### Files Structure
- `Invoice Template.docx` - Template for the first page with variables
- `Invoice.pdf` - Static PDF containing the remaining pages
- `src/` - Frontend React application
- `server/` - Backend Express server

### Environment Variables
- `LIBREOFFICE_PATH` - Optional. Override the default LibreOffice command
- `PORT` - Optional. Override the default backend port (4000)

The server will listen on http://localhost:4000 by default. The client app tries to POST to `http://localhost:4000/generate` to request a filled PDF. If the server is not available the app falls back to a best-effort HTML render in the browser (less exact formatting).

Security note: The server runs locally and uses the template file `Invoice Template.docx` found in the repository root. For production, secure the endpoint and sanitize inputs appropriately.
# invoicing-app