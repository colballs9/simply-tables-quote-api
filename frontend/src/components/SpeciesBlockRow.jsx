import { useState, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { species as speciesApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

function formatCost(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatBdft(val) {
  if (val == null || val === 0) return '--'
  return Number(val).toFixed(1)
}

/**
 * SpeciesBlockRow — specialized rendering for built-in species cost blocks.
 *
 * Label area: species name, price/bdft input, waste %, total bdft, total cost
 * Product columns: read-only bdft PP/PT and cost PP/PT
 * Detail + Tags: collapsible breakdown of top vs material builder bdft
 */
export default function SpeciesBlockRow({ block, products, quoteId, speciesAssignment, onQuoteUpdate }) {
  const [detailOpen, setDetailOpen] = useState(false)

  const memberMap = {}
  ;(block.members || []).forEach(m => {
    memberMap[m.product_id] = m
  })

  // Species assignment data
  const pricePer = speciesAssignment?.price_per_bdft
  const totalBdft = speciesAssignment?.total_bdft
  const totalCost = speciesAssignment?.total_cost

  return (
    <>
      {/* Label cell — sticky left column */}
      <div className="canvas-cell canvas-cell--label canvas-cell--block canvas-cell--cost canvas-cell--species">
        <SpeciesLabel
          block={block}
          quoteId={quoteId}
          speciesAssignment={speciesAssignment}
          pricePer={pricePer}
          totalBdft={totalBdft}
          totalCost={totalCost}
          detailOpen={detailOpen}
          onToggleDetail={() => setDetailOpen(o => !o)}
          onQuoteUpdate={onQuoteUpdate}
        />
      </div>

      {/* Product columns — read-only bdft + cost */}
      {products.map(product => {
        const member = memberMap[product.id]
        return (
          <div
            key={product.id}
            className="canvas-cell canvas-cell--value canvas-cell--cost-value canvas-cell--species-value"
          >
            {member ? (
              <SpeciesMemberCell member={member} product={product} />
            ) : (
              <div className="canvas-member-empty canvas-species-empty">
                <span className="canvas-species-dash">--</span>
              </div>
            )}
          </div>
        )
      })}
      <div className="canvas-cell canvas-cell--spacer" />

      {/* Detail + Tags expanded rows */}
      {detailOpen && (
        <SpeciesDetailRows
          block={block}
          products={products}
          memberMap={memberMap}
          pricePer={pricePer}
        />
      )}
    </>
  )
}


function SpeciesLabel({ block, quoteId, speciesAssignment, pricePer, totalBdft, totalCost, detailOpen, onToggleDetail, onQuoteUpdate }) {
  const wasteFactor = speciesAssignment?.waste_factor ?? 0.25

  const [localPrice, setLocalPrice] = useState(String(pricePer ?? ''))
  const [localWaste, setLocalWaste] = useState(String(Math.round(wasteFactor * 100)))
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalPrice)
  const ssWaste = useSpreadsheetInput(setLocalWaste)

  // Sync from props
  const prevPriceRef = useRef(pricePer)
  if (pricePer !== prevPriceRef.current && focusRef.current !== 'price') {
    setLocalPrice(String(pricePer ?? ''))
  }
  prevPriceRef.current = pricePer

  const prevWasteRef = useRef(wasteFactor)
  if (wasteFactor !== prevWasteRef.current && focusRef.current !== 'waste') {
    setLocalWaste(String(Math.round(wasteFactor * 100)))
  }
  prevWasteRef.current = wasteFactor

  async function saveSpecies(data) {
    if (!speciesAssignment) return
    try {
      const updated = await speciesApi.updatePrice(quoteId, speciesAssignment.species_key, data)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update species:', err)
    }
  }

  function savePrice() {
    focusRef.current = null
    const val = parseFloat(localPrice)
    if (isNaN(val) || val < 0) return
    if (val === pricePer) return
    saveSpecies({ price_per_bdft: val })
  }

  function saveWaste() {
    focusRef.current = null
    const pct = parseFloat(localWaste)
    if (isNaN(pct) || pct < 0) return
    const decimal = pct / 100
    if (decimal === wasteFactor) return
    saveSpecies({ waste_factor: decimal })
  }

  return (
    <div className="canvas-block-fields species-label">
      <div className="species-label-row1">
        <span className="species-name">{block.label}</span>
        <div className="species-price-wrap">
          <span className="canvas-unit-dollar-prefix">$</span>
          <input
            className="species-price-input"
            type="number"
            step="0.01"
            value={localPrice}
            onChange={e => setLocalPrice(e.target.value)}
            onFocus={e => { focusRef.current = 'price'; ss.onFocus(e) }}
            onBlur={savePrice}
            onKeyDown={ss.onKeyDown}
            placeholder="$/BdFt"
            title="Price per board foot"
          />
        </div>
      </div>
      <div className="species-label-row2">
        <div className="species-waste-wrap" title="Waste factor %">
          <input
            className="species-waste-input"
            type="number"
            step="1"
            value={localWaste}
            onChange={e => setLocalWaste(e.target.value)}
            onFocus={e => { focusRef.current = 'waste'; ssWaste.onFocus(e) }}
            onBlur={saveWaste}
            onKeyDown={ssWaste.onKeyDown}
          />
          <span className="species-waste-pct">%</span>
        </div>
        <span className="species-stat species-stat--bdft" title="Total board feet (with waste)">
          {totalBdft != null ? Number(totalBdft).toFixed(1) : '--'}
        </span>
        <span className="species-stat species-stat--cost" title="Total species cost">
          {formatCost(totalCost)}
        </span>
      </div>
      <button className="species-detail-toggle" onClick={onToggleDetail}>
        Detail + Tags
        {detailOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
    </div>
  )
}


function SpeciesMemberCell({ member, product }) {
  const bdftPP = member.units_per_product
  const bdftPT = bdftPP != null && product.quantity ? bdftPP * product.quantity : null
  const costPP = member.cost_pp
  const costPT = costPP != null && product.quantity ? costPP * product.quantity : null

  return (
    <div className="species-member-cell">
      <div className="species-member-bdft">
        <span className="species-val">{formatBdft(bdftPP)} <span className="canvas-unit-pp-label">BdFt pp</span></span>
        <span className="species-val species-val--dim">{formatBdft(bdftPT)} <span className="canvas-unit-pp-label">BdFt pt</span></span>
      </div>
      <div className="species-member-cost">
        <span className="species-val species-val--cost">{formatCost(costPP)} <span className="canvas-unit-pp-label">pp</span></span>
        <span className="species-val species-val--cost species-val--dim">{formatCost(costPT)} <span className="canvas-unit-pp-label">pt</span></span>
      </div>
    </div>
  )
}


function SpeciesDetailRows({ block, products, memberMap, pricePer }) {
  // Break out top bdft vs material builder bdft per product
  // Top bdft: product.bd_ft (from dimensions engine)
  // Component bdft: sum of component.bd_ft_pp where species matches block label (species_key)

  const speciesKey = block.label // e.g. "Red Oak 8/4"

  // Compute per-product breakdown
  const breakdown = products.map(product => {
    const member = memberMap[product.id]
    if (!member) return { topBdft: null, compBdft: null }

    // Top bdft — only if product's material matches this species
    const productSpeciesKey = product.material_detail && product.lumber_thickness
      ? `${product.material_detail.trim()} ${product.lumber_thickness}`
      : null
    const topBdft = productSpeciesKey === speciesKey ? (product.bd_ft || 0) : 0

    // Component bdft — sum components matching this species
    let compBdft = 0
    ;(product.components || []).forEach(comp => {
      if (!comp.material) return
      // Build species key from component: "material quarterCode"
      // Quarter code from thickness — approximate: 1" → 4/4, 1.5" → 6/4, 2" → 8/4, 2.5" → 10/4
      const t = comp.thickness ? Math.round(parseFloat(comp.thickness) * 10) / 10 : null
      const qcMap = { '1': '4/4', '1.5': '6/4', '2': '8/4', '2.5': '10/4' }
      const qc = t != null ? qcMap[String(t)] : null
      const compKey = qc ? `${comp.material.trim()} ${qc}` : null
      if (compKey === speciesKey) {
        compBdft += (comp.bd_ft_pp || 0)
      }
    })

    return { topBdft, compBdft }
  })

  // Totals
  const totalTopBdft = breakdown.reduce((s, b) => {
    if (b.topBdft == null) return s
    const prod = products[breakdown.indexOf(b)]
    return s + b.topBdft * (prod?.quantity || 1)
  }, 0)
  const totalCompBdft = breakdown.reduce((s, b) => {
    if (b.compBdft == null) return s
    const prod = products[breakdown.indexOf(b)]
    return s + b.compBdft * (prod?.quantity || 1)
  }, 0)

  const price = pricePer || 0
  const totalTopCost = totalTopBdft * price
  const totalCompCost = totalCompBdft * price

  const hasComponents = breakdown.some(b => b.compBdft > 0)

  return (
    <>
      {/* Top Bd Ft row */}
      <div className="canvas-cell canvas-cell--label canvas-cell--block canvas-cell--cost species-detail-label">
        <div className="species-detail-row">
          <span className="species-detail-name">Top Bd Ft</span>
          <span className="species-stat species-stat--bdft">{totalTopBdft > 0 ? totalTopBdft.toFixed(1) : '--'}</span>
          <span className="species-stat species-stat--cost">{formatCost(totalTopCost || null)}</span>
        </div>
      </div>
      {products.map((product, i) => {
        const b = breakdown[i]
        const bdftPP = b.topBdft || null
        const bdftPT = bdftPP && product.quantity ? bdftPP * product.quantity : null
        const costPP = bdftPP ? bdftPP * price : null
        const costPT = costPP && product.quantity ? costPP * product.quantity : null
        return (
          <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--cost-value species-detail-value">
            {memberMap[product.id] ? (
              <div className="species-detail-cell">
                <span className="species-val">{formatBdft(bdftPP)} <span className="canvas-unit-pp-label">BdFt pp</span></span>
                <span className="species-val species-val--dim">{formatBdft(bdftPT)} <span className="canvas-unit-pp-label">BdFt pt</span></span>
                <span className="species-val species-val--cost">{formatCost(costPP)} <span className="canvas-unit-pp-label">pp</span></span>
                <span className="species-val species-val--cost species-val--dim">{formatCost(costPT)} <span className="canvas-unit-pp-label">pt</span></span>
              </div>
            ) : (
              <span className="canvas-species-dash">--</span>
            )}
          </div>
        )
      })}
      <div className="canvas-cell canvas-cell--spacer" />

      {/* Material Builder Bd Ft row (only if any product has matching components) */}
      {hasComponents && (
        <>
          <div className="canvas-cell canvas-cell--label canvas-cell--block canvas-cell--cost species-detail-label">
            <div className="species-detail-row">
              <span className="species-detail-name">Material Builder Bd Ft</span>
              <span className="species-stat species-stat--bdft">{totalCompBdft > 0 ? totalCompBdft.toFixed(1) : '--'}</span>
              <span className="species-stat species-stat--cost">{formatCost(totalCompCost || null)}</span>
            </div>
          </div>
          {products.map((product, i) => {
            const b = breakdown[i]
            const bdftPP = b.compBdft || null
            const bdftPT = bdftPP && product.quantity ? bdftPP * product.quantity : null
            const costPP = bdftPP ? bdftPP * price : null
            const costPT = costPP && product.quantity ? costPP * product.quantity : null
            return (
              <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--cost-value species-detail-value">
                {memberMap[product.id] && b.compBdft > 0 ? (
                  <div className="species-detail-cell">
                    <span className="species-val">{formatBdft(bdftPP)} <span className="canvas-unit-pp-label">BdFt pp</span></span>
                    <span className="species-val species-val--dim">{formatBdft(bdftPT)} <span className="canvas-unit-pp-label">BdFt pt</span></span>
                    <span className="species-val species-val--cost">{formatCost(costPP)} <span className="canvas-unit-pp-label">pp</span></span>
                    <span className="species-val species-val--cost species-val--dim">{formatCost(costPT)} <span className="canvas-unit-pp-label">pt</span></span>
                  </div>
                ) : (
                  <span className="canvas-species-dash">--</span>
                )}
              </div>
            )
          })}
          <div className="canvas-cell canvas-cell--spacer" />
        </>
      )}
    </>
  )
}
