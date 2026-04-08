import { useState, useRef } from 'react'
import { products as productsApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

function formatPrice(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatHours(val) {
  if (val == null) return '--'
  return Number(val).toFixed(1) + 'h'
}

function formatPct(val) {
  if (val == null) return '--'
  return (Number(val) * 100).toFixed(1) + '%'
}

const READ_ONLY_ROWS = [
  { key: 'total_material_cost', label: 'Material Cost', format: formatPrice, accent: 'cost' },
  { key: 'total_hours_pp', label: 'Total Hours', format: formatHours, accent: 'hours' },
  { key: 'price_pp', label: 'Price PP', format: formatPrice, accent: 'price' },
]

export default function PricingRow({ products, activeOption, quote, onQuoteUpdate }) {
  return (
    <>
      {/* Hourly Rate (editable per product) */}
      <EditableProductLine
        label="Hourly Rate"
        field="hourly_rate"
        products={products}
        activeOption={activeOption}
        onQuoteUpdate={onQuoteUpdate}
        step="5"
        format="dollar"
      />

      {/* Material Cost, Total Hours, Price PP (read-only) */}
      {READ_ONLY_ROWS.map(row => (
        <ReadOnlyLine key={row.key} row={row} products={products} />
      ))}

      {/* Final Adjustment (editable per product, displayed as %) */}
      <EditableProductLine
        label="Final Adjustment"
        field="final_adjustment_rate"
        products={products}
        activeOption={activeOption}
        onQuoteUpdate={onQuoteUpdate}
        step="0.5"
        format="percent"
      />

      {/* Final Price PP (read-only) */}
      <ReadOnlyLine
        row={{ key: 'final_price_pp', label: 'Final Price PP', format: formatPrice, accent: 'price' }}
        products={products}
      />

      {/* Rep Commission (read-only display from quote) */}
      <RepRateLine products={products} quote={quote} />

      {/* Sale Price PP (read-only) */}
      <ReadOnlyLine
        row={{ key: 'sale_price_pp', label: 'Sale Price PP', format: formatPrice, accent: 'price' }}
        products={products}
      />

      {/* Sale Price Total (read-only) */}
      <ReadOnlyLine
        row={{ key: 'sale_price_total', label: 'Sale Price Total', format: formatPrice, accent: 'final' }}
        products={products}
      />
    </>
  )
}


function ReadOnlyLine({ row, products }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--pricing-label">
        <span className="canvas-pricing-label">{row.label}</span>
      </div>
      {products.map(product => (
        <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
          <span className={`canvas-pricing-value canvas-pricing-value--${row.accent}`}>
            {row.format(product[row.key])}
          </span>
        </div>
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function RepRateLine({ products, quote }) {
  const repRate = quote?.rep_rate
  const hasRep = quote?.has_rep
  const display = hasRep && repRate != null ? formatPct(repRate) : 'None'

  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--pricing-label">
        <span className="canvas-pricing-label">Rep Commission</span>
      </div>
      {products.map(product => (
        <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
          <span className="canvas-pricing-value canvas-pricing-value--muted">
            {display}
          </span>
        </div>
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function EditableProductLine({ label, field, products, activeOption, onQuoteUpdate, step, format }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--pricing-label">
        <span className="canvas-pricing-label">{label}</span>
      </div>
      {products.map(product => (
        <EditableProductCell
          key={product.id}
          product={product}
          field={field}
          optionId={activeOption?.id}
          onQuoteUpdate={onQuoteUpdate}
          step={step}
          format={format}
        />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function EditableProductCell({ product, field, optionId, onQuoteUpdate, step, format }) {
  const isPercent = format === 'percent'
  const isDollar = format === 'dollar'
  const rawValue = product[field]
  const displayValue = isPercent ? (rawValue != null ? (Number(rawValue) * 100).toFixed(1) : '') : String(rawValue ?? '')

  const [localVal, setLocalVal] = useState(displayValue)
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalVal)

  const prevRef = useRef(rawValue)
  if (rawValue !== prevRef.current && !focusRef.current) {
    setLocalVal(isPercent ? (rawValue != null ? (Number(rawValue) * 100).toFixed(1) : '') : String(rawValue ?? ''))
  }
  prevRef.current = rawValue

  async function saveValue() {
    focusRef.current = null
    const parsed = parseFloat(localVal)
    if (isNaN(parsed)) return
    const valueToSave = isPercent ? parsed / 100 : parsed
    if (valueToSave === rawValue) return
    try {
      const updated = await productsApi.update(optionId, product.id, { [field]: valueToSave })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error(`Failed to update ${field}:`, err)
    }
  }

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {isDollar && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>$</span>}
        <input
          className="canvas-pricing-rate-input"
          type="number"
          step={step}
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onFocus={e => { focusRef.current = true; ss.onFocus(e) }}
          onBlur={saveValue}
          onKeyDown={ss.onKeyDown}
          title={field}
        />
        {isPercent && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>%</span>}
      </div>
    </div>
  )
}
