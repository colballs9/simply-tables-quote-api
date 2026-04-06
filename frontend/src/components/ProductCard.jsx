import { useState, useRef, useEffect } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import { products, costBlocks, laborBlocks } from '../api/client'

function formatPrice(val) {
  if (!val && val !== 0) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MATERIAL_TYPES = ['Hardwood', 'Stone', 'Live Edge', 'Laminate', 'Wood Edge Laminate', 'Outdoor', 'Other']
const SHAPES = ['Standard', 'DIA', 'Custom Shape', 'Base Only']
const HEIGHTS = ['Dining Height', 'Counter Height', 'Bar Height', 'Top Only', 'Custom Height']
const BASE_TYPES = ['Stock Base', 'Custom Base', 'Top Only']
const COST_CATEGORIES = ['species', 'stone', 'stock_base', 'powder_coat', 'unit_cost', 'unit_cost_base', 'custom_base', 'misc', 'consumables', 'other']
const MULTIPLIER_TYPES = ['fixed', 'per_base', 'per_sqft', 'per_bdft']
const LABOR_CENTERS = ['LC100', 'LC101', 'LC102', 'LC103', 'LC104', 'LC105', 'LC106', 'LC107', 'LC108', 'LC109', 'LC110', 'LC111']

function useDebounceMap(delay = 500) {
  const timersRef = useRef({})

  function schedule(key, fn) {
    clearTimeout(timersRef.current[key])
    timersRef.current[key] = setTimeout(fn, delay)
  }

  function flush(key, fn) {
    clearTimeout(timersRef.current[key])
    fn()
  }

  function clearAll() {
    Object.values(timersRef.current).forEach(clearTimeout)
    timersRef.current = {}
  }

  return { schedule, flush, clearAll }
}

export default function ProductCard({ product, optionId, onUpdate, mode = 'card' }) {
  const [drafts, setDrafts] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const debounce = useDebounceMap()

  useEffect(() => () => debounce.clearAll(), [])

  function setDraft(key, value) {
    setDrafts(prev => ({ ...prev, [key]: value }))
  }

  function clearDraft(key) {
    setDrafts(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  function getDraftValue(key, fallback = '') {
    return key in drafts ? drafts[key] : (fallback ?? '')
  }

  async function updateProductField(field, value, key) {
    setSaving(true)
    try {
      const updated = await products.update(optionId, product.id, { [field]: value })
      clearDraft(key)
      setError('')
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to update product')
    }
    setSaving(false)
  }

  function onProductChange(field, value, isNumeric = false) {
    const key = `p:${field}`
    setDraft(key, value)
    const parsed = isNumeric ? (value === '' ? null : Number(value)) : value
    debounce.schedule(key, () => updateProductField(field, parsed, key))
  }

  function onProductBlur(field, value, isNumeric = false) {
    const key = `p:${field}`
    const parsed = isNumeric ? (value === '' ? null : Number(value)) : value
    debounce.flush(key, () => updateProductField(field, parsed, key))
  }

  function productValue(field) {
    return getDraftValue(`p:${field}`, product[field] ?? '')
  }

  async function updateCostField(blockId, field, value, key) {
    setSaving(true)
    try {
      const updated = await costBlocks.update(product.id, blockId, { [field]: value })
      clearDraft(key)
      setError('')
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to update cost block')
    }
    setSaving(false)
  }

  function onCostChange(blockId, field, value, isNumeric = false, fallbackZero = false) {
    const key = `c:${blockId}:${field}`
    setDraft(key, value)
    const parsed = isNumeric ? (value === '' ? (fallbackZero ? 0 : null) : Number(value)) : value
    debounce.schedule(key, () => updateCostField(blockId, field, parsed, key))
  }

  function onCostBlur(blockId, field, value, isNumeric = false, fallbackZero = false) {
    const key = `c:${blockId}:${field}`
    const parsed = isNumeric ? (value === '' ? (fallbackZero ? 0 : null) : Number(value)) : value
    debounce.flush(key, () => updateCostField(blockId, field, parsed, key))
  }

  function costValue(block, field) {
    return getDraftValue(`c:${block.id}:${field}`, block[field] ?? '')
  }

  async function updateLaborField(blockId, field, value, key) {
    setSaving(true)
    try {
      const updated = await laborBlocks.update(product.id, blockId, { [field]: value })
      clearDraft(key)
      setError('')
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to update labor block')
    }
    setSaving(false)
  }

  function onLaborChange(blockId, field, value, isNumeric = false, fallbackZero = false) {
    const key = `l:${blockId}:${field}`
    setDraft(key, value)
    const parsed = isNumeric ? (value === '' ? (fallbackZero ? 0 : null) : Number(value)) : value
    debounce.schedule(key, () => updateLaborField(blockId, field, parsed, key))
  }

  function onLaborBlur(blockId, field, value, isNumeric = false, fallbackZero = false) {
    const key = `l:${blockId}:${field}`
    const parsed = isNumeric ? (value === '' ? (fallbackZero ? 0 : null) : Number(value)) : value
    debounce.flush(key, () => updateLaborField(blockId, field, parsed, key))
  }

  function laborValue(block, field) {
    return getDraftValue(`l:${block.id}:${field}`, block[field] ?? '')
  }

  async function handleDeleteProduct() {
    if (!window.confirm('Delete this product?')) return
    try {
      const updated = await products.delete(optionId, product.id)
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to delete product')
    }
  }

  async function handleAddCostBlock() {
    try {
      const updated = await costBlocks.add(product.id, { cost_category: 'unit_cost', description: '', cost_per_unit: 0, multiplier_type: 'fixed', units_per_product: 1 })
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to add cost block')
    }
  }

  async function handleDeleteCostBlock(blockId) {
    try {
      const updated = await costBlocks.delete(product.id, blockId)
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to delete cost block')
    }
  }

  async function handleAddLaborBlock() {
    try {
      const updated = await laborBlocks.add(product.id, { labor_center: 'LC105', block_type: 'unit', description: '', hours_per_unit: 0, is_active: true })
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to add labor block')
    }
  }

  async function handleDeleteLaborBlock(blockId) {
    try {
      const updated = await laborBlocks.delete(product.id, blockId)
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to delete labor block')
    }
  }

  return (
    <div className={`product-card ${mode === 'column' ? 'product-card-column' : ''}`}>
      <div className="product-card-header">
        <div className="product-card-title">
          <h3>{product.title || 'Untitled Product'}</h3>
          <span className="product-material-badge">{product.material_type}</span>
          {product.quantity > 1 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>x{product.quantity}</span>}
        </div>
      </div>

      <div className="product-card-body fade-in">
        {error && <div className="notice notice-error compact-notice"><strong>Product update failed.</strong><span>{error}</span></div>}
        {saving && <div className="muted-copy" style={{ fontSize: '0.75rem' }}>Saving changes...</div>}

        <div className="spec-grid">
          <div className="field"><label>Title</label><input value={productValue('title')} onChange={e => onProductChange('title', e.target.value)} onBlur={e => onProductBlur('title', e.target.value)} /></div>
          <div className="field"><label>Material</label><select value={productValue('material_type')} onChange={e => onProductChange('material_type', e.target.value)} onBlur={e => onProductBlur('material_type', e.target.value)}>{MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="field"><label>Quantity</label><input type="number" min="1" value={productValue('quantity')} onChange={e => onProductChange('quantity', e.target.value, true)} onBlur={e => onProductBlur('quantity', e.target.value, true)} /></div>
          <div className="field"><label>Width</label><input type="number" step="0.25" value={productValue('width')} onChange={e => onProductChange('width', e.target.value, true)} onBlur={e => onProductBlur('width', e.target.value, true)} /></div>
          <div className="field"><label>Length</label><input type="number" step="0.25" value={productValue('length')} onChange={e => onProductChange('length', e.target.value, true)} onBlur={e => onProductBlur('length', e.target.value, true)} /></div>
          <div className="field"><label>Shape</label><select value={productValue('shape')} onChange={e => onProductChange('shape', e.target.value)} onBlur={e => onProductBlur('shape', e.target.value)}>{SHAPES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div className="field"><label>Height</label><select value={productValue('height_name')} onChange={e => onProductChange('height_name', e.target.value)} onBlur={e => onProductBlur('height_name', e.target.value)}>{HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
          <div className="field"><label>Base Type</label><select value={productValue('base_type')} onChange={e => onProductChange('base_type', e.target.value)} onBlur={e => onProductBlur('base_type', e.target.value)}>{BASE_TYPES.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
        </div>

        <div className="blocks-section cost-section">
          <div className="blocks-section-header"><span className="blocks-section-title">Cost Blocks</span><button className="btn btn-cost btn-sm" onClick={handleAddCostBlock}><Plus size={14} /> Add Cost</button></div>
          {product.cost_blocks?.length > 0 ? (
            <>
              <div className="block-row block-row-cost block-row-header"><span>Description</span><span>Category</span><span>Multiplier</span><span>Units</span><span>Cost/Unit</span><span>Cost PP</span><span></span></div>
              {product.cost_blocks.map(block => (
                <div key={block.id} className="block-row block-row-cost">
                  <input value={costValue(block, 'description')} onChange={e => onCostChange(block.id, 'description', e.target.value)} onBlur={e => onCostBlur(block.id, 'description', e.target.value)} />
                  <select value={costValue(block, 'cost_category')} onChange={e => onCostChange(block.id, 'cost_category', e.target.value)} onBlur={e => onCostBlur(block.id, 'cost_category', e.target.value)}>{COST_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select>
                  <select value={costValue(block, 'multiplier_type')} onChange={e => onCostChange(block.id, 'multiplier_type', e.target.value)} onBlur={e => onCostBlur(block.id, 'multiplier_type', e.target.value)}>{MULTIPLIER_TYPES.map(m => <option key={m} value={m}>{m}</option>)}</select>
                  <input type="number" step="0.01" value={costValue(block, 'units_per_product')} onChange={e => onCostChange(block.id, 'units_per_product', e.target.value, true, true)} onBlur={e => onCostBlur(block.id, 'units_per_product', e.target.value, true, true)} />
                  <input type="number" step="0.01" value={costValue(block, 'cost_per_unit')} onChange={e => onCostChange(block.id, 'cost_per_unit', e.target.value, true, true)} onBlur={e => onCostBlur(block.id, 'cost_per_unit', e.target.value, true, true)} />
                  <span className="block-computed" style={{ color: 'var(--cost-text)' }}>{formatPrice(block.cost_pp)}</span>
                  <button className="block-delete" onClick={() => handleDeleteCostBlock(block.id)}><X size={14} /></button>
                </div>
              ))}
            </>
          ) : <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No cost blocks yet</p>}
        </div>

        <div className="blocks-section hours-section">
          <div className="blocks-section-header"><span className="blocks-section-title">Labor Blocks</span><button className="btn btn-hours btn-sm" onClick={handleAddLaborBlock}><Plus size={14} /> Add Hours</button></div>
          {product.labor_blocks?.length > 0 ? (
            <>
              <div className="block-row block-row-labor block-row-header"><span>Description</span><span>Labor Center</span><span>Block Type</span><span>Hrs/Unit</span><span>Hrs PP</span><span></span></div>
              {product.labor_blocks.map(block => (
                <div key={block.id} className="block-row block-row-labor">
                  <input value={laborValue(block, 'description')} onChange={e => onLaborChange(block.id, 'description', e.target.value)} onBlur={e => onLaborBlur(block.id, 'description', e.target.value)} />
                  <select value={laborValue(block, 'labor_center')} onChange={e => onLaborChange(block.id, 'labor_center', e.target.value)} onBlur={e => onLaborBlur(block.id, 'labor_center', e.target.value)}>{LABOR_CENTERS.map(lc => <option key={lc} value={lc}>{lc}</option>)}</select>
                  <input value={laborValue(block, 'block_type')} onChange={e => onLaborChange(block.id, 'block_type', e.target.value)} onBlur={e => onLaborBlur(block.id, 'block_type', e.target.value)} />
                  <input type="number" step="0.1" value={laborValue(block, 'hours_per_unit')} onChange={e => onLaborChange(block.id, 'hours_per_unit', e.target.value, true, true)} onBlur={e => onLaborBlur(block.id, 'hours_per_unit', e.target.value, true, true)} />
                  <span className="block-computed" style={{ color: 'var(--hours-text)' }}>{block.hours_pp ? `${Number(block.hours_pp).toFixed(2)}h` : '--'}</span>
                  <button className="block-delete" onClick={() => handleDeleteLaborBlock(block.id)}><X size={14} /></button>
                </div>
              ))}
            </>
          ) : <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No labor blocks yet</p>}
        </div>

        <div className="pricing-summary">
          <div className="pricing-item"><span className="label">Material Cost</span><span className="value" style={{ color: 'var(--cost-text)' }}>{formatPrice(product.total_material_cost)}</span></div>
          <div className="pricing-item"><span className="label">Hours</span><span className="value" style={{ color: 'var(--hours-text)' }}>{product.total_hours_pp ? `${Number(product.total_hours_pp).toFixed(2)}h` : '--'}</span></div>
          <div className="pricing-item"><span className="label">Price PP</span><span className="value">{formatPrice(product.price_pp)}</span></div>
          <div className="pricing-item"><span className="label">Sale Price</span><span className="value final">{formatPrice(product.sale_price_pp)}</span></div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-danger btn-sm" onClick={handleDeleteProduct}><Trash2 size={14} /> Remove Product</button>
        </div>
      </div>
    </div>
  )
}
