import { useState, useRef } from 'react'
import { products as productsApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'
import MaterialSearch from './MaterialSearch'

/**
 * A single product × field cell. Manages its own local state + save-on-blur.
 * Follows the same pattern as RateCell / UnitMemberCell.
 */
export default function ProductFieldCell({
  product, optionId, fieldKey, fieldType, onQuoteUpdate,
  options, optionLabels, step, placeholder, hidden, materialType,
}) {
  const rawValue = product[fieldKey]
  const isPercent = fieldType === 'percent'
  const isSelect = fieldType === 'select'
  const isMaterialSearch = fieldType === 'materialSearch'

  const displayVal = isPercent
    ? (rawValue != null ? (Number(rawValue) * 100).toFixed(1) : '')
    : String(rawValue ?? '')

  const [localVal, setLocalVal] = useState(displayVal)
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalVal)

  // Sync from props when not focused
  const prevRef = useRef(rawValue)
  if (rawValue !== prevRef.current && !focusRef.current) {
    setLocalVal(isPercent
      ? (rawValue != null ? (Number(rawValue) * 100).toFixed(1) : '')
      : String(rawValue ?? ''))
  }
  prevRef.current = rawValue

  async function saveValue(overrideVal) {
    focusRef.current = null
    const val = overrideVal !== undefined ? overrideVal : localVal
    if (fieldType === 'text' || isMaterialSearch) {
      const strVal = String(val)
      if (strVal !== (product[fieldKey] || '')) {
        try {
          const updated = await productsApi.update(optionId, product.id, { [fieldKey]: strVal || null })
          onQuoteUpdate(updated)
        } catch (e) { console.error(e) }
      }
    } else {
      const parsed = parseFloat(val)
      if (isNaN(parsed)) return
      const toSave = isPercent ? parsed / 100 : parsed
      if (toSave !== rawValue) {
        try {
          const updated = await productsApi.update(optionId, product.id, { [fieldKey]: toSave })
          onQuoteUpdate(updated)
        } catch (e) { console.error(e) }
      }
    }
  }

  async function handleSelectChange(val) {
    setLocalVal(val)
    try {
      const updated = await productsApi.update(optionId, product.id, { [fieldKey]: val })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
  }

  if (hidden) {
    return <div className="canvas-cell canvas-cell--value canvas-cell--field-value" style={{ visibility: 'hidden' }} />
  }

  if (isSelect) {
    const isStone = fieldKey === 'material_type' && (rawValue || '').startsWith('Stone')
    return (
      <div className="canvas-cell canvas-cell--value canvas-cell--field-value">
        <div className="pfc-select-wrap">
          <select
            className="pfc-select"
            value={rawValue || options?.[0] || ''}
            onChange={e => handleSelectChange(e.target.value)}
          >
            {(options || []).map((o, i) => (
              <option key={o} value={o}>{optionLabels ? optionLabels[i] : o}</option>
            ))}
          </select>
          {isStone && (
            <StoneGroupInput product={product} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
          )}
        </div>
      </div>
    )
  }

  if (isMaterialSearch) {
    return (
      <div className="canvas-cell canvas-cell--value canvas-cell--field-value">
        <MaterialSearch
          materialType={materialType}
          value={localVal}
          onChange={val => setLocalVal(val)}
          onBlur={() => saveValue()}
          className="pfc-input"
        />
      </div>
    )
  }

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--field-value">
      <input
        className="pfc-input"
        type={fieldType === 'number' || isPercent ? 'number' : 'text'}
        step={step}
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onFocus={e => { focusRef.current = fieldKey; ss.onFocus(e) }}
        onBlur={() => saveValue()}
        onKeyDown={ss.onKeyDown}
        placeholder={placeholder}
      />
      {isPercent && <span className="pfc-pct">%</span>}
    </div>
  )
}


function StoneGroupInput({ product, optionId, onQuoteUpdate }) {
  const [localGroup, setLocalGroup] = useState(String(product.stone_group ?? ''))
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalGroup)

  const prevRef = useRef(product.stone_group)
  if (product.stone_group !== prevRef.current && !focusRef.current) {
    setLocalGroup(String(product.stone_group ?? ''))
  }
  prevRef.current = product.stone_group

  async function save() {
    focusRef.current = null
    const val = parseInt(localGroup, 10)
    if (isNaN(val) || val < 1) return
    if (val === product.stone_group) return
    try {
      const updated = await productsApi.update(optionId, product.id, { stone_group: val })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
  }

  return (
    <input
      className="pfc-stone-group"
      type="number"
      min="1"
      step="1"
      value={localGroup}
      onChange={e => setLocalGroup(e.target.value)}
      onFocus={e => { focusRef.current = 'stone_group'; ss.onFocus(e) }}
      onBlur={save}
      onKeyDown={ss.onKeyDown}
      placeholder="#"
      title="Stone group number"
    />
  )
}
