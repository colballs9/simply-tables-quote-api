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

const MATERIAL_TYPES = ['Hardwood', 'Stone', 'Live Edge', 'Laminate', 'Wood Edge Laminate', 'Outdoor', 'Other']
const SHAPES = ['Standard', 'DIA', 'Custom Shape', 'Base Only']
const HEIGHTS = ['Dining Height', 'Counter Height', 'Bar Height', 'Top Only', 'Custom Height']
const BASE_TYPES = ['Stock Base', 'Custom Base', 'Top Only']
const THICKNESSES = ['', '.75"', '1"', '1.25"', '1.5"', '1.75"', '2"', '2.25"', '2.5"']

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

function formatPrice(val) {
  if (!val && val !== 0) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

// ── Product Editor (Specs + Descriptions + Rates) ────────────────────

function ProductEditor({ product, optionId, onQuoteUpdate, onClose }) {
  const [saving, setSaving] = useState(false)
  const [specsOpen, setSpecsOpen] = useState(true)
  const [descOpen, setDescOpen] = useState(false)
  const [ratesOpen, setRatesOpen] = useState(false)

  // Local state for all editable fields — save on blur
  const [locals, setLocals] = useState(() => buildLocals(product))
  const focusRef = useRef(null)

  // Sync from props when product identity changes
  const prevIdRef = useRef(product.id)
  if (product.id !== prevIdRef.current) {
    prevIdRef.current = product.id
    setLocals(buildLocals(product))
  }

  function buildLocals(p) {
    const m = {}
    MARGIN_FIELDS.forEach(f => { m[f.key] = pct(p[f.key]) })
    return {
      title: p.title || '',
      quantity: String(p.quantity ?? 1),
      width: String(p.width ?? ''),
      length: String(p.length ?? ''),
      material_detail: p.material_detail || '',
      lumber_thickness: p.lumber_thickness || '',
      base_vendor: p.base_vendor || '',
      base_style: p.base_style || '',
      base_size: p.base_size || '',
      edge_profile: p.edge_profile || '',
      stain_or_color: p.stain_or_color || '',
      color_name: p.color_name || '',
      sheen: p.sheen || '',
      notes: p.notes || '',
      bases_per_top: String(p.bases_per_top ?? 1),
      shape_custom: p.shape_custom || '',
      height_input: p.height_input || '',
      hourly_rate: String(p.hourly_rate ?? 155),
      final_adjustment_rate: String(p.final_adjustment_rate ?? 1),
      ...m,
    }
  }

  function setLocal(key, value) {
    setLocals(prev => ({ ...prev, [key]: value }))
  }

  async function saveField(field, value) {
    setSaving(true)
    try {
      const updated = await productsApi.update(optionId, product.id, { [field]: value })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  function saveText(field) {
    focusRef.current = null
    const val = locals[field]
    if (val !== (product[field] || '')) saveField(field, val || null)
  }

  function saveNum(field) {
    focusRef.current = null
    const val = parseFloat(locals[field])
    if (!isNaN(val) && val !== product[field]) saveField(field, val)
  }

  function saveSelect(field, value) {
    saveField(field, value)
  }

  function saveMargin(key) {
    focusRef.current = null
    const pctVal = parseFloat(locals[key])
    if (isNaN(pctVal)) return
    const rate = pctVal / 100
    if (rate !== product[key]) saveField(key, rate)
  }

  function Field({ label, field, type = 'text', step, placeholder }) {
    const isNum = type === 'number'
    return (
      <div className="sp-pool-field">
        <label>{label}</label>
        <input
          type={type}
          step={step}
          value={locals[field] ?? ''}
          onChange={e => setLocal(field, e.target.value)}
          onFocus={() => { focusRef.current = field }}
          onBlur={() => isNum ? saveNum(field) : saveText(field)}
          placeholder={placeholder}
          disabled={saving}
        />
      </div>
    )
  }

  function SelectField({ label, field, options }) {
    return (
      <div className="sp-pool-field">
        <label>{label}</label>
        <select
          value={product[field] || options[0]}
          onChange={e => saveSelect(field, e.target.value)}
          disabled={saving}
        >
          {options.map(o => <option key={o} value={o}>{o || '—'}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div className="canvas-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="canvas-panel-title" style={{ margin: 0 }}>
          {product.title || 'Untitled'}
        </div>
        <button className="sp-icon-btn" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>

      {/* Computed pricing summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--cost-text)', fontFamily: 'var(--font-mono)' }}>
          {formatPrice(product.total_material_cost)} cost
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--hours-text)', fontFamily: 'var(--font-mono)' }}>
          {product.total_hours_pp ? `${Number(product.total_hours_pp).toFixed(2)}h` : '--'}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--green-300)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {formatPrice(product.sale_price_pp)} sale
        </span>
      </div>

      {/* ── General Specs ── */}
      <div className="sp-expandable-header" onClick={() => setSpecsOpen(v => !v)}>
        <span className="sp-row-label">General Specs</span>
        {specsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </div>
      {specsOpen && (
        <div className="sp-pool-fields" style={{ marginBottom: 8, marginTop: 6 }}>
          <Field label="Title" field="title" />
          <SelectField label="Material" field="material_type" options={MATERIAL_TYPES} />
          <Field label="Quantity" field="quantity" type="number" step="1" />
          <Field label="Width" field="width" type="number" step="0.25" />
          <Field label="Length" field="length" type="number" step="0.25" />
          <SelectField label="Shape" field="shape" options={SHAPES} />
          {product.shape === 'Custom Shape' && (
            <Field label="Shape Detail" field="shape_custom" />
          )}
          <SelectField label="Height" field="height_name" options={HEIGHTS} />
          {product.height_name === 'Custom Height' && (
            <Field label="Height (in)" field="height_input" />
          )}
          <SelectField label="Base Type" field="base_type" options={BASE_TYPES} />
          <Field label="Material Detail" field="material_detail" placeholder="e.g. Walnut" />
          {(product.material_type === 'Hardwood' || product.material_type === 'Live Edge') && (
            <SelectField label="Thickness" field="lumber_thickness" options={THICKNESSES} />
          )}
          <Field label="Bases/Top" field="bases_per_top" type="number" step="1" />
        </div>
      )}

      {/* ── Descriptions ── */}
      <div className="sp-expandable-header" onClick={() => setDescOpen(v => !v)}>
        <span className="sp-row-label">Descriptions</span>
        {descOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </div>
      {descOpen && (
        <div className="sp-pool-fields" style={{ marginBottom: 8, marginTop: 6 }}>
          <Field label="Edge Profile" field="edge_profile" />
          <Field label="Stain / Color" field="stain_or_color" />
          <Field label="Color Name" field="color_name" />
          <Field label="Sheen" field="sheen" />
          <Field label="Notes" field="notes" />
        </div>
      )}

      {/* ── Rates & Margins ── */}
      <div className="sp-expandable-header" onClick={() => setRatesOpen(v => !v)}>
        <span className="sp-row-label">Rates & Margins</span>
        {ratesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </div>
      {ratesOpen && (
        <>
          <div className="sp-pool-fields" style={{ marginBottom: 8, marginTop: 6 }}>
            <Field label="Hourly Rate" field="hourly_rate" type="number" step="5" />
            <Field label="Adjustment" field="final_adjustment_rate" type="number" step="0.05" />
          </div>

          <div className="sp-margin-grid">
            {MARGIN_FIELDS.map(f => (
              <div key={f.key} className="sp-margin-row">
                <span className="sp-margin-label">{f.label}</span>
                <input
                  className="sp-margin-input"
                  type="number" step="0.5"
                  value={locals[f.key]}
                  onChange={e => setLocal(f.key, e.target.value)}
                  onFocus={() => { focusRef.current = f.key }}
                  onBlur={() => saveMargin(f.key)}
                  disabled={saving}
                />
              </div>
            ))}
          </div>
        </>
      )}
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

      {/* ── Product Editor (Specs + Descriptions + Rates) ── */}
      {selectedProduct && (
        <ProductEditor
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
