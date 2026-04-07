import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { products, quoteBlocks } from '../api/client'
import ProductHeaderRow from './ProductHeaderRow'
import BlockRow from './BlockRow'
import PricingRow from './PricingRow'

// Stable sort: by sort_order first, then by id (string compare for UUIDs — stable across renders)
function stableSort(items) {
  return [...items].sort((a, b) => {
    const aSort = Number.isFinite(a.sort_order) ? a.sort_order : 0
    const bSort = Number.isFinite(b.sort_order) ? b.sort_order : 0
    if (aSort !== bSort) return aSort - bSort
    return (a.id || '').localeCompare(b.id || '')
  })
}

export default function QuoteCanvas({ quote, activeOption, onQuoteUpdate, selectedProductId, onProductSelect }) {
  const [error, setError] = useState(null)
  const productList = activeOption?.products || []

  // Memoize sorted lists so child components get stable references
  const sortedProducts = useMemo(() => stableSort(productList), [productList])

  const allBlocks = quote?.quote_blocks || []
  const costBlocks = useMemo(
    () => stableSort(allBlocks.filter(b => b.block_domain === 'cost')),
    [allBlocks]
  )
  const laborBlocks = useMemo(
    () => stableSort(allBlocks.filter(b => b.block_domain === 'labor')),
    [allBlocks]
  )

  async function handleAddProduct() {
    if (!activeOption) {
      setError('No option available — cannot add product')
      return
    }
    setError(null)
    try {
      const updated = await products.add(activeOption.id, {
        title: `Product ${(productList.length || 0) + 1}`,
        material_type: 'Hardwood',
        quantity: 1,
      })
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to add product:', err)
      setError(err.message || 'Failed to add product')
    }
  }

  async function handleAddBlock(domain) {
    try {
      const payload = domain === 'cost'
        ? {
            block_domain: 'cost',
            block_type: 'unit',
            label: 'New Cost',
            cost_category: 'unit_cost',
            multiplier_type: 'fixed',
            cost_per_unit: 0,
            units_per_product: 1,
            product_ids: sortedProducts.map(p => p.id),
          }
        : {
            block_domain: 'labor',
            block_type: 'unit',
            label: 'New Labor',
            labor_center: 'LC100',
            hours_per_unit: 0,
            product_ids: sortedProducts.map(p => p.id),
          }
      const updated = await quoteBlocks.create(quote.id, payload)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to add block:', err)
    }
  }

  return (
    <div className="canvas-grid-wrapper">
      {error && (
        <div className="notice notice-error compact-notice" style={{ marginBottom: 8 }}>
          <span>{error}</span>
        </div>
      )}
      <div
        className="canvas-grid"
        style={{
          gridTemplateColumns: `240px repeat(${sortedProducts.length}, 140px) auto`,
        }}
      >
        {/* Product header row */}
        <ProductHeaderRow
          products={sortedProducts}
          activeOption={activeOption}
          onQuoteUpdate={onQuoteUpdate}
          onAddProduct={handleAddProduct}
          selectedProductId={selectedProductId}
          onProductSelect={onProductSelect}
        />

        {/* Cost blocks section header */}
        <div className="canvas-section-header canvas-section-header--cost" style={{ gridColumn: '1 / -1' }}>
          <span>Cost Blocks</span>
        </div>

        {costBlocks.length === 0 && (
          <div className="canvas-empty-section" style={{ gridColumn: '1 / -1' }}>
            No cost blocks yet
          </div>
        )}

        {costBlocks.map(block => (
          <BlockRow
            key={block.id}
            block={block}
            products={sortedProducts}
            quoteId={quote.id}
            onQuoteUpdate={onQuoteUpdate}
          />
        ))}

        {/* Add cost block row */}
        <div className="canvas-add-row" style={{ gridColumn: '1 / -1' }}>
          <button className="canvas-add-btn canvas-add-btn--cost" onClick={() => handleAddBlock('cost')}>
            <Plus size={13} /> Add Cost Block
          </button>
        </div>

        {/* Labor blocks section header */}
        <div className="canvas-section-header canvas-section-header--labor" style={{ gridColumn: '1 / -1' }}>
          <span>Labor Blocks</span>
        </div>

        {laborBlocks.length === 0 && (
          <div className="canvas-empty-section" style={{ gridColumn: '1 / -1' }}>
            No labor blocks yet
          </div>
        )}

        {laborBlocks.map(block => (
          <BlockRow
            key={block.id}
            block={block}
            products={sortedProducts}
            quoteId={quote.id}
            onQuoteUpdate={onQuoteUpdate}
          />
        ))}

        {/* Add labor block row */}
        <div className="canvas-add-row" style={{ gridColumn: '1 / -1' }}>
          <button className="canvas-add-btn canvas-add-btn--labor" onClick={() => handleAddBlock('labor')}>
            <Plus size={13} /> Add Labor Block
          </button>
        </div>

        {/* Pricing section header */}
        <div className="canvas-section-header canvas-section-header--pricing" style={{ gridColumn: '1 / -1' }}>
          <span>Pricing</span>
        </div>

        <PricingRow products={sortedProducts} />
      </div>
    </div>
  )
}
