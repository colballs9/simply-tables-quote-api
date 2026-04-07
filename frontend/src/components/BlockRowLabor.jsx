import { useState, useRef } from 'react'

const LC_LABELS = {
  LC100: 'Handling', LC101: 'Processing', LC102: 'Belt Sand',
  LC103: 'Cutting', LC104: 'CNC', LC105: 'Wood Fab',
  LC106: 'Fin Sand', LC107: 'Metal Fab', LC108: 'Stone Fab',
  LC109: 'Finishing', LC110: 'Assembly', LC111: 'Packing',
}

const LABOR_CENTERS = Object.entries(LC_LABELS).map(([v, l]) => ({ value: v, label: `${v} ${l}` }))

const METRIC_SOURCES = [
  { value: 'panel_sqft', label: 'Panel SqFt' },
  { value: 'panel_count', label: 'Panels' },
  { value: 'top_sqft', label: 'Top SqFt' },
  { value: 'sq_ft', label: 'Sq Ft (DIA)' },
  { value: 'bd_ft', label: 'Bd Ft' },
]

const DIST_OPTIONS = [
  { value: 'units', label: 'By Units' },
  { value: 'sqft', label: 'By Sq Ft' },
  { value: 'bdft', label: 'By Bd Ft' },
]

export default function BlockRowLabor({ block, onBlockUpdate }) {
  const [label, setLabel] = useState(block.label || '')
  const [hoursPerUnit, setHoursPerUnit] = useState(String(block.hours_per_unit ?? ''))
  const [rateValue, setRateValue] = useState(String(block.rate_value ?? ''))
  const [totalHours, setTotalHours] = useState(String(block.total_hours ?? ''))

  const focusRef = useRef(null)

  // Sync from props on block identity change
  const prevBlockIdRef = useRef(block.id)
  if (block.id !== prevBlockIdRef.current) {
    prevBlockIdRef.current = block.id
    setLabel(block.label || '')
    setHoursPerUnit(String(block.hours_per_unit ?? ''))
    setRateValue(String(block.rate_value ?? ''))
    setTotalHours(String(block.total_hours ?? ''))
  }

  // Sync individual fields from props only when NOT focused
  const prevPropsRef = useRef({ label: block.label, hpu: block.hours_per_unit, rv: block.rate_value, th: block.total_hours })
  if (block.label !== prevPropsRef.current.label && focusRef.current !== 'label') {
    setLabel(block.label || '')
  }
  if (block.hours_per_unit !== prevPropsRef.current.hpu && focusRef.current !== 'hoursPerUnit') {
    setHoursPerUnit(String(block.hours_per_unit ?? ''))
  }
  if (block.rate_value !== prevPropsRef.current.rv && focusRef.current !== 'rateValue') {
    setRateValue(String(block.rate_value ?? ''))
  }
  if (block.total_hours !== prevPropsRef.current.th && focusRef.current !== 'totalHours') {
    setTotalHours(String(block.total_hours ?? ''))
  }
  prevPropsRef.current = { label: block.label, hpu: block.hours_per_unit, rv: block.rate_value, th: block.total_hours }

  const isGroup = block.block_type === 'group'
  const isRate = block.block_type === 'rate'

  function saveLabel() {
    focusRef.current = null
    if (label !== (block.label || '')) {
      onBlockUpdate({ label })
    }
  }

  function saveHoursPerUnit() {
    focusRef.current = null
    const val = parseFloat(hoursPerUnit)
    if (!isNaN(val) && val !== block.hours_per_unit) {
      onBlockUpdate({ hours_per_unit: val })
    }
  }

  function saveRateValue() {
    focusRef.current = null
    const val = parseFloat(rateValue)
    if (!isNaN(val) && val !== block.rate_value) {
      onBlockUpdate({ rate_value: val })
    }
  }

  function saveTotalHours() {
    focusRef.current = null
    const val = parseFloat(totalHours)
    if (!isNaN(val) && val !== block.total_hours) {
      onBlockUpdate({ total_hours: val })
    }
  }

  const typeIndicator = isGroup ? 'GRP' : isRate ? 'RATE' : 'UNIT'

  return (
    <div className="canvas-block-fields">
      <div className="canvas-block-label-row">
        <input
          className="canvas-block-label-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onFocus={() => { focusRef.current = 'label' }}
          onBlur={saveLabel}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          placeholder="Label..."
        />
        <span className="canvas-block-type-badge">{typeIndicator}</span>
      </div>
      <div className="canvas-block-fields-row">
        <select
          className="canvas-block-select"
          value={block.labor_center || 'LC100'}
          onChange={e => onBlockUpdate({ labor_center: e.target.value })}
        >
          {LABOR_CENTERS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {isGroup ? (
          <>
            <input
              className="canvas-block-num-input"
              type="number"
              step="0.25"
              value={totalHours}
              onChange={e => setTotalHours(e.target.value)}
              onFocus={() => { focusRef.current = 'totalHours' }}
              onBlur={saveTotalHours}
              placeholder="Total hrs"
              title="Total hours"
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
        ) : isRate ? (
          <>
            <input
              className="canvas-block-num-input"
              type="number"
              step="0.1"
              value={rateValue}
              onChange={e => setRateValue(e.target.value)}
              onFocus={() => { focusRef.current = 'rateValue' }}
              onBlur={saveRateValue}
              placeholder="Rate"
              title="Rate value (e.g. sqft/hr)"
            />
            <select
              className="canvas-block-select"
              value={block.metric_source || 'panel_sqft'}
              onChange={e => onBlockUpdate({ metric_source: e.target.value })}
            >
              {METRIC_SOURCES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </>
        ) : (
          <input
            className="canvas-block-num-input"
            type="number"
            step="0.01"
            value={hoursPerUnit}
            onChange={e => setHoursPerUnit(e.target.value)}
            onFocus={() => { focusRef.current = 'hoursPerUnit' }}
            onBlur={saveHoursPerUnit}
            placeholder="hrs/unit"
            title="Hours per unit"
          />
        )}
      </div>
    </div>
  )
}
