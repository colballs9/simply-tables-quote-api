import { useState, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { products as productsApi } from '../api/client'
import useSpreadsheetInput from '../hooks/useSpreadsheetInput'

export default function ProductHeaderRow({ products: productList, activeOption, onQuoteUpdate, onAddProduct }) {
  return (
    <>
      {/* Label column header */}
      <div className="canvas-cell canvas-cell--header canvas-cell--label" />

      {/* Product title/meta cells */}
      {productList.map(product => (
        <ProductTitleCell
          key={product.id}
          product={product}
          optionId={activeOption?.id}
          onQuoteUpdate={onQuoteUpdate}
        />
      ))}

      {/* Add product button column */}
      <div className="canvas-cell canvas-cell--header canvas-cell--add">
        <button className="canvas-add-product-btn" onClick={onAddProduct} title="Add product">
          <Plus size={14} />
        </button>
      </div>
    </>
  )
}


function ProductTitleCell({ product, optionId, onQuoteUpdate }) {
  const [title, setTitle] = useState(product.title || '')
  const focusRef = useRef(null)
  const origRef = useRef(null)
  const ss = useSpreadsheetInput(setTitle)

  // Sync from props when not focused
  const prevRef = useRef(product.title)
  if (product.title !== prevRef.current && !focusRef.current) {
    setTitle(product.title || '')
  }
  prevRef.current = product.title

  async function saveTitle() {
    focusRef.current = null
    if (title !== (product.title || '')) {
      try {
        const updated = await productsApi.update(optionId, product.id, { title: title || null })
        onQuoteUpdate(updated)
      } catch (e) { console.error(e) }
    }
  }

  async function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${product.title || 'this product'}"?`)) return
    try {
      const updated = await productsApi.delete(optionId, product.id)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to delete product:', err)
    }
  }

  const dims = []
  if (product.width) dims.push(`${product.width}"`)
  if (product.length) dims.push(`${product.length}"`)
  const dimStr = dims.join(' x ')

  return (
    <div className="canvas-cell canvas-cell--header canvas-product-column">
      <div className="canvas-product-header-top">
        <input
          className="canvas-product-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onFocus={e => { focusRef.current = 'title'; origRef.current = e.target.value; ss.onFocus(e) }}
          onBlur={saveTitle}
          onKeyDown={ss.onKeyDown}
          placeholder="Untitled"
        />
        <button className="canvas-product-delete" onClick={handleDelete} title="Delete product">
          <Trash2 size={11} />
        </button>
      </div>
      <div className="canvas-product-meta">
        <span className="canvas-product-badge">{product.material_type}</span>
        {product.quantity > 1 && <span className="canvas-product-qty">x{product.quantity}</span>}
        {dimStr && <span className="canvas-product-dims">{dimStr}</span>}
      </div>
    </div>
  )
}
