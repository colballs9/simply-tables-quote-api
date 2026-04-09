import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { quoteBlocks } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

function formatCost(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * RatesRow — per-block margin rate section.
 *
 * Shows one row per cost block with its margin rate (editable),
 * plus per-product cost/adjusted/profit display underneath.
 * Summary at bottom with total cost, total adjusted, effective rate.
 */
export default function RatesRow({ products, quote, onQuoteUpdate }) {
  const [expanded, setExpanded] = useState(false)

  const costBlocks = (quote?.quote_blocks || []).filter(b => b.block_domain === 'cost')

  // Build per-product totals for summary
  const productTotals = {}
  products.forEach(p => { productTotals[p.id] = { cost: 0, adjusted: 0 } })

  costBlocks.forEach(block => {
    const rate = block.margin_rate ?? 0.05
    ;(block.members || []).forEach(m => {
      const costPP = m.cost_pp || 0
      const adjustedPP = costPP * (1 + rate)
      if (productTotals[m.product_id]) {
        productTotals[m.product_id].cost += costPP
        productTotals[m.product_id].adjusted += adjustedPP
      }
    })
  })

  // Grand totals across all products
  let grandCost = 0
  let grandAdjusted = 0
  products.forEach(p => {
    const qty = p.quantity || 1
    grandCost += (productTotals[p.id]?.cost || 0) * qty
    grandAdjusted += (productTotals[p.id]?.adjusted || 0) * qty
  })
  const effectiveRate = grandCost > 0 ? ((grandAdjusted - grandCost) / grandCost * 100) : 0

  return (
    <>
      <div
        className="canvas-section-header canvas-section-header--rates"
        style={{ gridColumn: '1 / -1', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Margin Rates
        </span>
      </div>

      {expanded && (
        <>
          {costBlocks.map(block => (
            <MarginBlockRow
              key={block.id}
              block={block}
              products={products}
              onQuoteUpdate={onQuoteUpdate}
            />
          ))}

          {/* Summary row */}
          <div className="canvas-cell canvas-cell--label canvas-cell--pricing-label">
            <div className="margin-summary-label">
              <span className="margin-summary-title">Margin Summary</span>
              <div className="margin-summary-stats">
                <span className="margin-summary-line">Cost: {formatCost(grandCost)}</span>
                <span className="margin-summary-line margin-summary-line--adjusted">Adjusted: {formatCost(grandAdjusted)}</span>
                <span className="margin-summary-line margin-summary-line--rate">Effective: {effectiveRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>
          {products.map(product => {
            const t = productTotals[product.id] || { cost: 0, adjusted: 0 }
            const profit = t.adjusted - t.cost
            return (
              <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
                <div className="margin-product-summary">
                  <span className="margin-detail-cost">{formatCost(t.cost)}</span>
                  <span className="margin-detail-adjusted">{formatCost(t.adjusted)}</span>
                  <span className="margin-detail-profit">+{formatCost(profit)}</span>
                </div>
              </div>
            )
          })}
          <div className="canvas-cell canvas-cell--spacer" />
        </>
      )}
    </>
  )
}


function MarginBlockRow({ block, products, onQuoteUpdate }) {
  const rate = block.margin_rate ?? 0.05
  const [localRate, setLocalRate] = useState(String((rate * 100).toFixed(1)))
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalRate)

  const prevRef = useRef(rate)
  if (rate !== prevRef.current && focusRef.current !== 'rate') {
    setLocalRate(String((rate * 100).toFixed(1)))
  }
  prevRef.current = rate

  async function saveRate() {
    focusRef.current = null
    const pct = parseFloat(localRate)
    if (isNaN(pct)) return
    const decimal = pct / 100
    if (decimal === rate) return
    try {
      const updated = await quoteBlocks.update(block.id, { margin_rate: decimal })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update block margin rate:', err)
    }
  }

  // Build member map
  const memberMap = {}
  ;(block.members || []).forEach(m => { memberMap[m.product_id] = m })

  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--pricing-label">
        <div className="margin-block-label">
          <span className="margin-block-name">{block.label || block.cost_category}</span>
          <div className="margin-block-rate-wrap">
            <input
              className="margin-rate-input"
              type="number"
              step="0.5"
              value={localRate}
              onChange={e => setLocalRate(e.target.value)}
              onFocus={e => { focusRef.current = 'rate'; ss.onFocus(e) }}
              onBlur={saveRate}
              onKeyDown={ss.onKeyDown}
              title="Margin rate %"
            />
            <span className="margin-rate-pct">%</span>
          </div>
        </div>
      </div>
      {products.map(product => {
        const member = memberMap[product.id]
        if (!member) {
          return (
            <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
              <span className="canvas-species-dash">--</span>
            </div>
          )
        }
        const costPP = member.cost_pp || 0
        const adjustedPP = costPP * (1 + rate)
        const profitPP = adjustedPP - costPP
        return (
          <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
            <div className="margin-product-detail">
              <span className="margin-detail-cost">{formatCost(costPP)}</span>
              <span className="margin-detail-adjusted">{formatCost(adjustedPP)}</span>
              <span className="margin-detail-profit">+{formatCost(profitPP)}</span>
            </div>
          </div>
        )
      })}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}
