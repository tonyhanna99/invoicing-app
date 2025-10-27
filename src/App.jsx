import React, { useState, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'
import { db } from './firebase'
import { doc, runTransaction, getDoc } from 'firebase/firestore'

async function getNextInvoiceNumber() {
  try {
    const counterRef = doc(db, 'invoicing', 'settings')
    const counterDoc = await getDoc(counterRef)
    
    if (counterDoc.exists()) {
      const data = counterDoc.data()
      return (data.invoice_counter || 0) + 1
    } else {
      return 1 // First invoice
    }
  } catch (error) {
    console.error('Error getting invoice number:', error)
    // Fallback to localStorage if Firebase fails
    const raw = localStorage.getItem('invoice_counter_v1')
    const n = raw ? parseInt(raw, 10) : 0
    return n + 1
  }
}

async function incrementInvoiceNumber() {
  try {
    const counterRef = doc(db, 'invoicing', 'settings')
    
    const newCounter = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef)
      
      let currentCounter = 0
      if (counterDoc.exists()) {
        currentCounter = counterDoc.data().invoice_counter || 0
      }
      
      const newCounter = currentCounter + 1
      transaction.set(counterRef, { 
        invoice_counter: newCounter,
        last_updated: new Date().toISOString()
      })
      
      return newCounter
    })
    
    // Return the NEXT invoice number (the one that will be used for the next invoice)
    return newCounter + 1
  } catch (error) {
    console.error('Error incrementing invoice number:', error)
    // Fallback to localStorage if Firebase fails
    const raw = localStorage.getItem('invoice_counter_v1')
    const n = raw ? parseInt(raw, 10) : 0
    localStorage.setItem('invoice_counter_v1', String(n + 1))
    // Return the next number for UI
    return n + 2
  }
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

// Helper function to set PDF form field text safely
function setFormField(form, fieldName, value) {
  try {
    const field = form.getTextField(fieldName)
    field.setText(value)
  } catch (e) {
    console.warn(`${fieldName} field not found:`, e)
  }
}

export default function App() {
  const [customerName, setCustomerName] = useState('')
  const [address, setAddress] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState(1)
  const [message, setMessage] = useState('')
  const [issueDate, setIssueDate] = useState(() => getTodayLocalDate())
  const [dueDate, setDueDate] = useState(() => getTodayLocalDate())
  const [amount, setAmount] = useState('660')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [errors, setErrors] = useState({})
  const [isLoadingInvoiceNumber, setIsLoadingInvoiceNumber] = useState(true)
  const [firebaseError, setFirebaseError] = useState('')
  const [dueDateManuallySet, setDueDateManuallySet] = useState(false)

  // Load next invoice number on component mount
  useEffect(() => {
    const loadInvoiceNumber = async () => {
      try {
        setFirebaseError('')
        const nextNumber = await getNextInvoiceNumber()
        setInvoiceNumber(nextNumber)
      } catch (error) {
        console.error('Failed to load invoice number:', error)
        setFirebaseError('Using offline mode - invoice numbers may not sync across devices')
        // Fallback to localStorage
        const raw = localStorage.getItem('invoice_counter_v1')
        const n = raw ? parseInt(raw, 10) : 0
        setInvoiceNumber(n + 1)
      } finally {
        setIsLoadingInvoiceNumber(false)
      }
    }
    
    loadInvoiceNumber()
  }, [])

  // keep due date in sync to issue date by default (unless user manually changed it)
  useEffect(() => {
    if (!dueDateManuallySet) {
      setDueDate(issueDate)
    }
  }, [issueDate, dueDateManuallySet])

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
      const templateUrl = `${import.meta.env.BASE_URL}Page 1 Clean.pdf`
      const response = await fetch(templateUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`)
      }
      
      const existingPdfBytes = await response.arrayBuffer()
      
      setLoadingStep('Filling form fields...')
      
      const pdfDoc = await PDFDocument.load(existingPdfBytes)
      const form = pdfDoc.getForm()
      
      const clientName = customerName.trim()
      const invoiceNum = String(invoiceNumber).padStart(5, '0')
      
      // Set all form fields
      setFormField(form, 'client_name', clientName)
      setFormField(form, 'invoice_number', invoiceNum)
      setFormField(form, 'issue_date', formatDateToDDMMYYYY(issueDate))
      setFormField(form, 'due_date', formatDateToDDMMYYYY(dueDate))
      setFormField(form, 'address', address)
      setFormField(form, 'amount', `$${amount}`)
      setFormField(form, 'total_gst', `$${amount}`)
      setFormField(form, 'total_due', `$${amount}`)
      
      setLoadingStep('Updating field appearances...')
      
      // Update field appearances to ensure proper rendering
      form.updateFieldAppearances()
      
      // Make fields read-only by setting the ReadOnly flag
      const fields = form.getFields()
      fields.forEach((field) => {
        try {
          // Get the underlying acroField and set ReadOnly flag
          const acroField = field.acroField
          acroField.setFlagTo(1, true) // Flag 1 is ReadOnly
        } catch (e) {
          console.warn(`Could not set field ${field.getName()} to read-only:`, e)
        }
      })
      
      setLoadingStep('Flattening form...')
      
      // Flatten the form to make it non-editable
      // This will throw an error if the PDF template is still corrupted
      form.flatten()
      
      setLoadingStep('Combining with remaining pages...')
      
      // Load the Remaining Pages PDF
      const remainingPagesUrl = `${import.meta.env.BASE_URL}Remaining Pages.pdf`
      const remainingResponse = await fetch(remainingPagesUrl)
      if (!remainingResponse.ok) {
        throw new Error(`Failed to fetch Remaining Pages PDF: ${remainingResponse.status} ${remainingResponse.statusText}`)
      }
      const remainingPdfBytes = await remainingResponse.arrayBuffer()
      const remainingPdfDoc = await PDFDocument.load(remainingPdfBytes)
      
      // Copy all pages from Remaining Pages PDF to the main document
      const remainingPages = await pdfDoc.copyPages(remainingPdfDoc, remainingPdfDoc.getPageIndices())
      remainingPages.forEach((page) => {
        pdfDoc.addPage(page)
      })
      
      setLoadingStep('Generating final PDF...')
      
      const pdfBytes = await pdfDoc.save()
      
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoiceNum}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      
      setLoadingStep('Updating invoice counter...')
      
      // Increment the counter in Firebase and get the next invoice number for UI
      const nextInvoiceNumber = await incrementInvoiceNumber()
      
      // Update the UI to show the next invoice number immediately
      setInvoiceNumber(nextInvoiceNumber)
      
      setMessage(`Generated invoice-${invoiceNum}.pdf`)
      
    } catch (error) {
      console.error('Error filling PDF:', error)
      setMessage('Error generating PDF: ' + error.message)
    } finally {
      setIsLoading(false)
      setLoadingStep('')
    }
  }

  return (
    <div className="app">
      <div className="card">
        <img src={`${import.meta.env.BASE_URL}TrinityLogo.png`} alt="Trinity Logo" className="logo" />
        <div className="meta">
          <div>
            <h1>Invoice Generator</h1>
            <div className="muted">Create professional invoices instantly</div>
          </div>
          <label className="field-label" style={{textAlign: 'right', alignItems: 'flex-end'}}>
            Invoice Number
            {isLoadingInvoiceNumber ? (
              <input 
                disabled 
                value="Loading..." 
                className="prefilled"
                style={{
                  textAlign: 'right',
                  maxWidth: '120px'
                }}
              />
            ) : (
              <input 
                type="text"
                value={String(invoiceNumber).padStart(5,'0')}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '') // Only allow numbers
                  if (value) {
                    setInvoiceNumber(parseInt(value, 10))
                  }
                }}
                className="prefilled"
                style={{
                  textAlign: 'right',
                  maxWidth: '120px',
                  fontWeight: '500'
                }}
                placeholder="00001"
              />
            )}
          </label>
        </div>

        <form onSubmit={handleGenerate}>
          <div className="form-row">
            <label className="field-label">
              Customer Name *
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
              Address *
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
              <input 
                type="date" 
                value={issueDate} 
                onChange={(e) => setIssueDate(e.target.value)}
                className="prefilled"
              />
            </label>
            <label className="date-label">
              Due Date
              <input 
                type="date" 
                value={dueDate} 
                onChange={(e) => {
                  setDueDate(e.target.value)
                  setDueDateManuallySet(true)
                }}
                className="prefilled"
              />
            </label>
          </div>

          <div className="form-row">
            <label className="amount-label">
              Amount ($)
              <input 
                type="text" 
                value={amount} 
                onChange={(e) => {
                  setAmount(e.target.value)
                  if (errors.amount) {
                    setErrors(prev => ({ ...prev, amount: '' }))
                  }
                }}
                className={errors.amount ? 'error' : 'prefilled'}
                placeholder="660"
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

        {firebaseError && (
          <div className="message-box" style={{
            background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
            color: '#856404',
            borderColor: 'rgba(255, 193, 7, 0.3)'
          }}>
            <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span>{firebaseError}</span>
          </div>
        )}

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
