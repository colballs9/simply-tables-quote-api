function formatPrice(val) {
  if (val == null) return '--'
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatHours(val) {
  if (val == null) return '--'
  return Number(val).toFixed(1) + 'h'
}

const PRICING_ROWS = [
  { key: 'total_material_cost', label: 'Material Cost', format: formatPrice, accent: 'cost' },
  { key: 'total_hours_pp', label: 'Total Hours', format: formatHours, accent: 'hours' },
  { key: 'price_pp', label: 'Price PP', format: formatPrice, accent: 'price' },
  { key: 'sale_price_pp', label: 'Sale Price PP', format: formatPrice, accent: 'price' },
  { key: 'sale_price_total', label: 'Sale Price Total', format: formatPrice, accent: 'final' },
]

export default function PricingRow({ products }) {
  return (
    <>
      {PRICING_ROWS.map(row => (
        <PricingLine key={row.key} row={row} products={products} />
      ))}
    </>
  )
}

function PricingLine({ row, products }) {
  return (
    <>
      {/* Label cell */}
      <div className="canvas-cell canvas-cell--label canvas-cell--pricing-label">
        <span className="canvas-pricing-label">{row.label}</span>
      </div>

      {/* Value cells */}
      {products.map(product => (
        <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--pricing-value">
          <span className={`canvas-pricing-value canvas-pricing-value--${row.accent}`}>
            {row.format(product[row.key])}
          </span>
        </div>
      ))}

      {/* Spacer */}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}
