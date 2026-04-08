import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { products } from '../api/client'
import MaterialSearch from './MaterialSearch'

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

function pct(val) {
  if (val == null) return ''
  return (Number(val) * 100).toFixed(1)
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

export default function ProductColumn({ product, optionId, onQuoteUpdate }) {
  const [specsOpen, setSpecsOpen] = useState(true)
  const [descOpen, setDescOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [locals, setLocals] = useState(() => buildLocals(product))
  const focusRef = useRef(null)

  // Sync from props when product identity changes (not on every render)
  const prevIdRef = useRef(product.id)
  if (product.id !== prevIdRef.current) {
    prevIdRef.current = product.id
    setLocals(buildLocals(product))
  }

  // Sync individual fields from props when they change AND the field is not focused
  const prevPropsRef = useRef(product)
  if (prevPropsRef.current !== product && product.id === prevIdRef.current) {
    const newLocals = buildLocals(product)
    setLocals(prev => {
      const updated = { ...prev }
      for (const key of Object.keys(newLocals)) {
        if (focusRef.current !== key) {
          updated[key] = newLocals[key]
        }
      }
      return updated
    })
  }
  prevPropsRef.current = product

  function setLocal(key, value) {
    setLocals(prev => ({ ...prev, [key]: value }))
  }

  async function saveField(field, value) {
    setSaving(true)
    try {
      const updated = await products.update(optionId, product.id, { [field]: value })
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
    setLocal(field, value)
    saveField(field, value)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${product.title || 'this product'}"?`)) return
    try {
      const updated = await products.delete(optionId, product.id)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to delete product:', err)
    }
  }

  const dims = []
  if (product.width) dims.push(`${product.width}"`)
  if (product.length) dims.push(`${product.length}"`)
  const dimStr = dims.join(' x ')

  return (
    <div className="canvas-cell canvas-cell--header canvas-product-column">
      {/* Title row */}
      <div className="canvas-product-header-top">
        <input
          className="canvas-product-title-input"
          value={locals.title}
          onChange={e => setLocal('title', e.target.value)}
          onFocus={() => { focusRef.current = 'title' }}
          onBlur={() => saveText('title')}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          placeholder="Untitled"
          disabled={saving}
        />
        <button className="canvas-product-delete" onClick={handleDelete} title="Delete product">
          <Trash2 size={11} />
        </button>
      </div>

      {/* Meta line */}
      <div className="canvas-product-meta">
        <span className="canvas-product-badge">{product.material_type}</span>
        {product.quantity > 1 && <span className="canvas-product-qty">x{product.quantity}</span>}
        {dimStr && <span className="canvas-product-dims">{dimStr}</span>}
      </div>

      {/* Specs section */}
      <div className="pcol-section-header" onClick={() => setSpecsOpen(v => !v)}>
        <span>Specs</span>
        {specsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </div>
      {specsOpen && (
        <div className="pcol-fields">
          <PcolSelect label="Material Group" value={product.material_type || MATERIAL_TYPES[0]} options={MATERIAL_TYPES} onChange={v => saveSelect('material_type', v)} disabled={saving} />
          <div className="pcol-field">
            <label>Material</label>
            <MaterialSearch
              materialType={product.material_type}
              value={locals.material_detail}
              onChange={val => setLocal('material_detail', val)}
              onBlur={() => saveText('material_detail')}
              disabled={saving}
            />
          </div>
          <PcolNum label="Qty" field="quantity" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveNum('quantity')} step="1" disabled={saving} />
          <PcolNum label="Width" field="width" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveNum('width')} step="0.25" disabled={saving} />
          <PcolNum label="Length" field="length" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveNum('length')} step="0.25" disabled={saving} />
          <PcolSelect label="Shape" value={product.shape || SHAPES[0]} options={SHAPES} onChange={v => saveSelect('shape', v)} disabled={saving} />
          {product.shape === 'Custom Shape' && (
            <PcolText label="Shape Detail" field="shape_custom" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveText('shape_custom')} disabled={saving} />
          )}
          <PcolSelect label="Height" value={product.height_name || HEIGHTS[0]} options={HEIGHTS} onChange={v => saveSelect('height_name', v)} disabled={saving} />
          {product.height_name === 'Custom Height' && (
            <PcolText label="Height (in)" field="height_input" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveText('height_input')} disabled={saving} />
          )}
          <PcolSelect label="Base" value={product.base_type || BASE_TYPES[0]} options={BASE_TYPES} onChange={v => saveSelect('base_type', v)} disabled={saving} />
          {(product.material_type === 'Hardwood' || product.material_type === 'Live Edge') && (
            <PcolSelect label="Thickness" value={product.lumber_thickness || THICKNESSES[0]} options={THICKNESSES} onChange={v => saveSelect('lumber_thickness', v)} disabled={saving} optionLabels={THICKNESSES.map(t => t || '\u2014')} />
          )}
          <PcolNum label="Bases/Top" field="bases_per_top" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveNum('bases_per_top')} step="1" disabled={saving} />
        </div>
      )}

      {/* Descriptions section */}
      <div className="pcol-section-header" onClick={() => setDescOpen(v => !v)}>
        <span>Descriptions</span>
        {descOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </div>
      {descOpen && (
        <div className="pcol-fields">
          <PcolText label="Edge Profile" field="edge_profile" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveText('edge_profile')} disabled={saving} />
          <PcolText label="Stain/Color" field="stain_or_color" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveText('stain_or_color')} disabled={saving} />
          <PcolText label="Color Name" field="color_name" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveText('color_name')} disabled={saving} />
          <PcolText label="Sheen" field="sheen" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveText('sheen')} disabled={saving} />
          <PcolText label="Notes" field="notes" locals={locals} setLocal={setLocal} focusRef={focusRef} onBlur={() => saveText('notes')} disabled={saving} />
        </div>
      )}

    </div>
  )
}

// -- Sub-components for compact inputs --

function PcolText({ label, field, locals, setLocal, focusRef, onBlur, placeholder, disabled }) {
  return (
    <div className="pcol-field">
      <label>{label}</label>
      <input
        type="text"
        value={locals[field] ?? ''}
        onChange={e => setLocal(field, e.target.value)}
        onFocus={() => { focusRef.current = field }}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

function PcolNum({ label, field, locals, setLocal, focusRef, onBlur, step, disabled }) {
  return (
    <div className="pcol-field">
      <label>{label}</label>
      <input
        type="number"
        step={step}
        value={locals[field] ?? ''}
        onChange={e => setLocal(field, e.target.value)}
        onFocus={() => { focusRef.current = field }}
        onBlur={onBlur}
        disabled={disabled}
      />
    </div>
  )
}

function PcolSelect({ label, value, options, onChange, disabled, optionLabels }) {
  return (
    <div className="pcol-field">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}>
        {options.map((o, i) => <option key={o} value={o}>{optionLabels ? optionLabels[i] : o}</option>)}
      </select>
    </div>
  )
}
