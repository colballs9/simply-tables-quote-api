import { useState, useRef } from 'react'
import { products as productsApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

/**
 * Table Title row with +TAG/LOCATION toggle per product.
 */
export default function ProductTitleRow({ products, optionId, onQuoteUpdate }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--field-label">
        <span className="pf-label">Table Title</span>
      </div>
      {products.map(product => (
        <TitleCell key={product.id} product={product} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


function TitleCell({ product, optionId, onQuoteUpdate }) {
  const [title, setTitle] = useState(product.title || '')
  const [tagLoc, setTagLoc] = useState(product.tag_location || '')
  const [showTag, setShowTag] = useState(!!product.tag_location)
  const focusRef = useRef(null)
  const ssTitle = useSpreadsheetInput(setTitle)
  const ssTag = useSpreadsheetInput(setTagLoc)

  // Sync from props when not focused
  const prevRef = useRef(product)
  if (prevRef.current !== product) {
    if (focusRef.current !== 'title') setTitle(product.title || '')
    if (focusRef.current !== 'tag') setTagLoc(product.tag_location || '')
    if (product.tag_location && !showTag) setShowTag(true)
    prevRef.current = product
  }

  async function saveTitle() {
    focusRef.current = null
    if (title !== (product.title || '')) {
      try {
        const updated = await productsApi.update(optionId, product.id, { title: title || null })
        onQuoteUpdate(updated)
      } catch (e) { console.error(e) }
    }
  }

  async function saveTag() {
    focusRef.current = null
    if (tagLoc !== (product.tag_location || '')) {
      try {
        const updated = await productsApi.update(optionId, product.id, { tag_location: tagLoc || null })
        onQuoteUpdate(updated)
      } catch (e) { console.error(e) }
    }
  }

  return (
    <div className="canvas-cell canvas-cell--value canvas-cell--field-value">
      <div className="title-cell-row">
        <input
          className="pfc-input title-input"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={e => { focusRef.current = 'title'; ssTitle.onFocus(e) }}
          onBlur={saveTitle}
          onKeyDown={ssTitle.onKeyDown}
          placeholder="Table Title"
        />
        {!showTag ? (
          <button className="tag-location-btn" onClick={() => setShowTag(true)}>
            +TAG / LOCATION
          </button>
        ) : (
          <input
            className="pfc-input tag-input"
            type="text"
            value={tagLoc}
            onChange={e => setTagLoc(e.target.value)}
            onFocus={e => { focusRef.current = 'tag'; ssTag.onFocus(e) }}
            onBlur={saveTag}
            onKeyDown={ssTag.onKeyDown}
            placeholder="Tag / Location"
          />
        )}
      </div>
    </div>
  )
}
