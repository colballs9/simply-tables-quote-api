import ProductFieldCell from './ProductFieldCell'

/**
 * One grid row: label in sticky left column + per-product field cells + spacer.
 */
export default function ProductFieldRow({
  label, fieldKey, fieldType, products, optionId, onQuoteUpdate,
  options, optionLabels, step, placeholder, hidden,
}) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label canvas-cell--field-label" style={hidden ? { visibility: 'hidden' } : undefined}>
        <span className="pf-label">{label}</span>
      </div>
      {products.map(product => (
        <ProductFieldCell
          key={product.id}
          product={product}
          optionId={optionId}
          fieldKey={fieldKey}
          fieldType={fieldType}
          onQuoteUpdate={onQuoteUpdate}
          options={options}
          optionLabels={optionLabels}
          step={step}
          placeholder={placeholder}
          hidden={hidden}
          materialType={product.material_type}
        />
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}
