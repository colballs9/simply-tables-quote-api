import { useState, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { products } from '../api/client'

export default function ProductHeaderRow({ products: productList, activeOption, onQuoteUpdate, onAddProduct, selectedProductId, onProductSelect }) {
  return (
    <>
      {/* Label column header */}
      <div className="canvas-cell canvas-cell--header canvas-cell--label">
        {/* empty label column */}
      </div>

      {/* Product column headers */}
      {productList.map(product => (
        <ProductHeaderCell
          key={product.id}
          product={product}
          optionId={activeOption?.id}
          onQuoteUpdate={onQuoteUpdate}
          isSelected={product.id === selectedProductId}
          onSelect={() => onProductSelect?.(product.id === selectedProductId ? null : product.id)}
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

function ProductHeaderCell({ product, optionId, onQuoteUpdate, isSelected, onSelect }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(product.title || '')

  // Sync title from props when product changes (but not while editing)
  const prevTitleRef = useRef(product.title)
  if (product.title !== prevTitleRef.current && !editing) {
    setTitle(product.title || '')
  }
  prevTitleRef.current = product.title

  async function saveTitle() {
    setEditing(false)
    if (title === product.title) return
    try {
      const updated = await products.update(optionId, product.id, { title })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to update product title:', err)
      setTitle(product.title || '')
    }
  }

  async function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${product.title || 'this product'}"?`)) return
    try {
      const updated = await products.delete(optionId, product.id)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to delete product:', err)
    }
  }

  function handleTitleClick(e) {
    e.stopPropagation() // Don't trigger the outer onSelect
    setEditing(true)
  }

  const dims = []
  if (product.width) dims.push(`${product.width}"`)
  if (product.length) dims.push(`${product.length}"`)
  const dimStr = dims.join(' x ')

  return (
    <div
      className={`canvas-cell canvas-cell--header canvas-product-header${isSelected ? ' canvas-product-header--selected' : ''}`}
      onClick={onSelect}
      title="Click to edit rates & margins"
    >
      <div className="canvas-product-header-top">
        {editing ? (
          <input
            className="canvas-product-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') saveTitle() }}
            onClick={e => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span
            className="canvas-product-title"
            onClick={handleTitleClick}
            title="Click to edit title"
          >
            {product.title || 'Untitled'}
          </span>
        )}
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
