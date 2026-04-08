import { useState, useRef, useCallback } from 'react'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

const BLOCK_TYPES = [
  { value: 'unit', label: 'Unit Cost' },
  { value: 'group', label: 'Group Cost' },
  { value: 'rate', label: 'Rate Cost' },
]

const MULTIPLIER_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'per_piece', label: 'Pieces' },
  { value: 'per_base', label: 'Per Base' },
  { value: 'per_sqft', label: 'Per Sq Ft' },
  { value: 'per_bdft', label: 'Per Bd Ft' },
]

const DIST_OPTIONS = [
  { value: 'units', label: 'By Units' },
  { value: 'sqft', label: 'By Sq Ft' },
  { value: 'bdft', label: 'By Bd Ft' },
]

export default function BlockRowCost({ block, onBlockUpdate }) {
  // Local draft state — only overwritten from props when NOT focused
  const [label, setLabel] = useState(block.label || '')
  const [costPerUnit, setCostPerUnit] = useState(String(block.cost_per_unit ?? ''))
  const [totalAmount, setTotalAmount] = useState(String(block.total_amount ?? ''))
  const [unitsPerProduct, setUnitsPerProduct] = useState(String(block.units_per_product ?? 1))

  // Track which field is focused to avoid clobbering during edits
  const focusRef = useRef(null)

  // Sync from props only when the block identity changes
  const prevBlockIdRef = useRef(block.id)
  if (block.id !== prevBlockIdRef.current) {
    prevBlockIdRef.current = block.id
    setLabel(block.label || '')
    setCostPerUnit(String(block.cost_per_unit ?? ''))
    setTotalAmount(String(block.total_amount ?? ''))
    setUnitsPerProduct(String(block.units_per_product ?? 1))
  }

  // Sync individual fields from props only when NOT focused
  const prevPropsRef = useRef({ label: block.label, cpu: block.cost_per_unit, ta: block.total_amount, upp: block.units_per_product })
  if (block.label !== prevPropsRef.current.label && focusRef.current !== 'label') {
    setLabel(block.label || '')
  }
  if (block.cost_per_unit !== prevPropsRef.current.cpu && focusRef.current !== 'costPerUnit') {
    setCostPerUnit(String(block.cost_per_unit ?? ''))
  }
  if (block.total_amount !== prevPropsRef.current.ta && focusRef.current !== 'totalAmount') {
    setTotalAmount(String(block.total_amount ?? ''))
  }
  if (block.units_per_product !== prevPropsRef.current.upp && focusRef.current !== 'unitsPerProduct') {
    setUnitsPerProduct(String(block.units_per_product ?? 1))
  }
  prevPropsRef.current = { label: block.label, cpu: block.cost_per_unit, ta: block.total_amount, upp: block.units_per_product }

  const isGroup = block.block_type === 'group'

  const ssLabel = useSpreadsheetInput(setLabel)
  const ssCostPerUnit = useSpreadsheetInput(setCostPerUnit)
  const ssTotalAmount = useSpreadsheetInput(setTotalAmount)
  const ssUnitsPerProduct = useSpreadsheetInput(setUnitsPerProduct)

  function saveLabel() {
    focusRef.current = null
    if (label !== (block.label || '')) {
      onBlockUpdate({ label })
    }
  }

  function saveCostPerUnit() {
    focusRef.current = null
    const val = parseFloat(costPerUnit)
    if (!isNaN(val) && val !== block.cost_per_unit) {
      onBlockUpdate({ cost_per_unit: val })
    }
  }

  function saveTotalAmount() {
    focusRef.current = null
    const val = parseFloat(totalAmount)
    if (!isNaN(val) && val !== block.total_amount) {
      onBlockUpdate({ total_amount: val })
    }
  }

  function saveUnitsPerProduct() {
    focusRef.current = null
    const val = parseFloat(unitsPerProduct)
    if (!isNaN(val) && val !== block.units_per_product) {
      onBlockUpdate({ units_per_product: val })
    }
  }

  const showUnitsPP = !isGroup && (block.multiplier_type === 'fixed' || block.multiplier_type === 'per_piece')

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
          <>
            <select
              className="canvas-block-select"
              value={block.multiplier_type || 'fixed'}
              onChange={e => onBlockUpdate({ multiplier_type: e.target.value })}
            >
              {MULTIPLIER_TYPES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              className="canvas-block-num-input"
              type="number"
              step="0.01"
              value={costPerUnit}
              onChange={e => setCostPerUnit(e.target.value)}
              onFocus={e => { focusRef.current = 'costPerUnit'; ssCostPerUnit.onFocus(e) }}
              onBlur={saveCostPerUnit}
              onKeyDown={ssCostPerUnit.onKeyDown}
              placeholder="$/unit"
              title="Cost per unit"
            />
            {showUnitsPP && (
              <input
                className="canvas-block-num-input"
                type="number"
                step="1"
                value={unitsPerProduct}
                onChange={e => setUnitsPerProduct(e.target.value)}
                onFocus={e => { focusRef.current = 'unitsPerProduct'; ssUnitsPerProduct.onFocus(e) }}
                onBlur={saveUnitsPerProduct}
                onKeyDown={ssUnitsPerProduct.onKeyDown}
                placeholder="qty"
                title="Units per product (pieces per table)"
                style={{ width: 50 }}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
