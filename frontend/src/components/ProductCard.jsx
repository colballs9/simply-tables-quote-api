import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Trash2, Plus, X } from 'lucide-react'
import { products, costBlocks, laborBlocks } from '../api/client'

function formatPrice(val) {
  if (!val && val !== 0) return '—'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MATERIAL_TYPES = ['Hardwood', 'Stone', 'Live Edge', 'Laminate', 'Wood Edge Laminate', 'Outdoor', 'Other']
const SHAPES = ['Standard', 'DIA', 'Custom Shape', 'Base Only']
const HEIGHTS = ['Dining Height', 'Counter Height', 'Bar Height', 'Top Only', 'Custom Height']
const BASE_TYPES = ['Stock Base', 'Custom Base', 'Top Only']
const COST_CATEGORIES = ['species', 'stone', 'stock_base', 'powder_coat', 'unit_cost', 'unit_cost_base', 'custom_base', 'misc', 'consumables', 'other']
const MULTIPLIER_TYPES = ['fixed', 'per_base', 'per_sqft', 'per_bdft']
const LABOR_CENTERS = ['LC100', 'LC101', 'LC102', 'LC103', 'LC104', 'LC105', 'LC106', 'LC107', 'LC108', 'LC109', 'LC110', 'LC111']

// Debounce helper
function useDebounce(fn, delay = 500) {
  const timer = useRef(null)
  return (...args) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), delay)
  }
}

export default function ProductCard({ product, optionId, quoteId, onUpdate }) {
  const [expanded, setExpanded] = useState(true)
  const [localFields, setLocalFields] = useState({})
  const [error, setError] = useState('')

  // Debounced save for product fields
  const debouncedSave = useDebounce(async (field, value) => {
    try {
      const updated = await products.update(optionId, product.id, { [field]: value })
      setLocalFields(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update product:', err)
      setError(err.message || 'Failed to update product')
    }
  }, 600)

  function handleFieldChange(field, value, isNumeric = false) {
    const parsed = isNumeric ? (value === '' ? null : Number(value)) : value
    setLocalFields(prev => ({ ...prev, [field]: value }))
    debouncedSave(field, parsed)
  }

  function getFieldValue(field) {
    if (field in localFields) return localFields[field]
    return product[field] ?? ''
  }

  async function handleDeleteProduct() {
    if (!confirm('Delete this product?')) return
    try {
      const updated = await products.delete(optionId, product.id)
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to delete product:', err)
      setError(err.message || 'Failed to delete product')
    }
  }

  // ── Cost block handlers ──
  async function handleAddCostBlock() {
    try {
      const updated = await costBlocks.add(product.id, {
        cost_category: 'unit_cost',
        description: '',
        cost_per_unit: 0,
        multiplier_type: 'fixed',
        units_per_product: 1,
      })
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to add cost block:', err)
      setError(err.message || 'Failed to add cost block')
    }
  }

  async function handleCostBlockChange(blockId, field, value) {
    try {
      const updated = await costBlocks.update(product.id, blockId, { [field]: value })
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update cost block:', err)
      setError(err.message || 'Failed to update cost block')
    }
  }

  async function handleDeleteCostBlock(blockId) {
    try {
      const updated = await costBlocks.delete(product.id, blockId)
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to delete cost block:', err)
      setError(err.message || 'Failed to delete cost block')
    }
  }

  // ── Labor block handlers ──
  async function handleAddLaborBlock() {
    try {
      const updated = await laborBlocks.add(product.id, {
        labor_center: 'LC105',
        block_type: 'unit',
        description: '',
        hours_per_unit: 0,
        is_active: true,
      })
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to add labor block:', err)
      setError(err.message || 'Failed to add labor block')
    }
  }

  async function handleLaborBlockChange(blockId, field, value) {
    try {
      const updated = await laborBlocks.update(product.id, blockId, { [field]: value })
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to update labor block:', err)
      setError(err.message || 'Failed to update labor block')
    }
  }

  async function handleDeleteLaborBlock(blockId) {
    try {
      const updated = await laborBlocks.delete(product.id, blockId)
      setError('')
      onUpdate(updated)
    } catch (err) {
      console.error('Failed to delete labor block:', err)
      setError(err.message || 'Failed to delete labor block')
    }
  }

  return (
    <div className="product-card">
      {/* Header — always visible */}
      <div className="product-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="product-card-title">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <h3>{product.title || 'Untitled Product'}</h3>
          <span className="product-material-badge">{product.material_type}</span>
          {product.quantity > 1 && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>×{product.quantity}</span>
          )}
        </div>
        <div className="product-card-summary">
          <div className="summary-stat">
            <div className="label">Material</div>
            <div className="value cost-val">{formatPrice(product.total_material_cost)}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Hours</div>
            <div className="value hours-val">{product.total_hours_pp ? `${Number(product.total_hours_pp).toFixed(1)}h` : '—'}</div>
          </div>
          <div className="summary-stat">
            <div className="label">Sale Price</div>
            <div className="value price-val">{formatPrice(product.sale_price_pp)}</div>
          </div>
        </div>
      </div>

      {/* Body — expandable */}
      {expanded && (
        <div className="product-card-body fade-in">
          {error && (
            <div className="notice notice-error compact-notice">
              <strong>Product update failed.</strong>
              <span>{error}</span>
            </div>
          )}

          {/* ── Specs ── */}
          <div className="spec-grid">
            <div className="field">
              <label>Title</label>
              <input value={getFieldValue('title')} onChange={e => handleFieldChange('title', e.target.value)} placeholder="Table 1" />
            </div>
            <div className="field">
              <label>Material</label>
              <select value={getFieldValue('material_type')} onChange={e => handleFieldChange('material_type', e.target.value)}>
                {MATERIAL_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Quantity</label>
              <input type="number" min="1" value={getFieldValue('quantity')} onChange={e => handleFieldChange('quantity', e.target.value, true)} />
            </div>
            <div className="field">
              <label>Width (in)</label>
              <input type="number" step="0.25" value={getFieldValue('width')} onChange={e => handleFieldChange('width', e.target.value, true)} placeholder="36" />
            </div>
            <div className="field">
              <label>Length (in)</label>
              <input type="number" step="0.25" value={getFieldValue('length')} onChange={e => handleFieldChange('length', e.target.value, true)} placeholder="48" />
            </div>
            <div className="field">
              <label>Shape</label>
              <select value={getFieldValue('shape')} onChange={e => handleFieldChange('shape', e.target.value)}>
                {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Height</label>
              <select value={getFieldValue('height_name')} onChange={e => handleFieldChange('height_name', e.target.value)}>
                {HEIGHTS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Base Type</label>
              <select value={getFieldValue('base_type')} onChange={e => handleFieldChange('base_type', e.target.value)}>
                {BASE_TYPES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Bases Per Top</label>
              <input type="number" min="1" value={getFieldValue('bases_per_top')} onChange={e => handleFieldChange('bases_per_top', e.target.value, true)} />
            </div>
            {(product.material_type === 'Hardwood' || product.material_type === 'Live Edge') && (
              <div className="field">
                <label>Lumber Thickness</label>
                <select value={getFieldValue('lumber_thickness')} onChange={e => handleFieldChange('lumber_thickness', e.target.value)}>
                  <option value="">Select...</option>
                  {['.75"', '1"', '1.25"', '1.5"', '1.75"', '2"', '2.25"'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Computed dimensions */}
          {(product.sq_ft || product.bd_ft) && (
            <div style={{ display: 'flex', gap: 20, fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {product.sq_ft > 0 && <span>{Number(product.sq_ft).toFixed(2)} sq ft</span>}
              {product.bd_ft > 0 && <span>{Number(product.bd_ft).toFixed(2)} bd ft</span>}
            </div>
          )}

          {/* ── Cost Blocks ── */}
          <div className="blocks-section cost-section">
            <div className="blocks-section-header">
              <span className="blocks-section-title">Cost Blocks</span>
              <button className="btn btn-cost btn-sm" onClick={handleAddCostBlock}>
                <Plus size={14} /> Add Cost
              </button>
            </div>

            {product.cost_blocks?.length > 0 ? (
              <>
                {/* Column headers */}
                <div className="block-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Cost/Unit</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Cost PP</span>
                  <span></span>
                </div>
                {product.cost_blocks.map(block => (
                  <div key={block.id} className="block-row">
                    <input
                      value={block.description || ''}
                      onChange={e => handleCostBlockChange(block.id, 'description', e.target.value)}
                      placeholder="Description..."
                    />
                    <select
                      value={block.cost_category}
                      onChange={e => handleCostBlockChange(block.id, 'cost_category', e.target.value)}
                    >
                      {COST_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={block.cost_per_unit || ''}
                      onChange={e => handleCostBlockChange(block.id, 'cost_per_unit', e.target.value ? parseFloat(e.target.value) : 0)}
                      style={{ textAlign: 'right' }}
                    />
                    <span className="block-computed" style={{ color: 'var(--cost-text)' }}>
                      {formatPrice(block.cost_pp)}
                    </span>
                    <button className="block-delete" onClick={() => handleDeleteCostBlock(block.id)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No cost blocks yet</p>
            )}
          </div>

          {/* ── Labor Blocks ── */}
          <div className="blocks-section hours-section">
            <div className="blocks-section-header">
              <span className="blocks-section-title">Labor Blocks</span>
              <button className="btn btn-hours btn-sm" onClick={handleAddLaborBlock}>
                <Plus size={14} /> Add Hours
              </button>
            </div>

            {product.labor_blocks?.length > 0 ? (
              <>
                <div className="block-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Labor Center</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Hrs/Unit</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right' }}>Hrs PP</span>
                  <span></span>
                </div>
                {product.labor_blocks.map(block => (
                  <div key={block.id} className="block-row">
                    <input
                      value={block.description || ''}
                      onChange={e => handleLaborBlockChange(block.id, 'description', e.target.value)}
                      placeholder="Description..."
                    />
                    <select
                      value={block.labor_center}
                      onChange={e => handleLaborBlockChange(block.id, 'labor_center', e.target.value)}
                    >
                      {LABOR_CENTERS.map(lc => <option key={lc} value={lc}>{lc}</option>)}
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      value={block.hours_per_unit || ''}
                      onChange={e => handleLaborBlockChange(block.id, 'hours_per_unit', e.target.value ? parseFloat(e.target.value) : 0)}
                      style={{ textAlign: 'right' }}
                    />
                    <span className="block-computed" style={{ color: 'var(--hours-text)' }}>
                      {block.hours_pp ? `${Number(block.hours_pp).toFixed(2)}h` : '—'}
                    </span>
                    <button className="block-delete" onClick={() => handleDeleteLaborBlock(block.id)}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No labor blocks yet</p>
            )}
          </div>

          {/* ── Pricing Summary ── */}
          <div className="pricing-summary">
            <div className="pricing-item">
              <span className="label">Material Cost</span>
              <span className="value" style={{ color: 'var(--cost-text)' }}>{formatPrice(product.total_material_cost)}</span>
            </div>
            <div className="pricing-item">
              <span className="label">Material Price</span>
              <span className="value">{formatPrice(product.total_material_price)}</span>
            </div>
            <div className="pricing-item">
              <span className="label">Hours</span>
              <span className="value" style={{ color: 'var(--hours-text)' }}>{product.total_hours_pp ? `${Number(product.total_hours_pp).toFixed(2)}h` : '—'}</span>
            </div>
            <div className="pricing-item">
              <span className="label">Hours Price</span>
              <span className="value">{formatPrice(product.hours_price)}</span>
            </div>
            <div className="pricing-item">
              <span className="label">Price PP</span>
              <span className="value">{formatPrice(product.price_pp)}</span>
            </div>
            <div className="pricing-item">
              <span className="label">Sale Price</span>
              <span className="value final">{formatPrice(product.sale_price_pp)}</span>
            </div>
            <div className="pricing-item">
              <span className="label">Line Total (×{product.quantity})</span>
              <span className="value final">{formatPrice(product.sale_price_total)}</span>
            </div>
          </div>

          {/* Delete product */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-danger btn-sm" onClick={handleDeleteProduct}>
              <Trash2 size={14} /> Remove Product
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
