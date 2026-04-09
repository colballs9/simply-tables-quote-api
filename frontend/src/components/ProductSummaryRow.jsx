/**
 * Read-only summary row showing dims, shape, material, base type per product.
 */
export default function ProductSummaryRow({ products, stoneGroupNumbers }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--field-label">
        <span className="pf-label">Summary</span>
      </div>
      {products.map(product => {
        const dims = []
        if (product.length) dims.push(`${product.length}"`)
        if (product.width) dims.push(`${product.width}"`)
        const dimStr = dims.join(' x ')
        const height = product.height_name || ''
        const dimLine = [dimStr, height].filter(Boolean).join(' x ')

        const isStone = product.material_type && product.material_type.startsWith('Stone')
        const stoneKey = (product.material_detail || 'Stone').trim()
        const stoneNum = isStone ? stoneGroupNumbers?.[stoneKey] : null

        return (
          <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--field-value">
            <div className="product-summary-block">
              {dimLine && <div className="product-summary-line">{dimLine}</div>}
              <div className="product-summary-line">{product.shape || 'Standard'} Shape</div>
              <div className="product-summary-line">
                {product.material_detail || product.material_type}
                {stoneNum != null && <span className="stone-group-badge">{stoneNum}</span>}
              </div>
              <div className="product-summary-line">{product.base_type}</div>
            </div>
          </div>
        )
      })}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}
