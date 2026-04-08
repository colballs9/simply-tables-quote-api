import { useState, useRef, useCallback } from 'react'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

const BLOCK_TYPES = [
  { value: 'unit', label: 'Unit Cost' },
  { value: 'group', label: 'Group Cost' },
]

const MULTIPLIER_TYPES = [
  { value: 'per_unit', label: 'Units' },
  { value: 'per_piece', label: 'Pieces' },
  { value: 'per_base', label: 'Per Base' },
]

const DIST_OPTIONS = [
  { value: 'units', label: 'By Units' },
  { value: 'sqft', label: 'By Sq Ft' },
]

export default function BlockRowCost({ block, onBlockUpdate, availableTags }) {
  // Local draft state — only overwritten from props when NOT focused
  const [label, setLabel] = useState(block.label || '')
  const [totalAmount, setTotalAmount] = useState(String(block.total_amount ?? ''))

  // Track which field is focused to avoid clobbering during edits
  const focusRef = useRef(null)

  // Sync from props only when the block identity changes
  const prevBlockIdRef = useRef(block.id)
  if (block.id !== prevBlockIdRef.current) {
    prevBlockIdRef.current = block.id
    setLabel(block.label || '')
    setTotalAmount(String(block.total_amount ?? ''))
  }

  // Sync individual fields from props only when NOT focused
  const prevPropsRef = useRef({ label: block.label, ta: block.total_amount })
  if (block.label !== prevPropsRef.current.label && focusRef.current !== 'label') {
    setLabel(block.label || '')
  }
  if (block.total_amount !== prevPropsRef.current.ta && focusRef.current !== 'totalAmount') {
    setTotalAmount(String(block.total_amount ?? ''))
  }
  prevPropsRef.current = { label: block.label, ta: block.total_amount }

  const isGroup = block.block_type === 'group'

  const ssLabel = useSpreadsheetInput(setLabel)
  const ssTotalAmount = useSpreadsheetInput(setTotalAmount)

  function saveLabel() {
    focusRef.current = null
    if (label !== (block.label || '')) {
      onBlockUpdate({ label })
    }
  }

  function saveTotalAmount() {
    focusRef.current = null
    const val = parseFloat(totalAmount)
    if (!isNaN(val) && val !== block.total_amount) {
      onBlockUpdate({ total_amount: val })
    }
  }

  return (
    <div className="canvas-block-fields">
      <input
        className="canvas-block-label-input"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onFocus={e => { focusRef.current = 'label'; ssLabel.onFocus(e) }}
        onBlur={saveLabel}
        onKeyDown={ssLabel.onKeyDown}
        placeholder="Label..."
      />
      <div className="canvas-block-fields-row">
        <select
          className="canvas-block-select"
          value={block.block_type || 'unit'}
          onChange={e => onBlockUpdate({ block_type: e.target.value })}
        >
          {BLOCK_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {isGroup ? (
          <>
            <input
              className="canvas-block-num-input"
              type="number"
              step="1"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              onFocus={e => { focusRef.current = 'totalAmount'; ssTotalAmount.onFocus(e) }}
              onBlur={saveTotalAmount}
              onKeyDown={ssTotalAmount.onKeyDown}
              placeholder="Total $"
              title="Total amount"
            />
            <select
              className="canvas-block-select"
              value={block.distribution_type || 'units'}
              onChange={e => onBlockUpdate({ distribution_type: e.target.value })}
            >
              {DIST_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </>
        ) : (
          <select
            className="canvas-block-select"
            value={block.multiplier_type || 'per_unit'}
            onChange={e => onBlockUpdate({ multiplier_type: e.target.value })}
          >
            {MULTIPLIER_TYPES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        )}

        <select
          className="canvas-block-select canvas-block-tag-select"
          value={block.tag_id || ''}
          onChange={e => onBlockUpdate({ tag_id: e.target.value || null })}
        >
          <option value="">No Tag</option>
          {(availableTags || []).map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
