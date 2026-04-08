import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, ArrowLeft, RefreshCw, Trash2 } from 'lucide-react'
import { quotes, products } from '../api/client'
import SidePanel from '../components/SidePanel'
import QuoteCanvas from '../components/QuoteCanvas'

function formatPrice(val) {
  if (!val && val !== 0) return '\u2014'
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
  const [selectedOptionId, setSelectedOptionId] = useState('')

  // Local state for text/number inputs (save on blur, not every keystroke)
  const [localProjectName, setLocalProjectName] = useState('')
  const [localDealId, setLocalDealId] = useState('')
  const [localRepRate, setLocalRepRate] = useState('')
  const projectNameTimerRef = useRef(null)

  // Track whether localDealId has been initialized from a full load
  const dealIdInitRef = useRef(false)

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
      setLocalProjectName(data.project_name || '')
      setLocalDealId(data.deal_id || '')
      dealIdInitRef.current = true
      setLocalRepRate(String(data.rep_rate ?? 0.08))
      if (!selectedOptionId && data.options?.[0]?.id) {
        setSelectedOptionId(data.options[0].id)
      }
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
      setLocalProjectName(data.project_name || '')
      setLocalDealId(data.deal_id || '')
      dealIdInitRef.current = true
      setLocalRepRate(String(data.rep_rate ?? 0.08))
      if (data.options?.[0]?.id) {
        setSelectedOptionId(data.options[0].id)
      }
    } catch (err) {
      console.error('Failed to create quote:', err)
      setError(err.message || 'Failed to create quote')
    }
    setLoading(false)
  }

  // Generic handler that refreshes quote after any mutation
  const refreshQuote = useCallback((updatedQuote) => {
    setQuote(updatedQuote)
    // Don't overwrite localDealId -- local state is authoritative until next full load
    setSelectedOptionId(prev => {
      if (!prev && updatedQuote.options?.[0]?.id) {
        return updatedQuote.options[0].id
      }
      return prev
    })
  }, [])

  // Debounced project name save
  function handleProjectNameChange(value) {
    setLocalProjectName(value)
    clearTimeout(projectNameTimerRef.current)
    projectNameTimerRef.current = setTimeout(() => {
      saveProjectName(value)
    }, 600)
  }

  function handleProjectNameBlur() {
    clearTimeout(projectNameTimerRef.current)
    saveProjectName(localProjectName)
  }

  async function saveProjectName(value) {
    if (!quote || value === quote.project_name) return
    setSaving(true)
    try {
      const updated = await quotes.update(quote.id, { project_name: value })
      setQuote(updated)
    } catch (err) {
      console.error('Failed to save project name:', err)
      setError(err.message || 'Failed to save project name')
    }
    setSaving(false)
  }

  async function handleQuoteFieldChange(field, value) {
    if (!quote) return
    setSaving(true)
    setError('')
    try {
      const updated = await quotes.update(quote.id, { [field]: value })
      setQuote(updated)
      // Don't sync localDealId back -- local state is authoritative
    } catch (err) {
      console.error('Failed to update quote:', err)
      setError(err.message || 'Failed to update quote')
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

  const options = quote.options || []
  const activeOption = options.find(o => o.id === selectedOptionId) || options[0]

  return (
    <div className="fade-in">
      {/* Consolidated Header Bar */}
      <div className="qb-header-bar">
        <div className="qb-header-left">
          <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: '6px 8px' }}>
            <ArrowLeft size={16} />
          </button>
          <div className="qb-header-name-group">
            <input
              className="qb-project-name-input"
              value={localProjectName}
              onChange={e => handleProjectNameChange(e.target.value)}
              onBlur={handleProjectNameBlur}
              onFocus={e => e.target.style.borderBottomColor = 'var(--accent)'}
              placeholder="Project name..."
            />
            <span className="qb-quote-number">
              {quote.quote_number}
              {saving && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>Saving...</span>}
            </span>
          </div>
          <input
            className="qb-deal-id-input"
            value={localDealId}
            onChange={e => setLocalDealId(e.target.value)}
            onBlur={() => {
              if (localDealId !== (quote.deal_id || '')) {
                handleQuoteFieldChange('deal_id', localDealId)
              }
            }}
            placeholder="Deal #"
          />
          <select
            className="qb-status-select"
            value={quote.status}
            onChange={e => handleQuoteFieldChange('status', e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="quoted">Quoted</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
          <div className="qb-rep-group">
            <label className="qb-rep-toggle">
              <input
                type="checkbox"
                checked={quote.has_rep}
                onChange={e => handleQuoteFieldChange('has_rep', e.target.checked)}
              />
              <span>Rep</span>
            </label>
            {quote.has_rep && (
              <input
                className="qb-rep-rate-input"
                type="number"
                step="0.01"
                value={localRepRate}
                onChange={e => setLocalRepRate(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(localRepRate)
                  if (!isNaN(val) && val !== quote.rep_rate) {
                    handleQuoteFieldChange('rep_rate', val)
                  }
                }}
                title="Rep rate"
              />
            )}
          </div>
        </div>

        <div className="qb-header-right">
          <div className="qb-header-totals">
            <span className="qb-total-price">{formatPrice(quote.total_price)}</span>
            {quote.total_hours != null && (
              <span className="qb-total-hours">{Number(quote.total_hours).toFixed(1)}h</span>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleRecalculate} disabled={saving || recalculating}>
            <RefreshCw size={14} /> {recalculating ? 'Recalc...' : 'Recalc'}
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteQuote} disabled={deleting || saving}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {error && (
        <div className="notice notice-error" style={{ marginBottom: 20 }}>
          <strong>Something needs attention.</strong>
          <span>{error}</span>
        </div>
      )}

      <div className="quote-canvas-shell">
        <SidePanel
          quote={quote}
          activeOption={activeOption}
          onOptionSelect={setSelectedOptionId}
          onQuoteUpdate={refreshQuote}
        />

        <section className="quote-canvas-right">
          {!activeOption && (
            <div className="notice notice-warning" style={{ marginBottom: 12 }}>
              <strong>No quote option is available yet.</strong>
              <span>This builder expects at least one option. Product creation is blocked until the backend provides an option record.</span>
            </div>
          )}

          <QuoteCanvas
            quote={quote}
            activeOption={activeOption}
            onQuoteUpdate={refreshQuote}
          />
        </section>
      </div>
    </div>
  )
}
