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

export default function MaterialBuilder({ product, onQuoteUpdate }) {
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

  const [width, setWidth] = useState(String(comp.width ?? ''))
  const [length, setLength] = useState(String(comp.length ?? ''))
  const [thickness, setThickness] = useState(String(comp.thickness ?? ''))
  const [qtyPerBase, setQtyPerBase] = useState(String(comp.qty_per_base ?? 1))
  const [material, setMaterial] = useState(comp.material || '')
  const [description, setDescription] = useState(comp.description || '')
  const focusRef = useRef(null)

  const ssWidth = useSpreadsheetInput(setWidth)
  const ssLength = useSpreadsheetInput(setLength)
  const ssThickness = useSpreadsheetInput(setThickness)
  const ssQty = useSpreadsheetInput(setQtyPerBase)
  const ssMaterial = useSpreadsheetInput(setMaterial)
  const ssDescription = useSpreadsheetInput(setDescription)

  // Sync from props when not focused
  const prevRef = useRef(comp)
  if (prevRef.current !== comp) {
    if (focusRef.current !== 'width') setWidth(String(comp.width ?? ''))
    if (focusRef.current !== 'length') setLength(String(comp.length ?? ''))
    if (focusRef.current !== 'thickness') setThickness(String(comp.thickness ?? ''))
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
            <MBInput label="W" value={width} onChange={setWidth} ss={ssWidth}
              onFocus={() => { focusRef.current = 'width' }}
              onBlur={() => saveNum('width', width, setWidth)} step="0.25" />
            <MBInput label="L" value={length} onChange={setLength} ss={ssLength}
              onFocus={() => { focusRef.current = 'length' }}
              onBlur={() => saveNum('length', length, setLength)} step="0.25" />
            {isWood && (
              <MBInput label="T" value={thickness} onChange={setThickness} ss={ssThickness}
                onFocus={() => { focusRef.current = 'thickness' }}
                onBlur={() => saveNum('thickness', thickness, setThickness)} step="0.25" />
            )}
            <MBInput label="Qty" value={qtyPerBase} onChange={setQtyPerBase} ss={ssQty}
              onFocus={() => { focusRef.current = 'qtyPerBase' }}
              onBlur={() => saveNum('qty_per_base', qtyPerBase, setQtyPerBase)} step="1" />
            {isWood && (
              <div className="mb-field">
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
