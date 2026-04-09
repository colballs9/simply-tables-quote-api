import { useState, useRef } from 'react'
import { products as productsApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

/**
 * A row with multiple fields per product cell.
 * Each field definition: { fieldKey, fieldType, options?, optionLabels?, step?, placeholder?, separator? }
 *
 * separator: string to show between fields (e.g. "x")
 */
export default function ProductMultiFieldRow({ label, fields, products, optionId, onQuoteUpdate }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--field-label">
        <span className="pf-label">{label}</span>
      </div>
      {products.map(product => (
        <MultiCell key={product.id} product={product} fields={fields} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function MultiCell({ product, fields, optionId, onQuoteUpdate }) {
  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--field-value">
      <div className="multi-field-row">
        {fields.map((f, i) => (
          <span key={f.fieldKey} className="multi-field-item">
            {i > 0 && f.separator && <span className="multi-field-sep">{f.separator}</span>}
            <MultiInput field={f} product={product} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
          </span>
        ))}
      </div>
    </div>
  )
}


function MultiInput({ field, product, optionId, onQuoteUpdate }) {
  const { fieldKey, fieldType, options, optionLabels, step, placeholder } = field
  const rawValue = product[fieldKey]

  const [localVal, setLocalVal] = useState(String(rawValue ?? ''))
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalVal)

  const prevRef = useRef(rawValue)
  if (rawValue !== prevRef.current && !focusRef.current) {
    setLocalVal(String(rawValue ?? ''))
  }
  prevRef.current = rawValue

  async function saveValue() {
    focusRef.current = null
    if (fieldType === 'text') {
      if (localVal !== (rawValue || '')) {
        try {
          const updated = await productsApi.update(optionId, product.id, { [fieldKey]: localVal || null })
          onQuoteUpdate(updated)
        } catch (e) { console.error(e) }
      }
    } else {
      const parsed = parseFloat(localVal)
      if (isNaN(parsed)) return
      if (parsed !== rawValue) {
        try {
          const updated = await productsApi.update(optionId, product.id, { [fieldKey]: parsed })
          onQuoteUpdate(updated)
        } catch (e) { console.error(e) }
      }
    }
  }

  async function handleSelectChange(val) {
    try {
      const updated = await productsApi.update(optionId, product.id, { [fieldKey]: val })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
  }

  if (fieldType === 'select') {
    return (
      <select
        className="pfc-select multi-field-select"
        value={rawValue || options?.[0] || ''}
        onChange={e => handleSelectChange(e.target.value)}
      >
        {(options || []).map((o, i) => (
          <option key={o} value={o}>{optionLabels ? optionLabels[i] : o}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      className="pfc-input multi-field-input"
      type={fieldType === 'number' ? 'number' : 'text'}
      step={step}
      value={localVal}
      onChange={e => setLocalVal(e.target.value)}
      onFocus={e => { focusRef.current = fieldKey; ss.onFocus(e) }}
      onBlur={saveValue}
      onKeyDown={ss.onKeyDown}
      placeholder={placeholder}
    />
  )
}
