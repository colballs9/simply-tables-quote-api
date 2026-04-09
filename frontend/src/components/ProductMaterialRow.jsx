import { useState, useRef } from 'react'
import { products as productsApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'
import MaterialSearch from './MaterialSearch'

const THICKNESSES = [
  { value: '', label: '\u2014' },
  { value: '.75"', label: '4/4' },
  { value: '1"', label: '4/4' },
  { value: '1.25"', label: '6/4' },
  { value: '1.5"', label: '8/4' },
  { value: '1.75"', label: '8/4' },
  { value: '2"', label: '8/4' },
  { value: '2.25"', label: '10/4' },
  { value: '2.5"', label: '10/4' },
]

// Unique display options for the dropdown
const LUMBER_OPTIONS = [
  { value: '', label: '\u2014' },
  { value: '1"', label: '4/4' },
  { value: '1.25"', label: '6/4' },
  { value: '1.5"', label: '8/4' },
  { value: '2"', label: '8/4+' },
  { value: '2.25"', label: '10/4' },
]

/**
 * Material row: Material search + lumber thickness dropdown (when hardwood).
 * Shows "LUMBER" label after the dropdown.
 */
export default function ProductMaterialRow({ products, optionId, onQuoteUpdate }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--field-label">
        <span className="pf-label">Material</span>
      </div>
      {products.map(product => (
        <MaterialCell key={product.id} product={product} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}

function MaterialCell({ product, optionId, onQuoteUpdate }) {
  const showLumber = product.material_type === 'Hardwood' || product.material_type === 'Live Edge'

  const [materialVal, setMaterialVal] = useState(product.material_detail || '')
  const focusRef = useRef(null)

  const prevRef = useRef(product)
  if (prevRef.current !== product && focusRef.current !== 'material') {
    setMaterialVal(product.material_detail || '')
    prevRef.current = product
  }

  async function saveMaterial() {
    focusRef.current = null
    if (materialVal !== (product.material_detail || '')) {
      try {
        const updated = await productsApi.update(optionId, product.id, { material_detail: materialVal || null })
        onQuoteUpdate(updated)
      } catch (e) { console.error(e) }
    }
  }

  async function handleLumberChange(val) {
    try {
      const updated = await productsApi.update(optionId, product.id, { lumber_thickness: val || null })
      onQuoteUpdate(updated)
    } catch (e) { console.error(e) }
  }

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--field-value">
      <div className="material-lumber-row">
        <MaterialSearch
          materialType={product.material_type}
          value={materialVal}
          onChange={val => setMaterialVal(val)}
          onBlur={saveMaterial}
          onFocus={() => { focusRef.current = 'material' }}
        />
        {showLumber && (
          <div className="lumber-select-group">
            <select
              className="pfc-select lumber-select"
              value={product.lumber_thickness || ''}
              onChange={e => handleLumberChange(e.target.value)}
            >
              {LUMBER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="lumber-label">LUMBER</span>
          </div>
        )}
      </div>
    </div>
  )
}
