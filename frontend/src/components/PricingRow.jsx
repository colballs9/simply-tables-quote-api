import { useState, useRef } from 'react'
import { products as productsApi } from '../api/client'

function formatPrice(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatHours(val) {
  if (val == null) return '--'
  return Number(val).toFixed(1) + 'h'
}

const PRICING_ROWS = [
  { key: 'total_material_cost', label: 'Material Cost', format: formatPrice, accent: 'cost' },
  { key: 'total_hours_pp', label: 'Total Hours', format: formatHours, accent: 'hours' },
  { key: 'price_pp', label: 'Price PP', format: formatPrice, accent: 'price' },
  { key: 'sale_price_pp', label: 'Sale Price PP', format: formatPrice, accent: 'price' },
  { key: 'sale_price_total', label: 'Sale Price Total', format: formatPrice, accent: 'final' },
]

export default function PricingRow({ products, activeOption, onQuoteUpdate }) {
  return (
    <>
      {/* Hourly Rate (editable) */}
      <HourlyRateLine products={products} activeOption={activeOption} onQuoteUpdate={onQuoteUpdate} />

      {PRICING_ROWS.map(row => (
        <PricingLine key={row.key} row={row} products={products} />
      ))}
    </>
  )
}

function HourlyRateLine({ products, activeOption, onQuoteUpdate }) {
  return (
    <>
      {products.map(product => (
        <HourlyRateCell
          key={product.id}
          product={product}
          optionId={activeOption?.id}
          onQuoteUpdate={onQuoteUpdate}
        />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}

function HourlyRateCell({ product, optionId, onQuoteUpdate }) {
  const [localVal, setLocalVal] = useState(String(product.hourly_rate ?? 155))
  const focusRef = useRef(null)

  // Sync from props when not focused
  const prevRef = useRef(product.hourly_rate)
  if (product.hourly_rate !== prevRef.current && !focusRef.current) {
    setLocalVal(String(product.hourly_rate ?? 155))
  }
  prevRef.current = product.hourly_rate

  async function saveValue() {
    focusRef.current = null
    const val = parseFloat(localVal)
    if (isNaN(val) || val === product.hourly_rate) return
    try {
      const updated = await productsApi.update(optionId, product.id, { hourly_rate: val })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update hourly rate:', err)
    }
  }

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
      <input
        className="canvas-pricing-rate-input"
        type="number"
        step="5"
        value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onFocus={() => { focusRef.current = true }}
        onBlur={saveValue}
        title="Hourly rate ($/hr)"
      />
    </div>
  )
}

function PricingLine({ row, products }) {
  return (
    <>
      {/* Value cells */}
      {products.map(product => (
        <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
          <span className={`canvas-pricing-value canvas-pricing-value--${row.accent}`}>
            {row.format(product[row.key])}
          </span>
        </div>
      ))}

      {/* Spacer */}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}
