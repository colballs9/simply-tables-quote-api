import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { quoteBlocks } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

function formatCost(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * RatesRow — per-block margin rate section with per-product rate inputs.
 *
 * Each cost block gets a row. Each product column shows an editable margin rate
 * (member override or block default) plus cost/adjusted/profit.
 * Summary at bottom with totals and effective rate.
 */
export default function RatesRow({ products, quote, onQuoteUpdate }) {
  const [expanded, setExpanded] = useState(false)

  const costBlocks = (quote?.quote_blocks || []).filter(b => b.block_domain === 'cost')

  // Compute per-product totals for summary
  const productTotals = {}
  products.forEach(p => { productTotals[p.id] = { cost: 0, adjusted: 0 } })

  costBlocks.forEach(block => {
    const blockRate = block.margin_rate ?? 0.05
    ;(block.members || []).forEach(m => {
      const rate = m.margin_rate ?? blockRate
      const costPP = m.cost_pp || 0
      const adjustedPP = costPP * (1 + rate)
      if (productTotals[m.product_id]) {
        productTotals[m.product_id].cost += costPP
        productTotals[m.product_id].adjusted += adjustedPP
      }
    })
  })

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
  const blockRate = block.margin_rate ?? 0.05
  const memberMap = {}
  ;(block.members || []).forEach(m => { memberMap[m.product_id] = m })

  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--pricing-label">
        <div className="margin-block-label">
          <span className="margin-block-name">{block.label || block.cost_category}</span>
          <span className="margin-block-default">Default: {(blockRate * 100).toFixed(1)}%</span>
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
        return (
          <MarginMemberCell
            key={product.id}
            block={block}
            member={member}
            product={product}
            blockRate={blockRate}
            onQuoteUpdate={onQuoteUpdate}
          />
        )
      })}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function MarginMemberCell({ block, member, product, blockRate, onQuoteUpdate }) {
  const effectiveRate = member.margin_rate ?? blockRate
  const [localRate, setLocalRate] = useState(String((effectiveRate * 100).toFixed(1)))
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalRate)

  const prevRef = useRef(effectiveRate)
  if (effectiveRate !== prevRef.current && focusRef.current !== 'rate') {
    setLocalRate(String((effectiveRate * 100).toFixed(1)))
  }
  prevRef.current = effectiveRate

  async function saveRate() {
    focusRef.current = null
    const pct = parseFloat(localRate)
    if (isNaN(pct)) return
    const decimal = pct / 100
    if (decimal === effectiveRate) return
    try {
      const updated = await quoteBlocks.updateMember(block.id, product.id, { margin_rate: decimal })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update member margin rate:', err)
    }
  }

  const costPP = member.cost_pp || 0
  const adjustedPP = costPP * (1 + effectiveRate)
  const profitPP = adjustedPP - costPP

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
      <div className="margin-product-detail">
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
        <span className="margin-detail-cost">{formatCost(costPP)}</span>
        <span className="margin-detail-adjusted">{formatCost(adjustedPP)}</span>
        <span className="margin-detail-profit">+{formatCost(profitPP)}</span>
      </div>
    </div>
  )
}
