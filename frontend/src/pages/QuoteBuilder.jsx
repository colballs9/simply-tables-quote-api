import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, ArrowLeft, RefreshCw, Trash2 } from 'lucide-react'
import { quotes, products } from '../api/client'
import ProductCard from '../components/ProductCard'

function formatPrice(val) {
  if (!val && val !== 0) return '—'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function QuoteBuilder() {
  const { quoteId } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [recalculating, setRecalculating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Load or create quote
  useEffect(() => {
    if (quoteId) {
      loadQuote(quoteId)
    } else {
      createQuote()
    }
  }, [quoteId])

  async function loadQuote(id) {
    setLoading(true)
    setError('')
    try {
      const data = await quotes.get(id)
      setQuote(data)
    } catch (err) {
      console.error('Failed to load quote:', err)
      setError(err.message || 'Failed to load quote')
    }
    setLoading(false)
  }

  async function createQuote() {
    setError('')
    try {
      const data = await quotes.create({ project_name: 'New Quote' })
      navigate(`/quotes/${data.id}`, { replace: true })
      setQuote(data)
    } catch (err) {
      console.error('Failed to create quote:', err)
      setError(err.message || 'Failed to create quote')
    }
    setLoading(false)
  }

  // Generic handler that refreshes quote after any mutation
  const refreshQuote = useCallback((updatedQuote) => {
    setQuote(updatedQuote)
  }, [])

  async function handleQuoteFieldChange(field, value) {
    if (!quote) return
    setSaving(true)
    setError('')
    try {
      const updated = await quotes.update(quote.id, { [field]: value })
      setQuote(updated)
    } catch (err) {
      console.error('Failed to update quote:', err)
      setError(err.message || 'Failed to update quote')
    }
    setSaving(false)
  }

  async function handleAddProduct() {
    if (!quote || !quote.options?.[0]) {
      setError('This quote does not have an option yet, so a product cannot be added.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const optionId = quote.options[0].id
      const updated = await products.add(optionId, {
        title: `Product ${(quote.options[0].products?.length || 0) + 1}`,
        material_type: 'Hardwood',
        quantity: 1,
      })
      setQuote(updated)
    } catch (err) {
      console.error('Failed to add product:', err)
      setError(err.message || 'Failed to add product')
    }
    setSaving(false)
  }

  async function handleRecalculate() {
    if (!quote) return
    setRecalculating(true)
    setError('')
    try {
      const updated = await quotes.recalculate(quote.id)
      setQuote(updated)
    } catch (err) {
      console.error('Failed to recalculate quote:', err)
      setError(err.message || 'Failed to recalculate quote')
    }
    setRecalculating(false)
  }

  async function handleDeleteQuote() {
    if (!quote || !window.confirm('Delete this quote? This cannot be undone.')) return
    setDeleting(true)
    setError('')
    try {
      await quotes.delete(quote.id)
      navigate('/')
    } catch (err) {
      console.error('Failed to delete quote:', err)
      setError(err.message || 'Failed to delete quote')
      setDeleting(false)
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
  if (!quote) return <p style={{ color: 'var(--text-muted)' }}>{error || 'Quote not found'}</p>

  const option = quote.options?.[0]
  const productList = option?.products || []

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                style={{
                  background: 'transparent',
                  border: 'none',
                  font: 'inherit',
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  padding: '2px 0',
                  borderBottom: '2px solid transparent',
                  width: '400px',
                }}
                value={quote.project_name}
                onChange={e => handleQuoteFieldChange('project_name', e.target.value)}
                onFocus={e => e.target.style.borderBottomColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderBottomColor = 'transparent'}
                placeholder="Project name..."
              />
              <span className={`status-badge ${quote.status}`}>{quote.status}</span>
            </div>
            <p className="page-subtitle" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              {quote.quote_number}
              {saving && <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>Saving...</span>}
            </p>
          </div>
        </div>

        {/* Quote-level total */}
        <div className="quote-header-actions">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quote Total
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-300)' }}>
              {formatPrice(quote.total_price)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--hours-text)' }}>
              {quote.total_hours ? `${Number(quote.total_hours).toFixed(1)} hours` : ''}
            </div>
          </div>
          <div className="page-actions">
            <button className="btn btn-ghost" onClick={() => loadQuote(quote.id)} disabled={loading || saving || recalculating}>
              Refresh
            </button>
            <button className="btn btn-secondary" onClick={handleRecalculate} disabled={saving || recalculating}>
              <RefreshCw size={16} /> {recalculating ? 'Recalculating...' : 'Recalculate'}
            </button>
            <button className="btn btn-danger" onClick={handleDeleteQuote} disabled={deleting || saving}>
              <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete Quote'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="notice notice-error" style={{ marginBottom: 20 }}>
          <strong>Something needs attention.</strong>
          <span>{error}</span>
        </div>
      )}

      {/* Quote settings bar */}
      <div className="card" style={{ marginBottom: 24, padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 120 }}>
            <label>Deal ID</label>
            <input
              value={quote.deal_id || ''}
              onChange={e => handleQuoteFieldChange('deal_id', e.target.value)}
              placeholder="0670"
            />
          </div>
          <div className="field" style={{ minWidth: 100 }}>
            <label>Status</label>
            <select
              value={quote.status}
              onChange={e => handleQuoteFieldChange('status', e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="quoted">Quoted</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div className="field" style={{ minWidth: 80 }}>
            <label>Rep</label>
            <select
              value={quote.has_rep ? 'yes' : 'no'}
              onChange={e => handleQuoteFieldChange('has_rep', e.target.value === 'yes')}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {quote.has_rep && (
            <div className="field" style={{ minWidth: 80 }}>
              <label>Rep Rate</label>
              <input
                type="number"
                step="0.01"
                value={quote.rep_rate || 0.08}
                onChange={e => handleQuoteFieldChange('rep_rate', parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!option && (
          <div className="notice notice-warning">
            <strong>No quote option is available yet.</strong>
            <span>This builder expects at least one option. Product creation is blocked until the backend provides an option record.</span>
          </div>
        )}

        {productList.map(product => (
          <ProductCard
            key={product.id}
            product={product}
            optionId={option.id}
            quoteId={quote.id}
            onUpdate={refreshQuote}
          />
        ))}

        <button className="btn btn-primary" onClick={handleAddProduct} style={{ alignSelf: 'flex-start' }} disabled={saving || !option}>
          <Plus size={16} /> Add Product
        </button>
      </div>
    </div>
  )
}
