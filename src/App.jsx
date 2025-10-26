import React, { useState, useEffect } from 'react'
import { PDFDocument } from 'pdf-lib'
import { db } from './firebase'
import { doc, runTransaction, getDoc } from 'firebase/firestore'

const INVOICE_COUNTER_DOC = 'invoicing/settings'

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
      const templateUrl = '/Fillable Invoice Template.pdf'
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
      
      setLoadingStep('Locking form fields...')
      
      try {
        const fields = form.getFields()
        let flattenedCount = 0
        
        fields.forEach((field) => {
          try {
            if (field.isReadOnly && typeof field.enableReadOnly === 'function') {
              field.enableReadOnly()
              flattenedCount++
            }
          } catch (e) {
            console.warn(`Could not lock field ${field.getName()}:`, e)
          }
        })
        
        if (flattenedCount === 0) {
          try {
            form.flatten({ updateFieldAppearances: false })
          } catch (e) {
            console.warn('Form flattening failed:', e)
          }
        }
        
      } catch (e) {
        console.warn('Form locking failed:', e)
      }
      
      setLoadingStep('Generating PDF...')
      
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
        <img src="/TrinityLogo.png" alt="Trinity Logo" className="logo" />
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
