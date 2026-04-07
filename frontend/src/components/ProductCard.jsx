import { useState, useRef, useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import { products } from '../api/client'

function formatPrice(val) {
  if (!val && val !== 0) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MATERIAL_TYPES = ['Hardwood', 'Stone', 'Live Edge', 'Laminate', 'Wood Edge Laminate', 'Outdoor', 'Other']
const SHAPES = ['Standard', 'DIA', 'Custom Shape', 'Base Only']
const HEIGHTS = ['Dining Height', 'Counter Height', 'Bar Height', 'Top Only', 'Custom Height']
const BASE_TYPES = ['Stock Base', 'Custom Base', 'Top Only']

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
    try {
      const updated = await products.update(optionId, product.id, { [field]: value })
      clearDraft(key)
      setError('')
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to update product')
    }
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

  async function handleDeleteProduct() {
    if (!window.confirm('Delete this product?')) return
    try {
      const updated = await products.delete(optionId, product.id)
      onUpdate(updated)
    } catch (err) {
      setError(err.message || 'Failed to delete product')
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

        <div className="subsection-title">General Specs</div>
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

        <div className="subsection-title">Descriptions</div>
        <div className="spec-grid">
          <div className="field"><label>Material Detail</label><input value={productValue('material_detail')} onChange={e => onProductChange('material_detail', e.target.value)} onBlur={e => onProductBlur('material_detail', e.target.value)} /></div>
          <div className="field"><label>Edge Profile</label><input value={productValue('edge_profile')} onChange={e => onProductChange('edge_profile', e.target.value)} onBlur={e => onProductBlur('edge_profile', e.target.value)} /></div>
          <div className="field"><label>Stain / Color</label><input value={productValue('stain_or_color')} onChange={e => onProductChange('stain_or_color', e.target.value)} onBlur={e => onProductBlur('stain_or_color', e.target.value)} /></div>
          <div className="field"><label>Color Name</label><input value={productValue('color_name')} onChange={e => onProductChange('color_name', e.target.value)} onBlur={e => onProductBlur('color_name', e.target.value)} /></div>
          <div className="field"><label>Sheen</label><input value={productValue('sheen')} onChange={e => onProductChange('sheen', e.target.value)} onBlur={e => onProductBlur('sheen', e.target.value)} /></div>
          <div className="field"><label>Notes</label><input value={productValue('notes')} onChange={e => onProductChange('notes', e.target.value)} onBlur={e => onProductBlur('notes', e.target.value)} /></div>
        </div>

        <div className="subsection-title">Final Pricing</div>
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
