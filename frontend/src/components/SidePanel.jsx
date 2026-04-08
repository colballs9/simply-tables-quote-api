import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { quotes as quotesApi } from '../api/client'

// ── Constants ────────────────────────────────────────────────────────

const LC_LABELS = {
  LC100: 'Handling', LC101: 'Processing', LC102: 'Belt Sand',
  LC103: 'Cutting', LC104: 'CNC', LC105: 'Wood Fab',
  LC106: 'Fin Sand', LC107: 'Metal Fab', LC108: 'Stone Fab',
  LC109: 'Finishing', LC110: 'Assembly', LC111: 'Packing',
}

// ── Helpers ──────────────────────────────────────────────────────────

function fmt$(val) {
  if (val == null) return '\u2014'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtH(val) {
  if (val == null) return '\u2014'
  return Number(val).toFixed(1) + 'h'
}

function fmtRate(val) {
  if (val == null) return '\u2014'
  return '$' + Number(val).toFixed(2) + '/hr'
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

// ── Quote Stats ─────────────────────────────────────────────────────

function QuoteStats({ activeOption }) {
  const prods = activeOption?.products || []

  const stats = useMemo(() => {
    const totalProducts = prods.length
    const totalQuantity = prods.reduce((sum, p) => sum + (p.quantity || 0), 0)
    const totalSqFt = prods.reduce((sum, p) => sum + (p.sq_ft || 0), 0)

    const materialCounts = {}
    prods.forEach(p => {
      const mt = p.material_type || 'Unknown'
      materialCounts[mt] = (materialCounts[mt] || 0) + 1
    })
    const materials = Object.entries(materialCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => `${type} (${count})`)

    return { totalProducts, totalQuantity, totalSqFt, materials }
  }, [prods])

  return (
    <div className="canvas-panel">
      <div className="canvas-panel-title">Quote Stats</div>
      <SummaryRow label="Products" value={stats.totalProducts} />
      <SummaryRow label="Total Qty" value={stats.totalQuantity} />
      <SummaryRow label="Total Sq Ft" value={stats.totalSqFt > 0 ? stats.totalSqFt.toFixed(1) : '\u2014'} />
      {stats.materials.length > 0 && (
        <>
          <div className="sp-divider" />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            Materials
          </div>
          {stats.materials.map(m => (
            <div key={m} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '1px 0' }}>{m}</div>
          ))}
        </>
      )}
    </div>
  )
}

// ── Block Configs ───────────────────────────────────────────────────

function BlockConfigs({ quote }) {
  const [expanded, setExpanded] = useState(false)
  const allBlocks = quote?.quote_blocks || []
  const costBlocks = allBlocks.filter(b => b.block_domain === 'cost')
  const laborBlocks = allBlocks.filter(b => b.block_domain === 'labor')

  if (allBlocks.length === 0) return null

  return (
    <div className="canvas-panel">
      <div
        className="sp-expandable-header"
        onClick={() => setExpanded(v => !v)}
        style={{ marginBottom: expanded ? 8 : 0 }}
      >
        <span className="canvas-panel-title" style={{ marginBottom: 0 }}>
          Block Configs ({allBlocks.length})
        </span>
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </div>

      {expanded && (
        <>
          {costBlocks.length > 0 && (
            <>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--cost-text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0' }}>
                Cost Blocks
              </div>
              {costBlocks.map(b => (
                <BlockConfigCard key={b.id} block={b} domain="cost" />
              ))}
            </>
          )}
          {laborBlocks.length > 0 && (
            <>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--hours-text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '6px 0 4px' }}>
                Labor Blocks
              </div>
              {laborBlocks.map(b => (
                <BlockConfigCard key={b.id} block={b} domain="labor" />
              ))}
            </>
          )}
        </>
      )}
    </div>
  )
}

function BlockConfigCard({ block, domain }) {
  const isCost = domain === 'cost'
  const badgeClass = isCost ? 'cost' : 'hours'
  const fields = []

  if (block.block_type) fields.push({ k: 'Type', v: block.block_type })
  if (isCost && block.cost_category) fields.push({ k: 'Category', v: block.cost_category })
  if (isCost && block.multiplier_type) fields.push({ k: 'Multiplier', v: block.multiplier_type })
  if (!isCost && block.labor_center) fields.push({ k: 'Center', v: `${block.labor_center} ${LC_LABELS[block.labor_center] || ''}` })
  if (block.rate_type) fields.push({ k: 'Rate Type', v: block.rate_type })

  return (
    <div className="sp-block-config-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span className={`pool-tag ${badgeClass}`} style={{ fontSize: '0.58rem', padding: '0px 5px' }}>
          {block.block_type}
        </span>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {block.label || 'Untitled'}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
        {fields.map(f => (
          <span key={f.k} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {f.k}: <span style={{ color: 'var(--text-secondary)' }}>{f.v}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Main SidePanel ───────────────────────────────────────────────────

export default function SidePanel({ quote, activeOption, onOptionSelect, onQuoteUpdate }) {
  const [summary, setSummary] = useState(null)
  const [laborExpanded, setLaborExpanded] = useState(true)
  const [shippingSaving, setShippingSaving] = useState(false)
  const [localShipping, setLocalShipping] = useState(String(quote?.shipping ?? '0'))

  const options = quote?.options || []

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

      {/* ── Quote Stats ── */}
      <QuoteStats activeOption={activeOption} />

      {/* ── Block Configs ── */}
      <BlockConfigs quote={quote} />

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

            <div className="sp-expandable-header" onClick={() => setLaborExpanded(v => !v)}>
              <span className="sp-row-label" style={{ color: 'var(--hours-text)' }}>
                Labor {summary.total_hours ? `${Number(summary.total_hours).toFixed(1)}h` : ''}
              </span>
              {laborExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </div>
            {laborExpanded && Object.entries(summary.hours_by_labor_center || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([lc, hrs]) => (
                <SummaryRow key={lc} label={`${lc} ${LC_LABELS[lc] || ''}`} value={fmtH(hrs)} indent accent="hours" />
              ))
            }
            <SummaryRow label="Hours Price" value={fmt$(summary.hours_price)} />
            <div className="sp-divider" />

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
            type="number" step="10"
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
