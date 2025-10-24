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

// Enable CORS - allow GitHub Pages in production and localhost in development
app.use(cors({
  origin: function (origin, callback) {
    // Always allow requests with no origin (curl, mobile, etc.)
    if (!origin) return callback(null, true)
    // Always allow GitHub Pages
    if (origin === 'https://tetriastech.github.io') return callback(null, true)
    // Always allow localhost for dev
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true)
    // Block everything else
    return callback(new Error('Not allowed by CORS'))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}))

// Enable preflight for all routes
app.options('*', cors())
app.use(express.json({ limit: '50mb' }))

const TEMPLATE_PATH = path.join(__dirname, 'Invoice Template.docx')
const REMAINING_PAGES_PATH = path.join(__dirname, 'Invoice.pdf')

// Cache template and remaining pages in memory to avoid repeated file reads
let templateCache = null
let remainingPagesCache = null

function loadTemplate() {
  if (!templateCache) {
    templateCache = fs.readFileSync(TEMPLATE_PATH)
    console.log('Template loaded into cache')
  }
  return templateCache
}

function loadRemainingPages() {
  if (!remainingPagesCache) {
    remainingPagesCache = fs.readFileSync(REMAINING_PAGES_PATH)
    console.log('Remaining pages loaded into cache')
  }
  return remainingPagesCache
}

// Health check endpoint to keep server warm
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Invoice generator server is running' })
})

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() })
})

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
    const { first_name, last_name, address, invoice_number, issue_date, due_date, amount, payment_method } = req.body

    // Use cached template instead of reading from disk every time
    const content = loadTemplate()
    const zip = new PizZip(content)
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

    const data = {
      first_name: first_name || '',
      last_name: last_name || '',
      address: address || '',
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
        // Use cached remaining pages instead of reading from disk every time
        const firstPagePdf = await PDFDocument.load(fs.readFileSync(firstPagePath))
        const remainingPagesPdf = await PDFDocument.load(loadRemainingPages())
        
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

const port = process.env.PORT || 10000

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`)
  
  // Preload template and remaining pages into memory on startup
  try {
    loadTemplate()
    loadRemainingPages()
    console.log('Templates preloaded successfully')
  } catch (err) {
    console.error('Failed to preload templates:', err)
  }
})
