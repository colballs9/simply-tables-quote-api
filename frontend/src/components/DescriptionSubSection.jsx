import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { descriptionItems } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

/**
 * A collapsible sub-section within Top/Base Descriptions.
 * Shows fixed field rows + dynamic detail/exception items.
 *
 * Props:
 *   label: "Finishes", "Edge", "Other", "Base"
 *   section: "top_finishes", "top_edge", "top_other", "base"
 *   fields: [{ label, fieldKey, fieldType, options?, ... }]  — fixed fields for this sub-section
 *   products: sorted product list
 *   optionId: active option ID
 *   onQuoteUpdate: callback
 */
export default function DescriptionSubSection({ label, section, fields, products, optionId, onQuoteUpdate }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Sub-section header row */}
      <div
        className="canvas-cell canvas-cell--label canvas-cell--desc-sub-header"
        onClick={() => setOpen(v => !v)}
        style={{ cursor: 'pointer' }}
      >
        <span className="canvas-desc-sub-label">
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {label}
        </span>
      </div>
      <div className="canvas-cell canvas-cell--desc-sub-header-spacer" style={{ gridColumn: '2 / -1' }} />

      {open && (
        <>
          {/* Fixed field rows */}
          {fields.map(f => (
            <DescFieldRow key={f.fieldKey} field={f} products={products} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
          ))}

          {/* Dynamic detail + exception items per product */}
          <DescItemsRow section={section} products={products} onQuoteUpdate={onQuoteUpdate} />
        </>
      )}
    </>
  )
}


/* ── Fixed field row (label + per-product cells) ── */

import ProductFieldCell from './ProductFieldCell'

function DescFieldRow({ field, products, optionId, onQuoteUpdate }) {
  const { label, fieldKey, fieldType, options, optionLabels, step, placeholder, hidden } = field
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--field-label" style={hidden ? { visibility: 'hidden' } : undefined}>
        <span className="pf-label">{label}</span>
      </div>
      {products.map(product => (
        <ProductFieldCell
          key={product.id}
          product={product}
          optionId={optionId}
          fieldKey={fieldKey}
          fieldType={fieldType}
          onQuoteUpdate={onQuoteUpdate}
          options={options}
          optionLabels={optionLabels}
          step={step}
          placeholder={placeholder}
          hidden={hidden}
          materialType={product.material_type}
        />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


/* ── Dynamic detail/exception items row ── */

function DescItemsRow({ section, products, onQuoteUpdate }) {
  return (
    <>
      {/* Label cell with add buttons */}
      <div className="canvas-cell canvas-cell--label canvas-cell--desc-actions">
        <div className="desc-action-buttons">
          {/* Buttons are per-product in the product cells */}
        </div>
      </div>
      {products.map(product => (
        <DescItemsCell key={product.id} product={product} section={section} onQuoteUpdate={onQuoteUpdate} />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function DescItemsCell({ product, section, onQuoteUpdate }) {
  const items = (product.description_items || [])
    .filter(i => i.section === section)
    // Sort: details first, then exceptions, each by sort_order
    .sort((a, b) => {
      if (a.item_type !== b.item_type) return a.item_type === 'detail' ? -1 : 1
      return (a.sort_order || 0) - (b.sort_order || 0)
    })

  const details = items.filter(i => i.item_type === 'detail')
  const exceptions = items.filter(i => i.item_type === 'exception')

  async function handleAdd(itemType) {
    try {
      const updated = await descriptionItems.add(product.id, {
        section,
        item_type: itemType,
        content: '',
        sort_order: items.filter(i => i.item_type === itemType).length,
      })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to add description item:', err)
    }
  }

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--desc-items" style={{ alignItems: 'flex-start' }}>
      <div className="desc-items-content">
        {/* Details */}
        {details.map(item => (
          <DescItemInput key={item.id} item={item} product={product} onQuoteUpdate={onQuoteUpdate} type="detail" />
        ))}
        {/* Exceptions (always below details) */}
        {exceptions.map(item => (
          <DescItemInput key={item.id} item={item} product={product} onQuoteUpdate={onQuoteUpdate} type="exception" />
        ))}
        {/* Action buttons */}
        <div className="desc-item-add-row">
          <button className="desc-item-add-btn" onClick={() => handleAdd('detail')} title="Add detail">
            <Plus size={9} /> Detail
          </button>
          <button className="desc-item-add-btn desc-item-add-btn--exception" onClick={() => handleAdd('exception')} title="Add exception">
            <Plus size={9} /> Exception
          </button>
        </div>
      </div>
    </div>
  )
}


function DescItemInput({ item, product, onQuoteUpdate, type }) {
  const [val, setVal] = useState(item.content || '')
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setVal)

  const prevRef = useRef(item.content)
  if (item.content !== prevRef.current && !focusRef.current) {
    setVal(item.content || '')
  }
  prevRef.current = item.content

  async function save() {
    focusRef.current = null
    if (val !== (item.content || '')) {
      try {
        const updated = await descriptionItems.update(product.id, item.id, { content: val || null })
        onQuoteUpdate(updated)
      } catch (err) {
        console.error('Failed to update description item:', err)
      }
    }
  }

  async function handleDelete() {
    try {
      const updated = await descriptionItems.delete(product.id, item.id)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to delete description item:', err)
    }
  }

  return (
    <div className={`desc-item-row desc-item-row--${type}`}>
      <input
        className="desc-item-input"
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onFocus={e => { focusRef.current = true; ss.onFocus(e) }}
        onBlur={save}
        onKeyDown={ss.onKeyDown}
        placeholder={type === 'detail' ? 'Detail...' : 'Exception...'}
      />
      <button className="desc-item-delete" onClick={handleDelete} title="Remove">
        <Trash2 size={9} />
      </button>
    </div>
  )
}
