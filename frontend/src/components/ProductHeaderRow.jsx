import { Plus } from 'lucide-react'
import ProductColumn from './ProductColumn'

export default function ProductHeaderRow({ products: productList, activeOption, onQuoteUpdate, onAddProduct }) {
  return (
    <>
      {/* Label column header */}
      <div className="canvas-cell canvas-cell--header canvas-cell--label">
        {/* empty label column */}
      </div>

      {/* Product column headers */}
      {productList.map(product => (
        <ProductColumn
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
