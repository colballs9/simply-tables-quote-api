import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { quotes as quotesApi, quoteBlocks } from '../api/client'
import BlockRowCost from './BlockRowCost'
import BlockRowLabor from './BlockRowLabor'

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

// Stable sort: by sort_order first, then by id
function stableSort(items) {
  return [...items].sort((a, b) => {
    const aSort = Number.isFinite(a.sort_order) ? a.sort_order : 0
    const bSort = Number.isFinite(b.sort_order) ? b.sort_order : 0
    if (aSort !== bSort) return aSort - bSort
    return (a.id || '').localeCompare(b.id || '')
  })
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

// ── Block Configs (Editable) ────────────────────────────────────────

function BlockConfigs({ quote, activeOption, onQuoteUpdate }) {
  const [expanded, setExpanded] = useState(true)
  const allBlocks = quote?.quote_blocks || []
  const costBlocks = stableSort(allBlocks.filter(b => b.block_domain === 'cost'))
  const laborBlocks = stableSort(allBlocks.filter(b => b.block_domain === 'labor'))

  const sortedProducts = useMemo(() => {
    const prods = activeOption?.products || []
    return stableSort(prods)
  }, [activeOption])

  async function handleAddBlock(domain) {
    try {
      const payload = domain === 'cost'
        ? {
            block_domain: 'cost',
            block_type: 'unit',
            label: 'New Cost',
            cost_category: 'unit_cost',
            multiplier_type: 'fixed',
            cost_per_unit: 0,
            units_per_product: 1,
            product_ids: sortedProducts.map(p => p.id),
          }
        : {
            block_domain: 'labor',
            block_type: 'unit',
            label: 'New Labor',
            labor_center: 'LC100',
            hours_per_unit: 0,
            product_ids: sortedProducts.map(p => p.id),
          }
      const updated = await quoteBlocks.create(quote.id, payload)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to add block:', err)
    }
  }

  async function handleBlockUpdate(blockId, data) {
    try {
      const updated = await quoteBlocks.update(blockId, data)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update block:', err)
    }
  }

  async function handleDeleteBlock(block) {
    if (block.is_builtin) return
    try {
      const updated = await quoteBlocks.delete(block.id)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to delete block:', err)
    }
  }

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
        <div className="sp-block-configs-scroll">
          {/* Cost Blocks */}
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--cost-text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0' }}>
            Cost Blocks
          </div>
          {costBlocks.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>No cost blocks yet</div>
          )}
          {costBlocks.map(b => (
            <div key={b.id} className="sp-block-config-card sp-block-config-card--editable">
              <div className="sp-block-config-edit-row">
                <BlockRowCost block={b} onBlockUpdate={(data) => handleBlockUpdate(b.id, data)} />
                {!b.is_builtin && (
                  <button className="sp-block-delete-btn" onClick={() => handleDeleteBlock(b)} title="Delete block">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button className="canvas-add-btn canvas-add-btn--cost" onClick={() => handleAddBlock('cost')} style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}>
            <Plus size={13} /> Add Cost Block
          </button>

          {/* Labor Blocks */}
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--hours-text)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 4px' }}>
            Labor Blocks
          </div>
          {laborBlocks.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 0' }}>No labor blocks yet</div>
          )}
          {laborBlocks.map(b => (
            <div key={b.id} className="sp-block-config-card sp-block-config-card--editable">
              <div className="sp-block-config-edit-row">
                <BlockRowLabor block={b} onBlockUpdate={(data) => handleBlockUpdate(b.id, data)} />
                {!b.is_builtin && (
                  <button className="sp-block-delete-btn" onClick={() => handleDeleteBlock(b)} title="Delete block">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <button className="canvas-add-btn canvas-add-btn--labor" onClick={() => handleAddBlock('labor')} style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}>
            <Plus size={13} /> Add Labor Block
          </button>
        </div>
      )}
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

      {/* ── Block Configs (Editable) ── */}
      <BlockConfigs quote={quote} activeOption={activeOption} onQuoteUpdate={onQuoteUpdate} />

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
