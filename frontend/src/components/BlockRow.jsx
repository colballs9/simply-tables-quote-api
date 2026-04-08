import { useState, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { quoteBlocks } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'
import BlockRowCost from './BlockRowCost'
import BlockRowLabor from './BlockRowLabor'

function formatCost(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatHours(val) {
  if (val == null) return '--'
  return Number(val).toFixed(2) + 'h'
}

export default function BlockRow({ block, products, quoteId, onQuoteUpdate, availableTags }) {
  const isCost = block.block_domain === 'cost'
  const isUnit = block.block_type === 'unit'
  const [toggling, setToggling] = useState(null) // product_id being toggled
  const memberMap = {}
  ;(block.members || []).forEach(m => {
    memberMap[m.product_id] = m
  })

  async function handleDeleteBlock() {
    if (block.is_builtin) return
    try {
      const updated = await quoteBlocks.delete(block.id)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to delete block:', err)
    }
  }

  async function handleBlockUpdate(data) {
    try {
      const updated = await quoteBlocks.update(block.id, data)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update block:', err)
    }
  }

  async function toggleMember(productId) {
    if (toggling) return // prevent concurrent toggles
    setToggling(productId)
    const isMember = !!memberMap[productId]
    try {
      const updated = isMember
        ? await quoteBlocks.removeMember(block.id, productId)
        : await quoteBlocks.addMember(block.id, productId)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to toggle member:', err)
    }
    setToggling(null)
  }

  return (
    <>
      {/* Label cell — sticky left column */}
      <div className={`canvas-cell canvas-cell--label canvas-cell--block ${isCost ? 'canvas-cell--cost' : 'canvas-cell--labor'}`}>
        <div className="canvas-block-label-content">
          {isCost ? (
            <BlockRowCost block={block} onBlockUpdate={handleBlockUpdate} availableTags={availableTags} />
          ) : (
            <BlockRowLabor block={block} onBlockUpdate={handleBlockUpdate} availableTags={availableTags} />
          )}
          {!block.is_builtin && (
            <button className="canvas-block-delete" onClick={handleDeleteBlock} title="Delete block">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Member cells for each product */}
      {products.map(product => {
        const member = memberMap[product.id]
        const isMember = !!member

        return (
          <div
            key={product.id}
            className={`canvas-cell canvas-cell--value ${isCost ? 'canvas-cell--cost-value' : 'canvas-cell--labor-value'}`}
          >
            {isMember ? (
              isUnit ? (
                <UnitMemberCell
                  block={block}
                  member={member}
                  product={product}
                  isCost={isCost}
                  onQuoteUpdate={onQuoteUpdate}
                />
              ) : (
                <div className="canvas-member-value" title="Click to remove from block">
                  <div className="canvas-member-value-stack">
                    <span
                      className={`canvas-computed ${isCost ? 'canvas-computed--cost' : 'canvas-computed--hours'}`}
                      onClick={() => !toggling && toggleMember(product.id)}
                      style={toggling ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                    >
                      {isCost ? formatCost(member.cost_pp) : formatHours(member.hours_pp)}
                      <span className="canvas-unit-pp-label"> pp</span>
                    </span>
                    <span className={`canvas-pt-value ${isCost ? 'canvas-pt-value--cost' : 'canvas-pt-value--hours'}`}>
                      {isCost
                        ? formatCost(member.cost_pp != null && product.quantity ? member.cost_pp * product.quantity : null)
                        : formatHours(member.hours_pp != null && product.quantity ? member.hours_pp * product.quantity : null)
                      }
                      <span className="canvas-unit-pp-label"> pt</span>
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="canvas-member-empty">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleMember(product.id)}
                  disabled={!!toggling}
                  title="Add product to this block"
                  className="canvas-member-checkbox"
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Spacer */}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function UnitMemberCell({ block, member, product, isCost, onQuoteUpdate }) {
  const isPieces = isCost && block.multiplier_type === 'per_piece'

  const effectiveValue = isCost
    ? (member.cost_per_unit ?? block.cost_per_unit ?? '')
    : (member.hours_per_unit ?? block.hours_per_unit ?? '')

  const effectivePieces = member.units_per_product ?? block.units_per_product ?? 1

  const [localVal, setLocalVal] = useState(String(effectiveValue))
  const [localPieces, setLocalPieces] = useState(String(effectivePieces))
  const focusRef = useRef(null)
  const ss = useSpreadsheetInput(setLocalVal)
  const ssPieces = useSpreadsheetInput(setLocalPieces)

  const prevValRef = useRef(effectiveValue)
  if (effectiveValue !== prevValRef.current && focusRef.current !== 'value') {
    setLocalVal(String(effectiveValue ?? ''))
  }
  prevValRef.current = effectiveValue

  const prevPiecesRef = useRef(effectivePieces)
  if (effectivePieces !== prevPiecesRef.current && focusRef.current !== 'pieces') {
    setLocalPieces(String(effectivePieces ?? 1))
  }
  prevPiecesRef.current = effectivePieces

  async function saveValue() {
    focusRef.current = null
    const val = parseFloat(localVal)
    if (isNaN(val)) return
    const field = isCost ? 'cost_per_unit' : 'hours_per_unit'
    if (val === effectiveValue) return
    try {
      const updated = await quoteBlocks.updateMember(block.id, product.id, { [field]: val })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update member:', err)
    }
  }

  async function savePieces() {
    focusRef.current = null
    const val = parseFloat(localPieces)
    if (isNaN(val)) return
    if (val === effectivePieces) return
    try {
      const updated = await quoteBlocks.updateMember(block.id, product.id, { units_per_product: val })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update member pieces:', err)
    }
  }

  const computedPP = isCost ? member.cost_pp : member.hours_pp
  const computedPT = computedPP != null && product.quantity ? computedPP * product.quantity : null

  return (
    <div className="canvas-unit-cell">
      <div className="canvas-unit-inputs">
        <input
          className={`canvas-unit-input ${isCost ? 'canvas-unit-input--cost' : 'canvas-unit-input--hours'}`}
          type="number"
          step={isCost ? '0.01' : '0.01'}
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onFocus={e => { focusRef.current = 'value'; ss.onFocus(e) }}
          onBlur={saveValue}
          onKeyDown={ss.onKeyDown}
          title={isCost ? (isPieces ? 'Cost per piece' : 'Cost per unit') : 'Hours per unit'}
        />
        {isPieces && (
          <input
            className="canvas-unit-input canvas-unit-input--pieces"
            type="number"
            step="1"
            value={localPieces}
            onChange={e => setLocalPieces(e.target.value)}
            onFocus={e => { focusRef.current = 'pieces'; ssPieces.onFocus(e) }}
            onBlur={savePieces}
            onKeyDown={ssPieces.onKeyDown}
            title="Pieces per unit"
            placeholder="pcs"
          />
        )}
      </div>
      <span className={`canvas-unit-pp ${isCost ? 'canvas-unit-pp--cost' : 'canvas-unit-pp--hours'}`}>
        {isCost ? formatCost(computedPP) : formatHours(computedPP)}
        <span className="canvas-unit-pp-label"> pp</span>
      </span>
      <span className={`canvas-pt-value ${isCost ? 'canvas-pt-value--cost' : 'canvas-pt-value--hours'}`}>
        {isCost ? formatCost(computedPT) : formatHours(computedPT)}
        <span className="canvas-unit-pp-label"> pt</span>
      </span>
    </div>
  )
}
