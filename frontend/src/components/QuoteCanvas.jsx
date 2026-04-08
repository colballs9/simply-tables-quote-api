import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { products, quoteBlocks } from '../api/client'
import ProductHeaderRow from './ProductHeaderRow'
import BlockRow from './BlockRow'
import RatesRow from './RatesRow'
import PricingRow from './PricingRow'

function stableSort(items) {
  return [...items].sort((a, b) => {
    const aSort = Number.isFinite(a.sort_order) ? a.sort_order : 0
    const bSort = Number.isFinite(b.sort_order) ? b.sort_order : 0
    if (aSort !== bSort) return aSort - bSort
    return (a.id || '').localeCompare(b.id || '')
  })
}

/* ── Section definitions ── */

const COST_SECTIONS = [
  { key: 'material', label: 'Material Costs', categories: ['species', 'stone'] },
  { key: 'base', label: 'Base Costs', categories: ['stock_base', 'custom_base', 'powder_coat', 'stock_base_shipping'] },
  { key: 'project', label: 'Project Costs', categories: ['unit_cost', 'group_cost', 'misc', 'consumables'] },
]

const LABOR_SECTIONS = [
  { lc: 'LC101', label: '101 Processing' },
  { lc: 'LC102', label: '102 Belt Sanding' },
  { lc: 'LC103', label: '103 Cutting' },
  { lc: 'LC104', label: '104 CNC' },
  { lc: 'LC105', label: '105 Wood Fab' },
  { lc: 'LC106', label: '106 Finish Sanding' },
  { lc: 'LC107', label: '107 Metal Fab' },
  { lc: 'LC108', label: '108 Stone Fab' },
  { lc: 'LC109', label: '109 Finishing' },
  { lc: 'LC110', label: '110 Assembly' },
  { lc: 'LC100', label: '100 Material Handling' },
  { lc: 'LC111', label: '111 Packing + Loading' },
]

/* Default cost_category when adding a block to each cost section */
const COST_SECTION_DEFAULTS = {
  material: 'species',
  base: 'stock_base',
  project: 'unit_cost',
}

export default function QuoteCanvas({ quote, activeOption, onQuoteUpdate }) {
  const [error, setError] = useState(null)
  const productList = activeOption?.products || []

  const sortedProducts = useMemo(() => stableSort(productList), [productList])

  const allBlocks = quote?.quote_blocks || []

  /* Group cost blocks by section */
  const costBlocksBySection = useMemo(() => {
    const costBlocks = allBlocks.filter(b => b.block_domain === 'cost')
    const grouped = {}
    for (const section of COST_SECTIONS) {
      grouped[section.key] = stableSort(
        costBlocks.filter(b => section.categories.includes(b.cost_category))
      )
    }
    return grouped
  }, [allBlocks])

  /* Group labor blocks by labor_center */
  const laborBlocksByLC = useMemo(() => {
    const laborBlocks = allBlocks.filter(b => b.block_domain === 'labor')
    const grouped = {}
    for (const section of LABOR_SECTIONS) {
      grouped[section.lc] = stableSort(
        laborBlocks.filter(b => b.labor_center === section.lc)
      )
    }
    return grouped
  }, [allBlocks])

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

  async function handleAddCostBlock(sectionKey) {
    try {
      const payload = {
        block_domain: 'cost',
        block_type: 'unit',
        label: 'New Cost',
        cost_category: COST_SECTION_DEFAULTS[sectionKey] || 'unit_cost',
        multiplier_type: 'fixed',
        cost_per_unit: 0,
        units_per_product: 1,
        product_ids: sortedProducts.map(p => p.id),
      }
      const updated = await quoteBlocks.create(quote.id, payload)
      onQuoteUpdate(updated)
    } catch (err) {
      console.error('Failed to add block:', err)
    }
  }

  async function handleAddLaborBlock(laborCenter) {
    try {
      const payload = {
        block_domain: 'labor',
        block_type: 'unit',
        label: 'New Labor',
        labor_center: laborCenter,
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
          gridTemplateColumns: `240px repeat(${sortedProducts.length}, 200px) auto`,
        }}
      >
        {/* Product header row */}
        <ProductHeaderRow
          products={sortedProducts}
          activeOption={activeOption}
          onQuoteUpdate={onQuoteUpdate}
          onAddProduct={handleAddProduct}
        />

        {/* ═══ COST BLOCKS ═══ */}
        <div className="canvas-section-header canvas-section-header--cost" style={{ gridColumn: '1 / -1' }}>
          <span>Cost Blocks</span>
        </div>

        {COST_SECTIONS.map(section => {
          const blocks = costBlocksBySection[section.key] || []
          const isEmpty = blocks.length === 0
          return (
            <div key={section.key} className="canvas-subsection" style={{ gridColumn: '1 / -1', display: 'contents' }}>
              {/* Sub-section header */}
              <div
                className={`canvas-subsection-header canvas-subsection-header--cost ${isEmpty ? 'canvas-subsection-header--empty' : ''}`}
                style={{ gridColumn: '1 / -1' }}
              >
                <span className="canvas-subsection-label">{section.label}</span>
                <button
                  className="canvas-subsection-add-btn canvas-subsection-add-btn--cost"
                  onClick={() => handleAddCostBlock(section.key)}
                  title={`Add ${section.label.toLowerCase()} block`}
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Blocks in this section */}
              {blocks.map(block => (
                <BlockRow
                  key={block.id}
                  block={block}
                  products={sortedProducts}
                  quoteId={quote.id}
                  onQuoteUpdate={onQuoteUpdate}
                />
              ))}
            </div>
          )
        })}

        {/* ═══ HOURS BLOCKS ═══ */}
        <div className="canvas-section-header canvas-section-header--labor" style={{ gridColumn: '1 / -1' }}>
          <span>Hours Blocks</span>
        </div>

        {LABOR_SECTIONS.map(section => {
          const blocks = laborBlocksByLC[section.lc] || []
          const isEmpty = blocks.length === 0
          return (
            <div key={section.lc} className="canvas-subsection" style={{ gridColumn: '1 / -1', display: 'contents' }}>
              {/* Sub-section header */}
              <div
                className={`canvas-subsection-header canvas-subsection-header--labor ${isEmpty ? 'canvas-subsection-header--empty' : ''}`}
                style={{ gridColumn: '1 / -1' }}
              >
                <span className="canvas-subsection-label">{section.label}</span>
                <button
                  className="canvas-subsection-add-btn canvas-subsection-add-btn--labor"
                  onClick={() => handleAddLaborBlock(section.lc)}
                  title={`Add ${section.label} block`}
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Blocks in this section */}
              {blocks.map(block => (
                <BlockRow
                  key={block.id}
                  block={block}
                  products={sortedProducts}
                  quoteId={quote.id}
                  onQuoteUpdate={onQuoteUpdate}
                />
              ))}
            </div>
          )
        })}

        {/* Rates section (collapsible) */}
        <RatesRow products={sortedProducts} activeOption={activeOption} onQuoteUpdate={onQuoteUpdate} />

        {/* Pricing section header */}
        <div className="canvas-section-header canvas-section-header--pricing" style={{ gridColumn: '1 / -1' }}>
          <span>Pricing</span>
        </div>

        <PricingRow products={sortedProducts} activeOption={activeOption} onQuoteUpdate={onQuoteUpdate} />
      </div>
    </div>
  )
}
