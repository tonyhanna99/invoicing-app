import React, { useState, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'

const COUNTER_KEY = 'invoice_counter_v1'

function getNextInvoiceNumber() {
  const raw = localStorage.getItem(COUNTER_KEY)
  const n = raw ? parseInt(raw, 10) : 0
  return n + 1
}

function incrementInvoiceNumber() {
  const raw = localStorage.getItem(COUNTER_KEY)
  const n = raw ? parseInt(raw, 10) : 0
  localStorage.setItem(COUNTER_KEY, String(n + 1))
}

function formatDateToDDMMYYYY(dateString) {
  const date = new Date(dateString)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

// Helper function to get today's date in local timezone (YYYY-MM-DD format)
function getTodayLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function App() {
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState(() => getNextInvoiceNumber())
  const [message, setMessage] = useState('')
  const [issueDate, setIssueDate] = useState(() => getTodayLocalDate())
  const [dueDate, setDueDate] = useState(() => getTodayLocalDate())
  const [amount, setAmount] = useState('660')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [errors, setErrors] = useState({})

  // keep due date in sync to issue date by default
  useEffect(() => {
    setDueDate(issueDate)
  }, [issueDate])

  const handleGenerate = async (e) => {
    e.preventDefault()
    
    // Clear previous errors
    setErrors({})
    setMessage('')
    
    // Validate required fields
    const newErrors = {}
    if (!customerName.trim()) {
      newErrors.customerName = 'Customer name is required'
    }
    if (!address.trim()) {
      newErrors.address = 'Address is required'
    }
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required'
    }
    
    // If there are errors, show them and don't proceed
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    
    setIsLoading(true)
    setLoadingStep('Loading PDF template...')
    setMessage('')

    try {
      // Load the PDF template
      const templateUrl = import.meta.env.BASE_URL + 'Fillable Invoice Template.pdf'
      const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer())
      
      setLoadingStep('Filling form fields...')
      
      // Load the PDF with pdf-lib
      const pdfDoc = await PDFDocument.load(existingPdfBytes)
      const form = pdfDoc.getForm()
      
      // Fill the form fields
      const clientName = customerName.trim()
      const invoiceNum = String(invoiceNumber).padStart(5, '0')
      
      // Get and fill the form fields
      try {
        const clientNameField = form.getTextField('client_name')
        clientNameField.setText(clientName)
      } catch (e) {
        console.warn('client_name field not found:', e)
      }
      
      try {
        const invoiceNumberField = form.getTextField('invoice_number')
        invoiceNumberField.setText(invoiceNum)
      } catch (e) {
        console.warn('invoice_number field not found:', e)
      }
      
      try {
        const issueDateField = form.getTextField('issue_date')
        issueDateField.setText(formatDateToDDMMYYYY(issueDate))
      } catch (e) {
        console.warn('issue_date field not found:', e)
      }
      
      try {
        const dueDateField = form.getTextField('due_date')
        dueDateField.setText(formatDateToDDMMYYYY(dueDate))
      } catch (e) {
        console.warn('due_date field not found:', e)
      }
      
      try {
        const addressField = form.getTextField('address')
        addressField.setText(address)
      } catch (e) {
        console.warn('address field not found:', e)
      }
      
      try {
        const amountField = form.getTextField('amount')
        amountField.setText(`$${amount}`)
      } catch (e) {
        console.warn('amount field not found:', e)
      }
      
      try {
        const totalGstField = form.getTextField('total_gst')
        totalGstField.setText(`$${amount}`)
      } catch (e) {
        console.warn('total_gst field not found:', e)
      }
      
      try {
        const totalDueField = form.getTextField('total_due')
        totalDueField.setText(`$${amount}`)
      } catch (e) {
        console.warn('total_due field not found:', e)
      }
      
      // Flatten the form to make fields non-editable
      form.flatten()
      
      setLoadingStep('Generating PDF...')
      
      // Serialize the PDF
      const pdfBytes = await pdfDoc.save()
      
      // Download the filled PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoiceNum}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      
      // Update state
      incrementInvoiceNumber()
      setInvoiceNumber(getNextInvoiceNumber())
      setMessage(`Generated invoice-${invoiceNum}.pdf`)
      setIsLoading(false)
      setLoadingStep('')
      
    } catch (error) {
      console.error('Error filling PDF:', error)
      setMessage('Error generating PDF: ' + error.message)
      setIsLoading(false)
      setLoadingStep('')
    }
  }

  return (
    <div className="app">
      <div className="card">
        <img src={import.meta.env.BASE_URL + 'TrinityLogo.png'} alt="Trinity Logo" className="logo" />
        <div className="meta">
          <div>
            <h1>Invoice Generator</h1>
            <div className="muted">Create professional invoices instantly</div>
          </div>
          <div className="muted" style={{textAlign: 'right'}}>
            <div>Invoice #</div>
            <div style={{fontSize: '1.2em', fontWeight: 500}}>{String(invoiceNumber).padStart(5,'0')}</div>
          </div>
        </div>

        <form onSubmit={handleGenerate}>
          <div className="form-row">
            <label className="field-label">
              Customer Name
              <input 
                placeholder="Enter customer name" 
                value={customerName} 
                onChange={(e) => {
                  setCustomerName(e.target.value)
                  if (errors.customerName) {
                    setErrors(prev => ({ ...prev, customerName: '' }))
                  }
                }}
                className={errors.customerName ? 'error' : ''}
              />
              {errors.customerName && <span className="error-message">{errors.customerName}</span>}
            </label>
          </div>

          <div className="form-row">
            <label className="field-label">
              Address
              <input 
                placeholder="Enter customer address" 
                value={address} 
                onChange={(e) => {
                  setAddress(e.target.value)
                  if (errors.address) {
                    setErrors(prev => ({ ...prev, address: '' }))
                  }
                }}
                className={errors.address ? 'error' : ''}
              />
              {errors.address && <span className="error-message">{errors.address}</span>}
            </label>
          </div>

          <div className="form-row">
            <label className="date-label">
              Issue Date
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </label>
            <label className="date-label">
              Due Date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
          </div>

          <div className="form-row">
            <label className="amount-label">
              Amount
              <input 
                type="text" 
                value={amount} 
                onChange={(e) => {
                  setAmount(e.target.value)
                  if (errors.amount) {
                    setErrors(prev => ({ ...prev, amount: '' }))
                  }
                }}
                className={errors.amount ? 'error' : ''}
              />
              {errors.amount && <span className="error-message">{errors.amount}</span>}
            </label>
          </div>

          <div className="form-row" style={{justifyContent:'flex-end'}}>
            <button className="btn" type="submit" disabled={isLoading}>
              {isLoading ? (
                <span style={{display:'flex',alignItems:'center',flexDirection:'column',gap:4}}>
                  <span style={{display:'flex',alignItems:'center',gap:8}}>
                    <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" />
                    </svg>
                    Generating...
                  </span>
                  {loadingStep && (
                    <span style={{fontSize:'0.85em',opacity:0.9}}>{loadingStep}</span>
                  )}
                </span>
              ) : (
                'Generate Invoice'
              )}
            </button>
          </div>
        </form>

        {message && (
          <div className="message-box">
            <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            <span>{message}</span>
          </div>
        )}
      </div>
    </div>
  )
}
