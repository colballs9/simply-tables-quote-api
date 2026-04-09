import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { components } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

const COMPONENT_TYPES = [
  { value: 'plank', label: 'Plank' },
  { value: 'leg', label: 'Leg/Beam' },
  { value: 'apron_l', label: 'Apron L' },
  { value: 'apron_w', label: 'Apron W' },
  { value: 'metal_part', label: 'Metal Part' },
  { value: 'other', label: 'Other' },
]

const WOOD_TYPES = ['plank', 'leg', 'apron_l', 'apron_w']

// Raw thickness (inches) → display label
const LUMBER_THICKNESS_OPTIONS = [
  { value: '', label: '\u2014' },
  { value: '1', label: '4/4' },
  { value: '1.5', label: '6/4' },
  { value: '2', label: '8/4' },
  { value: '2.5', label: '10/4' },
]

export default function MaterialBuilder({ product, onQuoteUpdate, compact }) {
  const [open, setOpen] = useState(false)
  const comps = product.components || []

  async function handleAdd(type) {
    try {
      const updated = await components.add(product.id, {
        component_type: type,
        description: '',
        width: 0,
        length: 0,
        thickness: 0,
        qty_per_base: 1,
      })
      onQuoteUpdate(updated)
      if (!open) setOpen(true)
    } catch (err) {
      console.error('Failed to add component:', err)
    }
  }

  async function handleDelete(compId) {
    try {
      const updated = await components.delete(product.id, compId)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to delete component:', err)
    }
  }

  async function handleUpdate(compId, data) {
    try {
      const updated = await components.update(product.id, compId, data)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update component:', err)
    }
  }

  // Compact mode: no section header, always show content (used in grid row layout)
  if (compact) {
    return (
      <div className="mb-section">
        {comps.map(comp => (
          <ComponentRow
            key={comp.id}
            comp={comp}
            productId={product.id}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
        <div className="mb-add-row">
          {COMPONENT_TYPES.map(t => (
            <button
              key={t.value}
              className="mb-add-btn"
              onClick={() => handleAdd(t.value)}
              title={`Add ${t.label}`}
            >
              <Plus size={10} /> {t.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="pcol-section-header" onClick={() => setOpen(v => !v)}>
        <span>Material Builder {comps.length > 0 && `(${comps.length})`}</span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </div>
      {open && (
        <div className="mb-section">
          {comps.map(comp => (
            <ComponentRow
              key={comp.id}
              comp={comp}
              productId={product.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
          <div className="mb-add-row">
            {COMPONENT_TYPES.map(t => (
              <button
                key={t.value}
                className="mb-add-btn"
                onClick={() => handleAdd(t.value)}
                title={`Add ${t.label}`}
              >
                <Plus size={10} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}


function ComponentRow({ comp, productId, onUpdate, onDelete }) {
  const isWood = WOOD_TYPES.includes(comp.component_type)

  const [length, setLength] = useState(String(comp.length ?? ''))
  const [width, setWidth] = useState(String(comp.width ?? ''))
  const [depth, setDepth] = useState(String(comp.depth ?? ''))
  const [qtyPerBase, setQtyPerBase] = useState(String(comp.qty_per_base ?? 1))
  const [material, setMaterial] = useState(comp.material || '')
  const [description, setDescription] = useState(comp.description || '')
  const focusRef = useRef(null)

  const ssLength = useSpreadsheetInput(setLength)
  const ssWidth = useSpreadsheetInput(setWidth)
  const ssDepth = useSpreadsheetInput(setDepth)
  const ssQty = useSpreadsheetInput(setQtyPerBase)
  const ssMaterial = useSpreadsheetInput(setMaterial)
  const ssDescription = useSpreadsheetInput(setDescription)

  // Sync from props when not focused
  const prevRef = useRef(comp)
  if (prevRef.current !== comp) {
    if (focusRef.current !== 'length') setLength(String(comp.length ?? ''))
    if (focusRef.current !== 'width') setWidth(String(comp.width ?? ''))
    if (focusRef.current !== 'depth') setDepth(String(comp.depth ?? ''))
    if (focusRef.current !== 'qtyPerBase') setQtyPerBase(String(comp.qty_per_base ?? 1))
    if (focusRef.current !== 'material') setMaterial(comp.material || '')
    if (focusRef.current !== 'description') setDescription(comp.description || '')
    prevRef.current = comp
  }

  function saveNum(field, localVal, setter) {
    focusRef.current = null
    const val = parseFloat(localVal)
    if (isNaN(val)) return
    if (val !== comp[field]) onUpdate(comp.id, { [field]: val })
  }

  function saveText(field, localVal) {
    focusRef.current = null
    if (localVal !== (comp[field] || '')) onUpdate(comp.id, { [field]: localVal || null })
  }

  const typeLabel = COMPONENT_TYPES.find(t => t.value === comp.component_type)?.label || comp.component_type

  return (
    <div className="mb-component">
      <div className="mb-component-header">
        <select
          className="mb-type-select"
          value={comp.component_type}
          onChange={e => onUpdate(comp.id, { component_type: e.target.value })}
        >
          {COMPONENT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <button className="mb-delete-btn" onClick={() => onDelete(comp.id)} title="Remove component">
          <Trash2 size={10} />
        </button>
      </div>

      <div className="mb-fields">
        {comp.component_type !== 'other' ? (
          <>
            {/* Dimensions: L × W × D */}
            <MBInput label="L" value={length} onChange={setLength} ss={ssLength}
              onFocus={() => { focusRef.current = 'length' }}
              onBlur={() => saveNum('length', length, setLength)} step="0.25" />
            <MBInput label="W" value={width} onChange={setWidth} ss={ssWidth}
              onFocus={() => { focusRef.current = 'width' }}
              onBlur={() => saveNum('width', width, setWidth)} step="0.25" />
            <MBInput label="D" value={depth} onChange={setDepth} ss={ssDepth}
              onFocus={() => { focusRef.current = 'depth' }}
              onBlur={() => saveNum('depth', depth, setDepth)} step="0.25" />
            <MBInput label="Qty" value={qtyPerBase} onChange={setQtyPerBase} ss={ssQty}
              onFocus={() => { focusRef.current = 'qtyPerBase' }}
              onBlur={() => saveNum('qty_per_base', qtyPerBase, setQtyPerBase)} step="1" />
            {/* Lumber selection: thickness + species (wood types only) */}
            {isWood && (
              <div className="mb-lumber-row">
                <div className="mb-field">
                  <label>Lumber</label>
                  <select
                    className="mb-type-select"
                    value={String(comp.thickness ?? '')}
                    onChange={e => {
                      const val = e.target.value ? parseFloat(e.target.value) : null
                      onUpdate(comp.id, { thickness: val })
                    }}
                  >
                    {LUMBER_THICKNESS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-field mb-field--wide">
                  <label>Species</label>
                  <input
                    type="text"
                    className="mb-input mb-input--text"
                    value={material}
                    onChange={e => setMaterial(e.target.value)}
                    onFocus={e => { focusRef.current = 'material'; ssMaterial.onFocus(e) }}
                    onBlur={() => saveText('material', material)}
                    onKeyDown={ssMaterial.onKeyDown}
                    placeholder="Species..."
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mb-field mb-field--wide">
            <label>Desc</label>
            <input
              type="text"
              className="mb-input mb-input--text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onFocus={e => { focusRef.current = 'description'; ssDescription.onFocus(e) }}
              onBlur={() => saveText('description', description)}
              onKeyDown={ssDescription.onKeyDown}
              placeholder="Description..."
            />
          </div>
        )}
      </div>

      {/* Computed values */}
      <div className="mb-computed">
        {isWood && comp.bd_ft_pp != null && (
          <span className="mb-computed-val">
            {Number(comp.bd_ft_pp).toFixed(2)} <span className="mb-computed-unit">bdft</span>
          </span>
        )}
        {comp.component_type !== 'other' && comp.sq_ft_pp != null && (
          <span className="mb-computed-val">
            {Number(comp.sq_ft_pp).toFixed(2)} <span className="mb-computed-unit">sqft</span>
          </span>
        )}
      </div>
    </div>
  )
}


function MBInput({ label, value, onChange, ss, onFocus, onBlur, step }) {
  return (
    <div className="mb-field">
      <label>{label}</label>
      <input
        type="number"
        className="mb-input"
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => { onFocus(); ss.onFocus(e) }}
        onBlur={onBlur}
        onKeyDown={ss.onKeyDown}
      />
    </div>
  )
}
