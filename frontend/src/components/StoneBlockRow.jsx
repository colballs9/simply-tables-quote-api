import { useState, useRef } from 'react'
import { stone as stoneApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

function formatCost(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatSqft(val) {
  if (val == null || val === 0) return '--'
  return Number(val).toFixed(1)
}

/**
 * StoneBlockRow — specialized rendering for built-in stone cost blocks.
 *
 * Label area: "Stone N", stone spec, total sqft, total cost (input), price per sqft (calculated)
 * Product columns: read-only sqft PP/PT and cost PP/PT
 */
export default function StoneBlockRow({ block, products, quoteId, stoneAssignment, stoneNumber, onQuoteUpdate }) {
  const memberMap = {}
  ;(block.members || []).forEach(m => {
    memberMap[m.product_id] = m
  })

  const totalSqft = stoneAssignment?.total_sqft
  const totalCost = stoneAssignment?.total_cost
  const pricePerSqft = totalSqft && totalCost ? totalCost / totalSqft : null

  // Derive stone spec from the first member product's material_detail
  const firstMemberProduct = products.find(p => memberMap[p.id])
  const stoneSpec = firstMemberProduct?.material_detail || ''

  return (
    <>
      {/* Label cell — sticky left column */}
      <div className="canvas-cell canvas-cell--label canvas-cell--block canvas-cell--cost canvas-cell--stone">
        <StoneLabel
          block={block}
          quoteId={quoteId}
          stoneAssignment={stoneAssignment}
          stoneNumber={stoneNumber}
          stoneSpec={stoneSpec}
          totalSqft={totalSqft}
          totalCost={totalCost}
          pricePerSqft={pricePerSqft}
          onQuoteUpdate={onQuoteUpdate}
        />
      </div>

      {/* Product columns — read-only sqft + cost */}
      {products.map(product => {
        const member = memberMap[product.id]
        return (
          <div
            key={product.id}
            className="canvas-cell canvas-cell--value canvas-cell--cost-value canvas-cell--stone-value"
          >
            {member ? (
              <StoneMemberCell member={member} product={product} pricePerSqft={pricePerSqft} />
            ) : (
              <div className="canvas-member-empty canvas-species-empty">
                <span className="canvas-species-dash">--</span>
              </div>
            )}
          </div>
        )
      })}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function StoneLabel({ block, quoteId, stoneAssignment, stoneNumber, stoneSpec, totalSqft, totalCost, pricePerSqft, onQuoteUpdate }) {
  const [localCost, setLocalCost] = useState(String(totalCost ?? ''))
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalCost)

  // Sync from props
  const prevCostRef = useRef(totalCost)
  if (totalCost !== prevCostRef.current && focusRef.current !== 'cost') {
    setLocalCost(String(totalCost ?? ''))
  }
  prevCostRef.current = totalCost

  async function saveCost() {
    focusRef.current = null
    const val = parseFloat(localCost)
    if (isNaN(val) || val < 0) return
    if (val === totalCost) return
    if (!stoneAssignment) return
    try {
      const updated = await stoneApi.updateCost(quoteId, stoneAssignment.stone_key, { total_cost: val })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update stone cost:', err)
    }
  }

  return (
    <div className="canvas-block-fields species-label">
      <div className="species-label-row1">
        <span className="species-name">Stone {stoneNumber}</span>
      </div>
      {stoneSpec && <div className="stone-spec-line">{stoneSpec}</div>}
      <div className="species-label-row2">
        <span className="species-stat species-stat--bdft" title="Total square feet">
          {formatSqft(totalSqft)} <span className="stone-unit">sq ft</span>
        </span>
        <div className="species-price-wrap">
          <span className="canvas-unit-dollar-prefix">$</span>
          <input
            className="species-price-input stone-cost-input"
            type="number"
            step="0.01"
            value={localCost}
            onChange={e => setLocalCost(e.target.value)}
            onFocus={e => { focusRef.current = 'cost'; ss.onFocus(e) }}
            onBlur={saveCost}
            onKeyDown={ss.onKeyDown}
            placeholder="Total Cost"
            title="Total stone cost"
          />
        </div>
        <span className="species-stat species-stat--cost" title="Price per square foot (calculated)">
          {pricePerSqft != null ? formatCost(pricePerSqft) : '--'}
          <span className="stone-unit">/sqft</span>
        </span>
      </div>
    </div>
  )
}


function StoneMemberCell({ member, product, pricePerSqft }) {
  const sqftPP = member.units_per_product || product.sq_ft
  const sqftPT = sqftPP != null && product.quantity ? sqftPP * product.quantity : null
  const costPP = member.cost_pp
  const costPT = costPP != null && product.quantity ? costPP * product.quantity : null

  return (
    <div className="species-member-cell">
      <div className="species-member-bdft">
        <span className="species-val">{formatSqft(sqftPP)} <span className="canvas-unit-pp-label">sq ft</span></span>
        <span className="species-val species-val--dim">{formatSqft(sqftPT)} <span className="canvas-unit-pp-label">sq ft</span></span>
      </div>
      <div className="species-member-cost">
        <span className="species-val species-val--cost">{formatCost(costPP)} <span className="canvas-unit-pp-label">pp</span></span>
        <span className="species-val species-val--cost species-val--dim">{formatCost(costPT)} <span className="canvas-unit-pp-label">pt</span></span>
      </div>
    </div>
  )
}
