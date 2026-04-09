import { useMemo, useState, useEffect } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { products, quoteBlocks, tags as tagsApi } from '../api/client'
import ProductHeaderRow from './ProductHeaderRow'
import ProductSummaryRow from './ProductSummaryRow'
import ProductTitleRow from './ProductTitleRow'
import ProductFieldRow from './ProductFieldRow'
import ProductMultiFieldRow from './ProductMultiFieldRow'
import ProductMaterialRow from './ProductMaterialRow'
import MaterialBuilder from './MaterialBuilder'
import DescriptionSubSection from './DescriptionSubSection'
import BlockRow from './BlockRow'
import SpeciesBlockRow from './SpeciesBlockRow'
import StoneBlockRow from './StoneBlockRow'
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
const INDOOR_OUTDOOR = ['Indoor', 'Outdoor']
const STAIN_OPTIONS = ['Stain', 'Natural', 'Paint']
const SHEEN_OPTIONS = ['', 'Matte', 'Satin', 'Semi-Gloss', 'Gloss']
const GRAIN_OPTIONS = ['', 'Book Match', 'Slip Match', 'Random', 'Other']

/* ── Top Description fields by material type ── */
const HARDWOOD_FINISHES = [
  { label: 'Material', fieldKey: 'material_detail', fieldType: 'text' },
  { label: 'Style', fieldKey: 'top_description', fieldType: 'text' },
  { label: 'Stain / Natural', fieldKey: 'stain_or_color', fieldType: 'select', options: STAIN_OPTIONS },
  { label: 'Stain Color', fieldKey: 'color_name', fieldType: 'text' },
  { label: 'Sheen', fieldKey: 'sheen', fieldType: 'select', options: SHEEN_OPTIONS, optionLabels: SHEEN_OPTIONS.map(s => s || '\u2014') },
  { label: 'Grain Direction', fieldKey: 'grain_direction', fieldType: 'select', options: GRAIN_OPTIONS, optionLabels: GRAIN_OPTIONS.map(s => s || '\u2014') },
]

const STONE_FINISHES = [
  { label: 'Material', fieldKey: 'material_detail', fieldType: 'text' },
  { label: 'Manufacturer', fieldKey: 'stone_manufacturer', fieldType: 'text' },
  { label: 'Color', fieldKey: 'stone_color', fieldType: 'text' },
  { label: 'Finish / Sheen', fieldKey: 'stone_finish', fieldType: 'text' },
]

const DEFAULT_FINISHES = [
  { label: 'Material', fieldKey: 'material_detail', fieldType: 'text' },
  { label: 'Stain / Color', fieldKey: 'stain_or_color', fieldType: 'text' },
  { label: 'Color Name', fieldKey: 'color_name', fieldType: 'text' },
  { label: 'Sheen', fieldKey: 'sheen', fieldType: 'select', options: SHEEN_OPTIONS, optionLabels: SHEEN_OPTIONS.map(s => s || '\u2014') },
]

const EDGE_FIELDS = [
  { label: 'Thickness', fieldKey: 'lumber_thickness', fieldType: 'select', options: THICKNESSES, optionLabels: THICKNESSES.map(t => t || '\u2014') },
  { label: 'Edge Profile', fieldKey: 'edge_profile', fieldType: 'text' },
]

const OTHER_FIELDS = [
  { label: 'Notes', fieldKey: 'notes', fieldType: 'text' },
]

const STOCK_BASE_FIELDS = [
  { label: 'Vendor', fieldKey: 'base_vendor', fieldType: 'text' },
  { label: 'Style / Series', fieldKey: 'base_style', fieldType: 'text' },
  { label: 'Size', fieldKey: 'base_size', fieldType: 'text' },
  { label: 'Height', fieldKey: 'base_height', fieldType: 'text' },
  { label: 'Finish / Color', fieldKey: 'base_finish_color', fieldType: 'text' },
]

const CUSTOM_BASE_FIELDS = [
  { label: 'Materials', fieldKey: 'base_materials', fieldType: 'text' },
  { label: 'Style', fieldKey: 'base_style', fieldType: 'text' },
  { label: 'Size', fieldKey: 'base_size', fieldType: 'text' },
  { label: 'Finish', fieldKey: 'base_finish', fieldType: 'text' },
  { label: 'Color', fieldKey: 'base_color', fieldType: 'text' },
]

const COST_SECTIONS = [
  { key: 'hardwood', label: 'Hardwood', categories: ['species'], parent: 'material' },
  { key: 'stone', label: 'Stone', categories: ['stone'], parent: 'material' },
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
  hardwood: 'species',
  stone: 'stone',
  base: 'stock_base',
  project: 'unit_cost',
}

export default function QuoteCanvas({ quote, activeOption, onQuoteUpdate }) {
  const [error, setError] = useState(null)
  const [availableTags, setAvailableTags] = useState([])
  const [specsOpen, setSpecsOpen] = useState(true)
  const [topDescOpen, setTopDescOpen] = useState(false)
  const [baseDescOpen, setBaseDescOpen] = useState(false)
  const [mbOpen, setMbOpen] = useState(false)
  const productList = activeOption?.products || []

  useEffect(() => {
    tagsApi.list().then(setAvailableTags).catch(err => console.error('Failed to load tags:', err))
  }, [])

  const sortedProducts = useMemo(() => stableSort(productList), [productList])
  const optionId = activeOption?.id

  const allBlocks = quote?.quote_blocks || []
  const speciesAssignmentMap = useMemo(() => {
    const map = {}
    ;(quote?.species_assignments || []).forEach(sa => {
      map[sa.species_key] = sa
    })
    return map
  }, [quote?.species_assignments])

  const stoneAssignmentMap = useMemo(() => {
    const map = {}
    ;(quote?.stone_assignments || []).forEach(sa => {
      map[sa.stone_key] = sa
    })
    return map
  }, [quote?.stone_assignments])


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
        {/* ═══ PRODUCT HEADER ROW ═══ */}
        <ProductHeaderRow
          products={sortedProducts}
          activeOption={activeOption}
          onQuoteUpdate={onQuoteUpdate}
          onAddProduct={handleAddProduct}
        />

        {/* ═══ SUMMARY ═══ */}
        <ProductSummaryRow products={sortedProducts} />

        {/* ═══ TABLE TITLE ═══ */}
        <ProductTitleRow products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />

        {/* ═══ SPECS SECTION ═══ */}
        <SectionHeader label="Specs" open={specsOpen} onToggle={() => setSpecsOpen(v => !v)} />

        {specsOpen && (
          <>
            <ProductFieldRow label="Quantity" fieldKey="quantity" fieldType="number" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} step="1" />
            <ProductMultiFieldRow
              label="Length | Width | Height"
              products={sortedProducts}
              optionId={optionId}
              onQuoteUpdate={onQuoteUpdate}
              fields={[
                { fieldKey: 'length', fieldType: 'number', step: '0.25', placeholder: 'L' },
                { fieldKey: 'width', fieldType: 'number', step: '0.25', placeholder: 'W', separator: 'x' },
                { fieldKey: 'height_name', fieldType: 'select', options: HEIGHTS, separator: 'x' },
              ]}
            />
            <ProductFieldRow label="Shape" fieldKey="shape" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={SHAPES} />
            <ProductFieldRow label="Shape Detail" fieldKey="shape_custom" fieldType="text" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} placeholder="Shape description if custom shape" />

            {/* Divider */}
            <div className="canvas-cell canvas-cell--label canvas-cell--divider" />
            <div className="canvas-cell canvas-cell--divider" style={{ gridColumn: `2 / -1` }} />

            <ProductFieldRow label="Material Group" fieldKey="material_type" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={MATERIAL_TYPES} />
            <ProductMaterialRow products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} />
            <ProductMultiFieldRow
              label="Base Type | Bases Per Top"
              products={sortedProducts}
              optionId={optionId}
              onQuoteUpdate={onQuoteUpdate}
              fields={[
                { fieldKey: 'base_type', fieldType: 'select', options: BASE_TYPES },
                { fieldKey: 'bases_per_top', fieldType: 'number', step: '1' },
              ]}
            />
            <ProductFieldRow label="Indoor / Outdoor" fieldKey="indoor_outdoor" fieldType="select" products={sortedProducts} optionId={optionId} onQuoteUpdate={onQuoteUpdate} options={INDOOR_OUTDOOR} />
          </>
        )}

        {/* ═══ TOP DESCRIPTIONS ═══ */}
        <SectionHeader label="Top Descriptions" open={topDescOpen} onToggle={() => setTopDescOpen(v => !v)} />

        {topDescOpen && (
          <>
            {/* Material type badge row */}
            <MaterialTypeBadgeRow products={sortedProducts} />

            <DescriptionSubSection
              label="Finishes"
              section="top_finishes"
              fields={getFinishFields(sortedProducts)}
              products={sortedProducts}
              optionId={optionId}
              onQuoteUpdate={onQuoteUpdate}
            />

            <DescriptionSubSection
              label="Edge"
              section="top_edge"
              fields={EDGE_FIELDS}
              products={sortedProducts}
              optionId={optionId}
              onQuoteUpdate={onQuoteUpdate}
            />

            <DescriptionSubSection
              label="Other"
              section="top_other"
              fields={OTHER_FIELDS}
              products={sortedProducts}
              optionId={optionId}
              onQuoteUpdate={onQuoteUpdate}
            />
          </>
        )}

        {/* ═══ BASE DESCRIPTIONS ═══ */}
        <SectionHeader label="Base Descriptions" open={baseDescOpen} onToggle={() => setBaseDescOpen(v => !v)} />

        {baseDescOpen && (
          <>
            {/* Base type badge row */}
            <BaseTypeBadgeRow products={sortedProducts} />

            <DescriptionSubSection
              label="Base"
              section="base"
              fields={getBaseFields(sortedProducts)}
              products={sortedProducts}
              optionId={optionId}
              onQuoteUpdate={onQuoteUpdate}
            />
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

        {COST_SECTIONS.map((section, sIdx) => {
          const blocks = costBlocksBySection[section.key] || []
          const isEmpty = blocks.length === 0
          // Insert "Material Costs" parent header before first material sub-section
          const showMaterialHeader = section.parent === 'material' && sIdx === 0
          const isNextAlsoMaterial = COST_SECTIONS[sIdx + 1]?.parent === 'material'
          return (
            <div key={section.key} className="canvas-subsection" style={{ gridColumn: '1 / -1', display: 'contents' }}>
              {showMaterialHeader && (
                <div className="canvas-subsection-header canvas-subsection-header--cost canvas-subsection-header--parent" style={{ gridColumn: '1 / -1' }}>
                  <span className="canvas-subsection-label">Material Costs</span>
                </div>
              )}
              <div
                className={`canvas-subsection-header canvas-subsection-header--cost ${section.parent ? 'canvas-subsection-header--child' : ''} ${isEmpty ? 'canvas-subsection-header--empty' : ''}`}
                style={{ gridColumn: '1 / -1' }}
              >
                <span className="canvas-subsection-label">{section.label}</span>
                {!section.parent && (
                  <button
                    className="canvas-subsection-add-btn canvas-subsection-add-btn--cost"
                    onClick={() => handleAddCostBlock(section.key)}
                    title={`Add ${section.label.toLowerCase()} block`}
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {blocks.map(block => (
                block.is_builtin && block.cost_category === 'species' ? (
                  <SpeciesBlockRow
                    key={block.id}
                    block={block}
                    products={sortedProducts}
                    quoteId={quote.id}
                    speciesAssignment={speciesAssignmentMap[block.label]}
                    onQuoteUpdate={onQuoteUpdate}
                  />
                ) : block.is_builtin && block.cost_category === 'stone' ? (
                  <StoneBlockRow
                    key={block.id}
                    block={block}
                    products={sortedProducts}
                    quoteId={quote.id}
                    stoneAssignment={stoneAssignmentMap[block.label]}
                    stoneNumber={parseInt(block.label, 10) || 1}
                    onQuoteUpdate={onQuoteUpdate}
                  />
                ) : (
                  <BlockRow
                    key={block.id}
                    block={block}
                    products={sortedProducts}
                    quoteId={quote.id}
                    onQuoteUpdate={onQuoteUpdate}
                    availableTags={availableTags}
                  />
                )
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
        <RatesRow products={sortedProducts} quote={quote} onQuoteUpdate={onQuoteUpdate} />

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


/* ── Helper: pick finish fields based on material types present ── */

function getFinishFields(products) {
  // If any product is Stone, show stone fields; if any is Hardwood/Live Edge, show hardwood fields
  // For mixed quotes, show the superset — fields handle per-product visibility via fieldKey existence
  const hasStone = products.some(p => p.material_type === 'Stone')
  const hasHardwood = products.some(p => p.material_type === 'Hardwood' || p.material_type === 'Live Edge')

  if (hasStone && !hasHardwood) return STONE_FINISHES
  if (hasHardwood && !hasStone) return HARDWOOD_FINISHES
  if (hasStone && hasHardwood) {
    // Superset: show all unique fields
    return [...HARDWOOD_FINISHES, ...STONE_FINISHES.filter(sf => !HARDWOOD_FINISHES.some(hf => hf.fieldKey === sf.fieldKey))]
  }
  return DEFAULT_FINISHES
}


/* ── Helper: pick base fields based on base types present ── */

function getBaseFields(products) {
  const hasStock = products.some(p => p.base_type === 'Stock Base')
  const hasCustom = products.some(p => p.base_type === 'Custom Base')

  if (hasStock && !hasCustom) return STOCK_BASE_FIELDS
  if (hasCustom && !hasStock) return CUSTOM_BASE_FIELDS
  // Mixed: show superset
  return [...STOCK_BASE_FIELDS, ...CUSTOM_BASE_FIELDS.filter(cf => !STOCK_BASE_FIELDS.some(sf => sf.fieldKey === cf.fieldKey))]
}


/* ── Material type badge row ── */

function MaterialTypeBadgeRow({ products }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label" />
      {products.map(product => (
        <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--badge-row">
          <span className="desc-material-badge">{product.material_type}</span>
        </div>
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}


/* ── Base type badge row ── */

function BaseTypeBadgeRow({ products }) {
  return (
    <>
      <div className="canvas-cell canvas-cell--label" />
      {products.map(product => (
        <div key={product.id} className="canvas-cell canvas-cell--value canvas-cell--badge-row">
          <span className="desc-base-badge">{product.base_type}</span>
        </div>
      ))}
      <div className="canvas-cell canvas-cell--spacer" />
    </>
  )
}
