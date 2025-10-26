# Trinity Invoice Generator

A professional invoice generation system that fills PDF form fields directly in the browser. Built as a modern web application for easy access on any device.

![Trinity Logo](public/TrinityLogo.png)

## Features

- 🖋 Fill in customer details through a user-friendly form
- 📄 Fill PDF form fields directly in the browser using pdf-lib
- 🔢 Auto-incrementing invoice numbers with Firebase Firestore sync
- � Fully client-side - no server required
- 📱 Responsive design for mobile and desktop
- 🎨 Professional modern UI with loading states
- 🌏 Local timezone support (Sydney AEDT)

## Setup

### Prerequisites

- Node.js and npm installed

### Installation

1. Clone the repository
```bash
git clone https://github.com/TetriasTech/invoicing-app.git
cd invoicing-app
```

2. Install dependencies
```bash
npm install
```

### Running the Application

1. Start the development server
```bash
npm run dev
```

2. Open your browser and navigate to the URL shown in the terminal (typically http://localhost:5173)

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory and can be deployed to any static hosting service.

## Usage

1. Fill in the customer details:
   - First and Last Name
   - Address
   - Issue and Due Date (defaults to today in Sydney timezone)
   - Amount

2. Click "Generate Invoice" to create the invoice

3. The generated PDF will automatically download with a filename like `invoice-00001.pdf`

## Technical Details

The application uses:
- **Frontend**: React + Vite
- **Database**: Firebase Firestore (cloud database with offline fallback)
- **PDF Processing**: pdf-lib (client-side PDF form filling)
- **Styling**: Modern CSS with CSS custom properties
- **State Management**: React hooks with Firebase Firestore for invoice counter
- **Deployment**: GitHub Pages with automated CI/CD

### Files Structure
- `public/Fillable Invoice Template.pdf` - PDF template with form fields
- `public/TrinityLogo.png` - Company logo
- `src/App.jsx` - Main application component
- `src/styles.css` - Application styles
- `src/main.jsx` - React entry point

### Form Fields in PDF Template
The application expects these form field names in the PDF template:
- `client_name` - Customer full name
- `invoice_number` - Auto-generated invoice number
- `issue_date` - Issue date (DD-MM-YYYY format)
- `due_date` - Due date (DD-MM-YYYY format)
- `address` - Customer address
- `amount` - Invoice amount with $ prefix
- `total_gst` - Same as amount
- `total_due` - Same as amount

## Deployment

The app is automatically deployed to GitHub Pages on push to main branch via GitHub Actions.
# invoicing-app