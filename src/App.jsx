import React, { useState, useEffect } from 'react'
import jsPDF from 'jspdf'

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

export default function App() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [address, setAddress] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState(() => getNextInvoiceNumber())
  const [message, setMessage] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [amount, setAmount] = useState('395')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')

  useEffect(() => {
    setInvoiceNumber(getNextInvoiceNumber())
  }, [])

  // keep due date in sync to issue date by default
  useEffect(() => {
    setDueDate(issueDate)
  }, [issueDate])

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!firstName.trim() && !lastName.trim()) {
      setMessage('Enter customer first or last name')
      return
    }
    setIsLoading(true)
    setLoadingStep('Connecting to server...')
    setMessage('')

    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        address: address,
        invoice_number: String(invoiceNumber).padStart(5, '0'),
        issue_date: issueDate,
        due_date: dueDate,
        amount,
        payment_method: 'Transfer'
      }

      setLoadingStep('Preparing invoice...')
      
      const resp = await fetch('https://invoicing-app-rdoz.onrender.com/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || 'Server conversion failed')
      }

      setLoadingStep('Converting to PDF...')
      const blob = await resp.blob()
      setLoadingStep('Finalizing document...')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${String(invoiceNumber).padStart(5, '0')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      incrementInvoiceNumber()
      setInvoiceNumber(getNextInvoiceNumber())
      setMessage(`Saved invoice-${String(invoiceNumber).padStart(5, '0')}.pdf`)
      setIsLoading(false)
      setLoadingStep('')
      return
    } catch (err) {
      console.warn('Server conversion failed, falling back to simple client PDF:', err)
      setLoadingStep('Server error, creating backup PDF...')
      setMessage('')
      // Fallback: programmatic PDF via jsPDF (simple but preserves data)
      const pdf = new jsPDF()
      const left = 20
      let y = 30
      pdf.setFontSize(18)
      pdf.text(`Invoice #${String(invoiceNumber).padStart(5, '0')}`, left, y)
      y += 12
      pdf.setFontSize(12)
      pdf.text(`Issue Date: ${issueDate}`, left, y)
      y += 8
      pdf.text(`Due Date: ${dueDate}`, left, y)
      y += 12
      pdf.text(`Bill To: ${firstName} ${lastName}`, left, y)
      y += 12
      pdf.text(`Amount: $${amount}`, left, y)
      y += 18
      pdf.text(`Payment Method: Transfer`, left, y)
      const filename = `invoice-${String(invoiceNumber).padStart(5, '0')}.pdf`
      pdf.save(filename)
      incrementInvoiceNumber()
      setInvoiceNumber(getNextInvoiceNumber())
      setMessage(`Saved ${filename}`)
      setIsLoading(false)
      setLoadingStep('')
      return
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
            <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>

          <div className="form-row">
            <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
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
              <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
