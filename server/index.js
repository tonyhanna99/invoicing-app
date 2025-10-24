const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { exec } = require('child_process')
const PizZip = require('pizzip')
const Docxtemplater = require('docxtemplater')
const { v4: uuidv4 } = require('uuid')
const { PDFDocument } = require('pdf-lib')

const app = express()

// Enable CORS for all origins in development, specific origin in production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://tetriastech.github.io/invoicing-app' 
    : 'http://localhost:5173',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}))
// This accepts requests with no origin (e.g. curl or native apps) or from localhost dev ports.
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like curl or native apps)
    if (!origin) return callback(null, true)
    // allow any localhost origin (http://localhost:5173, http://localhost:5176, etc.)
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true)
    // otherwise block
    return callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}))
// Enable preflight for all routes
app.options('*', cors())
app.use(express.json({ limit: '50mb' }))

const TEMPLATE_PATH = path.join(__dirname, '..', 'Invoice Template.docx')
const REMAINING_PAGES_PATH = path.join(__dirname, '..', 'Invoice.pdf')

async function mergePDFs(firstPagePath, remainingPagesBuffer) {
  // Load both PDFs
  const firstPagePdf = await PDFDocument.load(fs.readFileSync(firstPagePath))
  const remainingPagesPdf = await PDFDocument.load(remainingPagesBuffer)
  
  // Create a new PDF document
  const mergedPdf = await PDFDocument.create()
  
  // Copy pages from both PDFs
  const [firstPage] = await mergedPdf.copyPages(firstPagePdf, [0])
  const remainingPages = await mergedPdf.copyPages(remainingPagesPdf, remainingPagesPdf.getPageIndices())
  
  // Add pages to new document
  mergedPdf.addPage(firstPage)
  remainingPages.forEach(page => mergedPdf.addPage(page))
  
  // Save the merged PDF
  return await mergedPdf.save()
}

function getSofficeCmd() {
  // allow override
  if (process.env.LIBREOFFICE_PATH) return process.env.LIBREOFFICE_PATH
  return 'soffice'
}

app.post('/generate', async (req, res) => {
  try {
    const { first_name, last_name, invoice_number, issue_date, due_date, amount, payment_method } = req.body

    // Read and fill the DOCX template
    const content = fs.readFileSync(TEMPLATE_PATH)
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

    const data = {
      first_name: first_name || '',
      last_name: last_name || '',
      invoice_number: invoice_number || '',
      issue_date: issue_date || '',
      due_date: due_date || '',
      amount: amount || '',
      payment_method: payment_method || ''
    }

    doc.render(data)
    const buf = doc.getZip().generate({ type: 'nodebuffer' })

    const id = uuidv4()
    const tmpDir = os.tmpdir()
    const tmpDocx = path.join(tmpDir, `invoice-${id}.docx`)
    const outPdf = path.join(tmpDir, `invoice-${id}.pdf`)
    fs.writeFileSync(tmpDocx, buf)

    const soffice = getSofficeCmd()
    const cmd = `${soffice} --headless --convert-to pdf --outdir ${tmpDir} ${tmpDocx}`

    exec(cmd, async (err, stdout, stderr) => {
      if (err) {
        console.error('Conversion failed', err, stderr)
        res.status(500).json({ error: 'Conversion failed', details: stderr || err.message })
        // cleanup
        try { fs.unlinkSync(tmpDocx) } catch(e){}
        return
      }

      // Find the generated first page PDF
      let firstPagePath = outPdf
      if (!fs.existsSync(outPdf)) {
        // LibreOffice may name file differently; try to find in tmpDir
        const files = fs.readdirSync(tmpDir)
        const match = files.find(f => f.startsWith(`invoice-${id}`) && f.endsWith('.pdf'))
        if (!match) {
          res.status(500).json({ error: 'First page PDF not found after conversion' })
          try { fs.unlinkSync(tmpDocx) } catch(e){}
          return
        }
        firstPagePath = path.join(tmpDir, match)
      }

      try {
        // Read both PDFs and merge them
        const firstPagePdf = await PDFDocument.load(fs.readFileSync(firstPagePath))
        const remainingPagesPdf = await PDFDocument.load(fs.readFileSync(REMAINING_PAGES_PATH))
        
        // Create a new PDF document
        const mergedPdf = await PDFDocument.create()
        
        // Copy pages from both PDFs
        const [firstPage] = await mergedPdf.copyPages(firstPagePdf, [0])
        const remainingPages = await mergedPdf.copyPages(remainingPagesPdf, remainingPagesPdf.getPageIndices())
        
        // Add pages to new document
        mergedPdf.addPage(firstPage)
        remainingPages.forEach(page => mergedPdf.addPage(page))
        
        // Save and send the merged PDF
        const mergedPdfBuffer = await mergedPdf.save()

        res.setHeader('Content-Type', 'application/pdf')
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice_number || id}.pdf"`)
        res.send(Buffer.from(mergedPdfBuffer))
      } catch (err) {
        console.error('PDF merge failed:', err)
        res.status(500).json({ error: 'Failed to merge PDFs', details: err.message })
      } finally {
        // Cleanup temporary files
        try { fs.unlinkSync(firstPagePath) } catch(e){}
        try { fs.unlinkSync(tmpDocx) } catch(e){}
      }
    })
  } catch (err) {
    console.error('Template error', err)
    res.status(500).json({ error: 'Template processing failed', details: err.message })
  }
})

const port = process.env.PORT || 4000
const host = '0.0.0.0'
app.listen(port, host, () => {
  console.log(`Server is running on http://${host}:${port}`)
  console.log('Press Ctrl + C to stop the server')
})
