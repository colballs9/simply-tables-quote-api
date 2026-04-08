import { useState, useRef, useEffect, useCallback } from 'react'
import { materialContext } from '../api/client'

// Cache material context data across all instances
let cachedContextData = null
let fetchPromise = null

function fetchContextOnce() {
  if (cachedContextData) return Promise.resolve(cachedContextData)
  if (fetchPromise) return fetchPromise
  fetchPromise = materialContext.list()
    .then(data => {
      cachedContextData = data
      return data
    })
    .catch(err => {
      fetchPromise = null
      throw err
    })
  return fetchPromise
}

export default function MaterialSearch({ materialType, value, onChange, onBlur, disabled }) {
  const [contextData, setContextData] = useState(cachedContextData)
  const [open, setOpen] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(0)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Fetch material context on mount
  useEffect(() => {
    fetchContextOnce()
      .then(setContextData)
      .catch(err => console.error('Failed to load material context:', err))
  }, [])

  // Get options for the current material type
  const options = (() => {
    if (!contextData || !materialType) return []
    const entry = contextData.find(c =>
      c.material_type?.toLowerCase() === materialType.toLowerCase()
    )
    return entry?.material_options || []
  })()

  // Filter options based on current input
  const query = (value || '').trim().toLowerCase()
  const filtered = query
    ? options.filter(opt => opt.toLowerCase().includes(query))
    : options

  const exactMatch = options.some(opt => opt.toLowerCase() === query)
  const showAddNew = query && !exactMatch

  const totalItems = filtered.length + (showAddNew ? 1 : 0)

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIdx(0)
  }, [filtered.length, showAddNew])

  function selectOption(opt) {
    onChange(opt)
    setOpen(false)
    // Defer blur save to next tick so onChange settles first
    setTimeout(() => {
      if (inputRef.current) inputRef.current.blur()
    }, 0)
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      e.preventDefault()
      return
    }

    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx(i => Math.min(i + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlightIdx < filtered.length) {
        selectOption(filtered[highlightIdx])
      } else if (showAddNew) {
        selectOption(value.trim())
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  function handleFocus() {
    setOpen(true)
  }

  function handleBlur(e) {
    // Delay close so click on dropdown option registers first
    setTimeout(() => {
      setOpen(false)
      if (onBlur) onBlur()
    }, 150)
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (!open || !dropdownRef.current) return
    const items = dropdownRef.current.querySelectorAll('.mat-search-option')
    if (items[highlightIdx]) {
      items[highlightIdx].scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIdx, open])

  return (
    <div className="mat-search-wrapper">
      <input
        ref={inputRef}
        type="text"
        className="mat-search-input"
        value={value || ''}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Walnut"
        disabled={disabled}
      />
      {open && totalItems > 0 && (
        <div className="mat-search-dropdown" ref={dropdownRef}>
          {filtered.map((opt, i) => (
            <div
              key={opt}
              className={`mat-search-option${i === highlightIdx ? ' mat-search-option--highlighted' : ''}`}
              onMouseDown={e => { e.preventDefault(); selectOption(opt) }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              {opt}
            </div>
          ))}
          {showAddNew && (
            <div
              className={`mat-search-option mat-search-option--add${highlightIdx === filtered.length ? ' mat-search-option--highlighted' : ''}`}
              onMouseDown={e => { e.preventDefault(); selectOption(value.trim()) }}
              onMouseEnter={() => setHighlightIdx(filtered.length)}
            >
              Add "{value.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
