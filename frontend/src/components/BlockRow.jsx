import { Trash2 } from 'lucide-react'
import { quoteBlocks } from '../api/client'
import BlockRowCost from './BlockRowCost'
import BlockRowLabor from './BlockRowLabor'

function formatCost(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatHours(val) {
  if (val == null) return '--'
  return Number(val).toFixed(1) + 'h'
}

export default function BlockRow({ block, products, quoteId, onQuoteUpdate }) {
  const isCost = block.block_domain === 'cost'
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
    const isMember = !!memberMap[productId]
    try {
      const updated = isMember
        ? await quoteBlocks.removeMember(block.id, productId)
        : await quoteBlocks.addMember(block.id, productId)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to toggle member:', err)
    }
  }

  return (
    <>
      {/* Label cell */}
      <div className={`canvas-cell canvas-cell--label canvas-cell--block ${isCost ? 'canvas-cell--cost' : 'canvas-cell--labor'}`}>
        <div className="canvas-block-label-content">
          {isCost ? (
            <BlockRowCost block={block} onBlockUpdate={handleBlockUpdate} />
          ) : (
            <BlockRowLabor block={block} onBlockUpdate={handleBlockUpdate} />
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
              <div className="canvas-member-value" title="Click to remove from block">
                <span
                  className={`canvas-computed ${isCost ? 'canvas-computed--cost' : 'canvas-computed--hours'}`}
                  onClick={() => toggleMember(product.id)}
                >
                  {isCost ? formatCost(member.cost_pp) : formatHours(member.hours_pp)}
                </span>
              </div>
            ) : (
              <div className="canvas-member-empty">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleMember(product.id)}
                  title="Add product to this block"
                  className="canvas-member-checkbox"
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Spacer for the add-column */}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}
