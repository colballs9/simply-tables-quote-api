import { useMemo, useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { products, quoteBlocks, tags as tagsApi } from '../api/client'
import ProductHeaderRow from './ProductHeaderRow'
import ProductFieldRow from './ProductFieldRow'
import MaterialBuilder from './MaterialBuilder'
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

const MATERIAL_TYPES = ['Hardwood', 'Stone', 'Live Edge', 'Laminate', 'Wood Edge Laminate', 'Outdoor', 'Other']
const SHAPES = ['Standard', 'DIA', 'Custom Shape', 'Base Only']
const HEIGHTS = ['Dining Height', 'Counter Height', 'Bar Height', 'Top Only', 'Custom Height']
const BASE_TYPES = ['Stock Base', 'Custom Base', 'Top Only']
const THICKNESSES = ['', '.75"', '1"', '1.25"', '1.5"', '1.75"', '2"', '2.25"', '2.5"']

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

const COST_SECTION_DEFAULTS = {
  material: 'species',
  base: 'stock_base',
  project: 'unit_cost',
}

export default function QuoteCanvas({ quote, activeOption, onQuoteUpdate }) {
  const [error, setError] = useState(null)
  const [availableTags, setAvailableTags] = useState([])
  const [specsOpen, setSpecsOpen] = useState(true)
  const [descOpen, setDescOpen] = useState(false)
  const [mbOpen, setMbOpen] = useState(false)
  const productList = activeOption?.products || []

  useEffect(() => {
    tagsApi.list().then(setAvailableTags).catch(err => console.error('Failed to load tags:', err))
  }, [])

  const sortedProducts = useMemo(() => stableSort(productList), [productList])
  const optionId = activeOption?.id

  const allBlocks = quote?.quote_blocks || []

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

  // Check if any product needs conditional fields
  const anyCustomShape = sortedProducts.some(p => p.shape === 'Custom Shape')
  const anyCustomHeight = sortedProducts.some(p => p.height_name === 'Custom Height')
  const anyHardwood = sortedProducts.some(p => p.material_type === 'Hardwood' || p.material_type === 'Live Edge')

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
        {/* ═══ PRODUCT TITLE ROW ═══ */}
        <ProductHeaderRow
          products={sortedProducts}
          activeOption={activeOption}
          onQuoteUpdate={onQuoteUpdate}
          onAddProduct={handleAddProduct}
        />

        {/* ═══ SPECS SECTION ═══ */}
        <SectionHeader label="Specs" open={specsOpen} onToggle={() => setSpecsOpen(v => !v)} />

        {specsOpen && (
          <>
            <ProductFieldRow label="Material Group" fieldKey="material_type" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={MATERIAL_TYPES} />
            <ProductFieldRow label="Material" fieldKey="material_detail" fieldType="materialSearch" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            <ProductFieldRow label="Qty" fieldKey="quantity" fieldType="number" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} step="1" />
            <ProductFieldRow label="Width" fieldKey="width" fieldType="number" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} step="0.25" />
            <ProductFieldRow label="Length" fieldKey="length" fieldType="number" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} step="0.25" />
            <ProductFieldRow label="Shape" fieldKey="shape" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={SHAPES} />
            {anyCustomShape && (
              <ProductFieldRow label="Shape Detail" fieldKey="shape_custom" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            )}
            <ProductFieldRow label="Height" fieldKey="height_name" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={HEIGHTS} />
            {anyCustomHeight && (
              <ProductFieldRow label="Height (in)" fieldKey="height_input" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            )}
            <ProductFieldRow label="Base" fieldKey="base_type" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={BASE_TYPES} />
            {anyHardwood && (
              <ProductFieldRow label="Thickness" fieldKey="lumber_thickness" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={THICKNESSES} optionLabels={THICKNESSES.map(t => t || '\u2014')} />
            )}
            <ProductFieldRow label="Bases/Top" fieldKey="bases_per_top" fieldType="number" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} step="1" />
          </>
        )}

        {/* ═══ DESCRIPTIONS SECTION ═══ */}
        <SectionHeader label="Descriptions" open={descOpen} onToggle={() => setDescOpen(v => !v)} />

        {descOpen && (
          <>
            <ProductFieldRow label="Edge Profile" fieldKey="edge_profile" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            <ProductFieldRow label="Stain/Color" fieldKey="stain_or_color" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            <ProductFieldRow label="Color Name" fieldKey="color_name" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            <ProductFieldRow label="Sheen" fieldKey="sheen" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            <ProductFieldRow label="Notes" fieldKey="notes" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
          </>
        )}

        {/* ═══ MATERIAL BUILDER SECTION ═══ */}
        <SectionHeader label="Material Builder" open={mbOpen} onToggle={() => setMbOpen(v => !v)} />

        {mbOpen && (
          <>
            <div className="canvas-cell canvas-cell--label canvas-cell--field-label" />
            {sortedProducts.map(product => (
              <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--field-value" style={{ alignItems: 'flex-start' }}>
                <MaterialBuilder product={product} onQuoteUpdate={onQuoteUpdate} compact />
              </div>
            ))}
            <div className="canvas-cell canvas-cell--spacer" />
          </>
        )}

        {/* ═══ COST BLOCKS ═══ */}
        <div className="canvas-section-header canvas-section-header--cost" style={{ gridColumn: '1 / -1' }}>
          <span>Cost Blocks</span>
        </div>

        {COST_SECTIONS.map(section => {
          const blocks = costBlocksBySection[section.key] || []
          const isEmpty = blocks.length === 0
          return (
            <div key={section.key} className="canvas-subsection" style={{ gridColumn: '1 / -1', display: 'contents' }}>
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

              {blocks.map(block => (
                <BlockRow
                  key={block.id}
                  block={block}
                  products={sortedProducts}
                  quoteId={quote.id}
                  onQuoteUpdate={onQuoteUpdate}
                  availableTags={availableTags}
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

              {blocks.map(block => (
                <BlockRow
                  key={block.id}
                  block={block}
                  products={sortedProducts}
                  quoteId={quote.id}
                  onQuoteUpdate={onQuoteUpdate}
                  availableTags={availableTags}
                />
              ))}
            </div>
          )
        })}

        {/* Rates section (collapsible) */}
        <RatesRow products={sortedProducts} activeOption={activeOption} onQuoteUpdate={onQuoteUpdate} />

        {/* Pricing section */}
        <div className="canvas-section-header canvas-section-header--pricing" style={{ gridColumn: '1 / -1' }}>
          <span>Pricing</span>
        </div>

        <PricingRow products={sortedProducts} activeOption={activeOption} quote={quote} onQuoteUpdate={onQuoteUpdate} />
      </div>
    </div>
  )
}


function SectionHeader({ label, open, onToggle }) {
  return (
    <>
      <div
        className="canvas-cell canvas-cell--label canvas-cell--section-toggle"
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        <span className="canvas-section-toggle-label">
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          {label}
        </span>
      </div>
      {/* Empty cells for product columns + spacer */}
      <div style={{ gridColumn: `2 / -1` }} className="canvas-cell canvas-cell--section-toggle-spacer" />
    </>
  )
}
