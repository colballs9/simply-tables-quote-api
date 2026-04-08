import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { products as productsApi } from '../api/client'

const MARGIN_FIELDS = [
  { key: 'hardwood_margin_rate', label: 'Hardwood Margin' },
  { key: 'stone_margin_rate', label: 'Stone Margin' },
  { key: 'stock_base_margin_rate', label: 'Stock Base Margin' },
  { key: 'stock_base_ship_margin_rate', label: 'SB Ship Margin' },
  { key: 'powder_coat_margin_rate', label: 'Powder Coat Margin' },
  { key: 'custom_base_margin_rate', label: 'Custom Base Margin' },
  { key: 'unit_cost_margin_rate', label: 'Unit Cost Margin' },
  { key: 'group_cost_margin_rate', label: 'Group Cost Margin' },
  { key: 'misc_margin_rate', label: 'Misc Margin' },
  { key: 'consumables_margin_rate', label: 'Consumables Margin' },
]

const RATE_ROWS = [
  { key: 'hourly_rate', label: 'Hourly Rate', type: 'number', step: '5', format: 'dollar' },
  { key: 'final_adjustment_rate', label: 'Final Adjustment', type: 'number', step: '0.05', format: 'raw' },
  ...MARGIN_FIELDS.map(f => ({ key: f.key, label: f.label, type: 'percent', step: '0.5' })),
]

function pctToDisplay(val) {
  if (val == null) return ''
  return (Number(val) * 100).toFixed(1)
}

export default function RatesRow({ products, activeOption, onQuoteUpdate }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      {/* Collapsible section header */}
      <div
        className="canvas-section-header canvas-section-header--rates"
        style={{ gridColumn: '1 / -1', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Rates
        </span>
      </div>

      {expanded && RATE_ROWS.map(row => (
        <RateLine key={row.key} row={row} products={products} activeOption={activeOption} onQuoteUpdate={onQuoteUpdate} />
      ))}
    </>
  )
}

function RateLine({ row, products, activeOption, onQuoteUpdate }) {
  return (
    <>
      {products.map(product => (
        <RateCell
          key={product.id}
          product={product}
          row={row}
          optionId={activeOption?.id}
          onQuoteUpdate={onQuoteUpdate}
        />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}

function RateCell({ product, row, optionId, onQuoteUpdate }) {
  const isPercent = row.type === 'percent'
  const rawValue = product[row.key]
  const displayValue = isPercent ? pctToDisplay(rawValue) : String(rawValue ?? '')

  const [localVal, setLocalVal] = useState(displayValue)
  const focusRef = useRef(null)

  // Sync from props when not focused
  const prevRef = useRef(rawValue)
  if (rawValue !== prevRef.current && !focusRef.current) {
    setLocalVal(isPercent ? pctToDisplay(rawValue) : String(rawValue ?? ''))
  }
  prevRef.current = rawValue

  async function saveValue() {
    focusRef.current = null
    const parsed = parseFloat(localVal)
    if (isNaN(parsed)) return
    const valueToSave = isPercent ? parsed / 100 : parsed
    if (valueToSave === rawValue) return
    try {
      const updated = await productsApi.update(optionId, product.id, { [row.key]: valueToSave })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error(`Failed to update ${row.key}:`, err)
    }
  }

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {row.format === 'dollar' && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>$</span>}
        <input
          className="canvas-pricing-rate-input"
          type="number"
          step={row.step}
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onFocus={() => { focusRef.current = true }}
          onBlur={saveValue}
          title={row.label}
        />
        {isPercent && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>%</span>}
      </div>
    </div>
  )
}
