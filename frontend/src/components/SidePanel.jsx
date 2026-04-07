import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { quotes as quotesApi, products as productsApi } from '../api/client'

// ── Constants ────────────────────────────────────────────────────────

const LC_LABELS = {
  LC100: 'Handling', LC101: 'Processing', LC102: 'Belt Sand',
  LC103: 'Cutting', LC104: 'CNC', LC105: 'Wood Fab',
  LC106: 'Fin Sand', LC107: 'Metal Fab', LC108: 'Stone Fab',
  LC109: 'Finishing', LC110: 'Assembly', LC111: 'Packing',
}

const MARGIN_FIELDS = [
  { key: 'hardwood_margin_rate', label: 'Hardwood' },
  { key: 'stone_margin_rate', label: 'Stone' },
  { key: 'stock_base_margin_rate', label: 'Stock Base' },
  { key: 'stock_base_ship_margin_rate', label: 'SB Shipping' },
  { key: 'powder_coat_margin_rate', label: 'Powder Coat' },
  { key: 'custom_base_margin_rate', label: 'Custom Base' },
  { key: 'unit_cost_margin_rate', label: 'Unit Cost' },
  { key: 'group_cost_margin_rate', label: 'Group Cost' },
  { key: 'misc_margin_rate', label: 'Misc' },
  { key: 'consumables_margin_rate', label: 'Consumables' },
]

// ── Helpers ──────────────────────────────────────────────────────────

function fmt$(val) {
  if (val == null) return '—'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtH(val) {
  if (val == null) return '—'
  return Number(val).toFixed(1) + 'h'
}

function fmtRate(val) {
  if (val == null) return '—'
  return '$' + Number(val).toFixed(2) + '/hr'
}

function pct(val) {
  if (val == null) return ''
  return (Number(val) * 100).toFixed(1)
}

// ── Sub-components ───────────────────────────────────────────────────

function SummaryRow({ label, value, indent = false, accent, muted }) {
  return (
    <div className={`sp-row${indent ? ' sp-row--indent' : ''}`}>
      <span className="sp-row-label" style={muted ? { color: 'var(--text-muted)' } : undefined}>{label}</span>
      <span
        className="sp-row-value"
        style={accent === 'price' ? { color: 'var(--green-300)' }
          : accent === 'cost' ? { color: 'var(--cost-text)' }
          : accent === 'hours' ? { color: 'var(--hours-text)' }
          : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function ProductRateEditor({ product, optionId, onQuoteUpdate, onClose }) {
  const [saving, setSaving] = useState(false)
  const [localRate, setLocalRate] = useState(String(product.hourly_rate ?? 155))
  const [localAdj, setLocalAdj] = useState(String(product.final_adjustment_rate ?? 1))
  const [localMargins, setLocalMargins] = useState(() => {
    const m = {}
    MARGIN_FIELDS.forEach(f => { m[f.key] = pct(product[f.key]) })
    return m
  })
  const focusRef = useRef(null)

  // Sync from props only when product identity changes or when not focused
  const prevProductIdRef = useRef(product.id)
  if (product.id !== prevProductIdRef.current) {
    prevProductIdRef.current = product.id
    setLocalRate(String(product.hourly_rate ?? 155))
    setLocalAdj(String(product.final_adjustment_rate ?? 1))
    const m = {}
    MARGIN_FIELDS.forEach(f => { m[f.key] = pct(product[f.key]) })
    setLocalMargins(m)
  }

  async function saveField(field, value) {
    setSaving(true)
    try {
      const updated = await productsApi.update(optionId, product.id, { [field]: value })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  function handleRateBlur() {
    const v = parseFloat(localRate)
    if (!isNaN(v) && v !== product.hourly_rate) saveField('hourly_rate', v)
  }

  function handleAdjBlur() {
    const v = parseFloat(localAdj)
    if (!isNaN(v) && v !== product.final_adjustment_rate) saveField('final_adjustment_rate', v)
  }

  function handleMarginBlur(key) {
    const pctVal = parseFloat(localMargins[key])
    if (isNaN(pctVal)) return
    const rate = pctVal / 100
    if (rate !== product[key]) saveField(key, rate)
  }

  return (
    <div className="canvas-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="canvas-panel-title" style={{ margin: 0 }}>
          {product.title || 'Untitled'} — Rates
        </div>
        <button className="sp-icon-btn" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      <div className="sp-pool-fields" style={{ marginBottom: 12 }}>
        <div className="sp-pool-field">
          <label>Hourly Rate</label>
          <input
            type="number" step="5"
            value={localRate}
            onChange={e => setLocalRate(e.target.value)}
            onBlur={handleRateBlur}
            disabled={saving}
          />
        </div>
        <div className="sp-pool-field">
          <label>Adjustment</label>
          <input
            type="number" step="0.05"
            value={localAdj}
            onChange={e => setLocalAdj(e.target.value)}
            onBlur={handleAdjBlur}
            disabled={saving}
          />
        </div>
      </div>

      <div className="canvas-panel-title">Margin Rates (%)</div>
      <div className="sp-margin-grid">
        {MARGIN_FIELDS.map(f => (
          <div key={f.key} className="sp-margin-row">
            <span className="sp-margin-label">{f.label}</span>
            <input
              className="sp-margin-input"
              type="number" step="0.5"
              value={localMargins[f.key]}
              onChange={e => setLocalMargins(m => ({ ...m, [f.key]: e.target.value }))}
              onBlur={() => handleMarginBlur(f.key)}
              disabled={saving}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main SidePanel ───────────────────────────────────────────────────

export default function SidePanel({ quote, activeOption, onOptionSelect, onQuoteUpdate, selectedProductId, onProductDeselect }) {
  const [summary, setSummary] = useState(null)
  const [laborExpanded, setLaborExpanded] = useState(true)
  const [shippingSaving, setShippingSaving] = useState(false)
  const [localShipping, setLocalShipping] = useState(String(quote?.shipping ?? '0'))

  const options = quote?.options || []
  const productList = activeOption?.products || []
  const selectedProduct = selectedProductId ? productList.find(p => p.id === selectedProductId) : null

  // Sync shipping from quote prop
  useEffect(() => {
    setLocalShipping(String(quote?.shipping ?? '0'))
  }, [quote?.shipping])

  // Fetch summary whenever computed totals change
  useEffect(() => {
    if (!quote?.id) return
    quotesApi.summary(quote.id)
      .then(setSummary)
      .catch(e => console.error('Summary load failed:', e))
  }, [quote?.id, quote?.total_price, quote?.total_cost, quote?.total_hours])

  async function saveShipping() {
    const val = parseFloat(localShipping) || 0
    setShippingSaving(true)
    try {
      const updated = await quotesApi.update(quote.id, { shipping: val })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
    setShippingSaving(false)
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <aside className="quote-canvas-left">

      {/* ── Option Switcher ── */}
      {options.length > 1 && (
        <div className="canvas-panel">
          <div className="canvas-panel-title">Option View</div>
          <div className="option-tabs">
            {options.map((opt, idx) => (
              <button key={opt.id} className={`option-tab${activeOption?.id === opt.id ? ' active' : ''}`} onClick={() => onOptionSelect(opt.id)}>
                {opt.name || `Option ${idx + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Product Rate/Margin Editor ── */}
      {selectedProduct && (
        <ProductRateEditor
          product={selectedProduct}
          optionId={activeOption?.id}
          onQuoteUpdate={onQuoteUpdate}
          onClose={onProductDeselect}
        />
      )}

      {/* ── Job Summary ── */}
      <div className="canvas-panel">
        <div className="canvas-panel-title">Summary</div>

        {summary ? (
          <>
            <SummaryRow label="Materials" value={fmt$(summary.material_cost_total)} accent="cost" />
            <SummaryRow label="Base Costs" value={fmt$(summary.base_cost_total)} accent="cost" />
            <SummaryRow label="Other Costs" value={fmt$(summary.other_cost_total)} accent="cost" />
            <div className="sp-divider" />
            <SummaryRow label="Total Cost" value={fmt$(summary.total_cost)} accent="cost" />
            <SummaryRow label="Total Margin" value={fmt$(summary.total_margin)} muted />
            <SummaryRow label="Material Price" value={fmt$(summary.total_material_price)} />
            <div className="sp-divider" />

            {/* Labor by LC */}
            <div
              className="sp-expandable-header"
              onClick={() => setLaborExpanded(v => !v)}
            >
              <span className="sp-row-label" style={{ color: 'var(--hours-text)' }}>
                Labor {summary.total_hours ? `${Number(summary.total_hours).toFixed(1)}h` : ''}
              </span>
              {laborExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            {laborExpanded && Object.entries(summary.hours_by_labor_center || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([lc, hrs]) => (
                <SummaryRow
                  key={lc}
                  label={`${lc} ${LC_LABELS[lc] || ''}`}
                  value={fmtH(hrs)}
                  indent
                  accent="hours"
                />
              ))
            }
            <SummaryRow label="Hours Price" value={fmt$(summary.hours_price)} />
            <div className="sp-divider" />

            {/* Financial summary */}
            <SummaryRow label="Quote Total" value={fmt$(summary.quote_total)} accent="price" />
            <SummaryRow label="Shipping" value={fmt$(summary.shipping)} muted />
            <SummaryRow label="Grand Total" value={fmt$(summary.grand_total)} accent="price" />
            <div className="sp-divider" />
            <SummaryRow label="Op Revenue" value={fmt$(summary.op_revenue)} />
            <SummaryRow label="Job $/hr" value={fmtRate(summary.job_dollar_per_hr)} />
          </>
        ) : (
          <>
            <SummaryRow label="Quote Total" value={fmt$(quote?.total_price)} accent="price" />
            <SummaryRow label="Total Hours" value={fmtH(quote?.total_hours)} accent="hours" />
            <SummaryRow label="Grand Total" value={fmt$(quote?.grand_total)} accent="price" />
          </>
        )}
      </div>

      {/* ── Shipping ── */}
      <div className="canvas-panel">
        <div className="canvas-panel-title">Shipping</div>
        <div className="sp-inline-field">
          <span className="sp-inline-prefix">$</span>
          <input
            type="number"
            step="10"
            value={localShipping}
            onChange={e => setLocalShipping(e.target.value)}
            onBlur={saveShipping}
            disabled={shippingSaving}
          />
        </div>
      </div>

    </aside>
  )
}
