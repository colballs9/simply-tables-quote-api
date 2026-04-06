import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText } from 'lucide-react'
import { quotes } from '../api/client'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(val) {
  if (!val && val !== 0) return '—'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function QuoteList() {
  const [quoteList, setQuoteList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadQuotes()
  }, [filter])

  async function loadQuotes() {
    setLoading(true)
    try {
      const data = await quotes.list(filter || undefined)
      setQuoteList(data)
    } catch (err) {
      console.error('Failed to load quotes:', err)
    }
    setLoading(false)
  }

  async function handleNewQuote() {
    try {
      const quote = await quotes.create({ project_name: 'New Quote' })
      navigate(`/quotes/${quote.id}`)
    } catch (err) {
      console.error('Failed to create quote:', err)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Quotes</h1>
          <p className="page-subtitle">{quoteList.length} quote{quoteList.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={handleNewQuote}>
          <Plus size={16} /> New Quote
        </button>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'draft', 'quoted', 'won', 'lost'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFilter(s)}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : quoteList.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} />
          <p>No quotes yet</p>
          <button className="btn btn-primary" onClick={handleNewQuote}>
            <Plus size={16} /> Create your first quote
          </button>
        </div>
      ) : (
        <div className="quote-list">
          {/* Header */}
          <div className="quote-row" style={{ background: 'transparent', border: 'none', cursor: 'default', padding: '0 20px 8px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quote #</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Total</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Hours</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Updated</span>
          </div>

          {quoteList.map(q => (
            <div key={q.id} className="quote-row" onClick={() => navigate(`/quotes/${q.id}`)}>
              <span className="quote-id">{q.quote_number}</span>
              <span className="project-name">{q.project_name}</span>
              <span><span className={`status-badge ${q.status}`}>{q.status}</span></span>
              <span className="price">{formatPrice(q.total_price)}</span>
              <span className="price" style={{ color: 'var(--hours-text)' }}>
                {q.total_hours ? `${Number(q.total_hours).toFixed(1)}h` : '—'}
              </span>
              <span className="date">{formatDate(q.updated_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
