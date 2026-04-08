import { useRef, useCallback } from 'react'

/**
 * Spreadsheet-style input behavior:
 * - Single click / tab-in: selects all text so typing replaces it
 * - Double click: browser naturally places cursor for editing
 * - Enter: commits (blurs the input)
 * - Escape: reverts to original value and blurs
 *
 * Usage:
 *   const ss = useSpreadsheetInput(setLocalVal)
 *   <input {...ss.props} onFocus={e => { ss.props.onFocus(e); yourFocus() }} ... />
 *
 * Or use the individual handlers: ss.onFocus, ss.onKeyDown
 * Call ss.revertAndBlur(e, originalValue) for custom Escape handling.
 */
export default function useSpreadsheetInput(setLocalVal) {
  const origRef = useRef(null)

  const onFocus = useCallback((e) => {
    origRef.current = e.target.value
    e.target.select()
  }, [])

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    } else if (e.key === 'Escape') {
      if (setLocalVal && origRef.current !== null) {
        setLocalVal(origRef.current)
      }
      e.target.blur()
    }
  }, [setLocalVal])

  return { onFocus, onKeyDown, origRef }
}
