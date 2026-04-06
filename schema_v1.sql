-- ============================================================================
-- Simply Tables Quote System — PostgreSQL Schema V1
-- ============================================================================
--
-- Design philosophy:
--   - Quotes start simple, grow as needed (no fixed slots)
--   - Cost and labor blocks are created on demand per product
--   - Group cost pools live at the quote level and distribute across products
--   - Tags on every block enable flexible price breakdowns (top/base/feature)
--   - Material type drives context-aware defaults and UI options
--   - Presets can capture any subset of a product's configuration
--   - Options allow quoting the same products multiple ways
--   - All computed outputs stored for fast reads, recomputed on input change
--
-- Aggregation hierarchy (same as sheet):
--   PU/PB → PP → PT → Option Total → Quote Total
--
-- ============================================================================


-- --------------------------------------------------------------------------
-- USERS
-- --------------------------------------------------------------------------

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',  -- admin, user
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- --------------------------------------------------------------------------
-- TAGS — flexible labeling for any block (top, base, feature, shipping...)
-- --------------------------------------------------------------------------

CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT UNIQUE NOT NULL,           -- "Top", "Base", "Feature: Edge Band", etc.
    category        TEXT,                            -- grouping: "standard", "feature", "custom"
    is_default      BOOLEAN NOT NULL DEFAULT false,  -- auto-suggested tags
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the standard tags
INSERT INTO tags (name, category, is_default, sort_order) VALUES
    ('Top',         'standard', true,  1),
    ('Base',        'standard', true,  2),
    ('Shipping',    'standard', true,  3),
    ('General',     'standard', true,  4);


-- --------------------------------------------------------------------------
-- QUOTES — one per deal/project (job level)
-- --------------------------------------------------------------------------

CREATE TABLE quotes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    deal_id         TEXT,                           -- "0670" (from Airtable)
    airtable_record TEXT,                           -- recXXX for API sync
    project_name    TEXT NOT NULL,

    -- Versioning
    quote_set       INTEGER NOT NULL DEFAULT 1,
    version         INTEGER NOT NULL DEFAULT 1,
    quote_number    TEXT GENERATED ALWAYS AS (
                        COALESCE(deal_id, 'NEW') || '-' || quote_set || '-' || version
                    ) STORED,

    -- Rep / commission
    has_rep         BOOLEAN NOT NULL DEFAULT false,
    rep_rate        NUMERIC(5,4) NOT NULL DEFAULT 0.0800,

    -- Status
    status          TEXT NOT NULL DEFAULT 'draft',  -- draft, quoted, won, lost, archived

    -- Links to external systems
    drive_folder_id TEXT,
    sheet_id        TEXT,                            -- legacy Sheet ID if migrated

    -- Metadata
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    quoted_at       TIMESTAMPTZ,

    UNIQUE(deal_id, quote_set, version)
);

CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_deal ON quotes(deal_id);


-- --------------------------------------------------------------------------
-- QUOTE OPTIONS — "Option A: Ash", "Option B: Walnut", etc.
-- Most quotes have just one (auto-created, invisible in UI).
-- --------------------------------------------------------------------------

CREATE TABLE quote_options (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    name            TEXT NOT NULL DEFAULT 'Standard',
    description     TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,

    -- Computed totals (recalculated by engine)
    total_cost      NUMERIC(12,2),
    total_price     NUMERIC(12,2),
    total_hours     NUMERIC(10,2),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_options_quote ON quote_options(quote_id);


-- --------------------------------------------------------------------------
-- PRODUCTS — individual tables/items within an option (no fixed limit)
-- --------------------------------------------------------------------------

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id       UUID NOT NULL REFERENCES quote_options(id) ON DELETE CASCADE,

    sort_order      INTEGER NOT NULL DEFAULT 0,
    product_group   TEXT,                            -- optional grouping label

    -- Core specs
    title           TEXT,
    quantity        INTEGER NOT NULL DEFAULT 1,
    width           NUMERIC(8,2),                    -- inches
    length          NUMERIC(8,2),                    -- inches (grain direction)
    shape           TEXT DEFAULT 'Standard',          -- Standard, DIA, Custom Shape, Base Only
    shape_custom    TEXT,
    height_name     TEXT DEFAULT 'Dining Height',     -- Dining/Counter/Bar/Top Only/Custom
    height_input    TEXT,

    -- Material
    material_type   TEXT NOT NULL,                    -- Hardwood, Stone, Live Edge, Laminate, etc.
    material_detail TEXT,                             -- Ash, Walnut, Quartz, etc.
    lumber_thickness TEXT,                            -- '1.25"', '1.75"', etc. (hardwood/live edge)

    -- Base
    base_type       TEXT DEFAULT 'Stock Base',        -- Stock Base, Custom Base, Top Only
    base_vendor     TEXT,
    base_style      TEXT,
    base_size       TEXT,

    -- Descriptions (context-driven by material_type)
    edge_profile    TEXT,
    stain_or_color  TEXT,
    color_name      TEXT,
    sheen           TEXT,
    top_description TEXT,
    base_description TEXT,
    notes           TEXT,

    -- Computed dimensions (recalculated by engine)
    sq_ft           NUMERIC(10,4),
    bd_ft           NUMERIC(10,4),
    bases_per_top   INTEGER DEFAULT 1,

    -- Margin rates (defaults set by material_type, adjustable per product)
    hardwood_margin_rate        NUMERIC(5,4) DEFAULT 0.0500,
    stone_margin_rate           NUMERIC(5,4) DEFAULT 0.2500,
    stock_base_margin_rate      NUMERIC(5,4) DEFAULT 0.2500,
    stock_base_ship_margin_rate NUMERIC(5,4) DEFAULT 0.0500,
    powder_coat_margin_rate     NUMERIC(5,4) DEFAULT 0.1000,
    custom_base_margin_rate     NUMERIC(5,4) DEFAULT 0.0500,
    unit_cost_margin_rate       NUMERIC(5,4) DEFAULT 0.0500,
    group_cost_margin_rate      NUMERIC(5,4) DEFAULT 0.0500,
    misc_margin_rate            NUMERIC(5,4) DEFAULT 0.0000,
    consumables_margin_rate     NUMERIC(5,4) DEFAULT 0.0000,

    -- Final pricing controls
    hourly_rate             NUMERIC(8,2) DEFAULT 155.00,
    final_adjustment_rate   NUMERIC(6,4) DEFAULT 1.0000,

    -- Computed pricing (recalculated by engine)
    total_material_cost     NUMERIC(12,2),
    total_material_margin   NUMERIC(12,2),
    total_material_price    NUMERIC(12,2),
    total_hours_pp          NUMERIC(10,2),
    hours_price             NUMERIC(12,2),
    price_pp                NUMERIC(12,2),
    final_price_pp          NUMERIC(12,2),
    sale_price_pp           NUMERIC(12,2),
    sale_price_total        NUMERIC(12,2),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_option ON products(option_id);
CREATE INDEX idx_products_material ON products(material_type);
CREATE INDEX idx_products_group ON products(product_group);


-- --------------------------------------------------------------------------
-- COST BLOCKS — unit costs per product, created on demand
-- --------------------------------------------------------------------------
-- Replaces UC1-UC9, UCB1-UCB4, Species, Stone, Stock Base, Powder Coat, etc.
-- --------------------------------------------------------------------------

CREATE TABLE cost_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id          UUID REFERENCES tags(id),

    sort_order      INTEGER NOT NULL DEFAULT 0,
    cost_category   TEXT NOT NULL,                    -- species, stone, stock_base, powder_coat,
                                                     -- unit_cost, unit_cost_base, custom_base,
                                                     -- misc, consumables, other

    -- Inputs
    description     TEXT,
    cost_per_unit   NUMERIC(12,4),                   -- PU or PB
    units_per_product NUMERIC(10,4) DEFAULT 1,       -- multiplier (bases_per_top, bd_ft, sq_ft, etc.)
    multiplier_type TEXT DEFAULT 'fixed',             -- fixed, per_base, per_sqft, per_bdft

    -- Computed (by engine)
    cost_pp         NUMERIC(12,4),
    cost_pt         NUMERIC(12,4),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_blocks_product ON cost_blocks(product_id);
CREATE INDEX idx_cost_blocks_tag ON cost_blocks(tag_id);
CREATE INDEX idx_cost_blocks_category ON cost_blocks(cost_category);


-- --------------------------------------------------------------------------
-- GROUP COST POOLS — shared costs distributed across products
-- --------------------------------------------------------------------------
-- Lives at the QUOTE level. Distributes a lump sum proportionally to
-- participating products based on a metric (units, sqft, bdft).
-- --------------------------------------------------------------------------

CREATE TABLE group_cost_pools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    tag_id          UUID REFERENCES tags(id),

    sort_order      INTEGER NOT NULL DEFAULT 0,
    cost_category   TEXT NOT NULL DEFAULT 'group_cost',

    -- Inputs
    description     TEXT,
    total_amount    NUMERIC(12,4) NOT NULL,
    distribution_type TEXT NOT NULL DEFAULT 'units',   -- units, sqft, bdft

    -- Behavior on downstream quantity changes
    on_qty_change   TEXT NOT NULL DEFAULT 'redistribute',  -- redistribute, recalculate

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_pools_quote ON group_cost_pools(quote_id);


CREATE TABLE group_cost_pool_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id         UUID NOT NULL REFERENCES group_cost_pools(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    -- Computed by engine
    metric_value    NUMERIC(12,4),
    cost_pp         NUMERIC(12,4),
    cost_pt         NUMERIC(12,4),

    UNIQUE(pool_id, product_id)
);

CREATE INDEX idx_pool_members_product ON group_cost_pool_members(product_id);


-- --------------------------------------------------------------------------
-- LABOR BLOCKS — hours per product per labor center, created on demand
-- --------------------------------------------------------------------------
-- Rate, unit, and group blocks stored in one table with block_type.
-- Default blocks created based on material_type; more added via button.
-- --------------------------------------------------------------------------

CREATE TABLE labor_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tag_id          UUID REFERENCES tags(id),

    sort_order      INTEGER NOT NULL DEFAULT 0,
    labor_center    TEXT NOT NULL,                     -- LC100 through LC111
    block_type      TEXT NOT NULL,                     -- rate, unit, group

    -- Inputs (used fields depend on block_type)
    description     TEXT,

    -- Rate block
    rate_value      NUMERIC(10,4),                    -- sqft/hr or panels/hr
    metric_source   TEXT,                              -- panel_sqft, top_sqft, etc.
    is_active       BOOLEAN NOT NULL DEFAULT true,     -- checkbox gate

    -- Unit block
    hours_per_unit  NUMERIC(10,4),

    -- Computed (by engine)
    hours_pp        NUMERIC(10,4),
    hours_pt        NUMERIC(10,4),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_labor_blocks_product ON labor_blocks(product_id);
CREATE INDEX idx_labor_blocks_lc ON labor_blocks(labor_center);
CREATE INDEX idx_labor_blocks_tag ON labor_blocks(tag_id);


-- --------------------------------------------------------------------------
-- GROUP LABOR POOLS — shared hours distributed across products
-- --------------------------------------------------------------------------

CREATE TABLE group_labor_pools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id        UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    tag_id          UUID REFERENCES tags(id),

    sort_order      INTEGER NOT NULL DEFAULT 0,
    labor_center    TEXT NOT NULL,

    description     TEXT,
    total_hours     NUMERIC(10,4) NOT NULL,
    distribution_type TEXT NOT NULL DEFAULT 'units',

    on_qty_change   TEXT NOT NULL DEFAULT 'redistribute',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_labor_quote ON group_labor_pools(quote_id);


CREATE TABLE group_labor_pool_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id         UUID NOT NULL REFERENCES group_labor_pools(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    metric_value    NUMERIC(12,4),
    hours_pp        NUMERIC(10,4),
    hours_pt        NUMERIC(10,4),

    UNIQUE(pool_id, product_id)
);

CREATE INDEX idx_labor_pool_members_product ON group_labor_pool_members(product_id);


-- --------------------------------------------------------------------------
-- PRESETS — reusable templates for any combination of specs + blocks
-- --------------------------------------------------------------------------

CREATE TABLE presets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    preset_id_code  TEXT UNIQUE,                       -- legacy ID if migrated
    category        TEXT,                              -- Top, Base, Feature, Full Product
    description     TEXT,

    -- Snapshot of product-level specs (NULL = don't change this field)
    material_type   TEXT,
    material_detail TEXT,
    lumber_thickness TEXT,
    base_type       TEXT,
    edge_profile    TEXT,
    stain_or_color  TEXT,
    sheen           TEXT,

    -- Margin overrides (NULL = keep product defaults)
    hardwood_margin_rate    NUMERIC(5,4),
    stone_margin_rate       NUMERIC(5,4),
    stock_base_margin_rate  NUMERIC(5,4),

    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presets_category ON presets(category);


-- --------------------------------------------------------------------------
-- PRESET BLOCKS — cost and labor blocks bundled in a preset
-- --------------------------------------------------------------------------

CREATE TABLE preset_blocks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_id       UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,

    sort_order      INTEGER NOT NULL DEFAULT 0,
    domain          TEXT NOT NULL,                     -- cost, labor

    -- Cost block fields
    cost_category   TEXT,
    block_type      TEXT,
    description     TEXT,
    cost_per_unit   NUMERIC(12,4),
    multiplier_type TEXT,

    -- Labor block fields
    labor_center    TEXT,
    rate_value      NUMERIC(10,4),
    hours_per_unit  NUMERIC(10,4),
    metric_source   TEXT,

    -- Tag to apply
    tag_name        TEXT
);

CREATE INDEX idx_preset_blocks_preset ON preset_blocks(preset_id);


-- --------------------------------------------------------------------------
-- STOCK BASE CATALOG
-- --------------------------------------------------------------------------

CREATE TABLE stock_base_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    vendor          TEXT NOT NULL,
    style           TEXT NOT NULL,
    size            TEXT,
    height          TEXT,
    color           TEXT,
    ji_column       TEXT,
    ji_top_plate    TEXT,
    ji_footring     TEXT,

    cost_each       NUMERIC(10,2) NOT NULL,
    tariff_note     TEXT,

    max_top_rect_w  NUMERIC(8,2),
    max_top_rect_l  NUMERIC(8,2),
    max_top_round   NUMERIC(8,2),

    lookup_key      TEXT GENERATED ALWAYS AS (
                        vendor || '|' || style || '|' ||
                        COALESCE(size, '') || '|' || COALESCE(height, '') || '|' ||
                        COALESCE(color, '') || '|' || COALESCE(ji_column, '') || '|' ||
                        COALESCE(ji_top_plate, '') || '|' || COALESCE(ji_footring, '')
                    ) STORED,

    is_active       BOOLEAN NOT NULL DEFAULT true,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalog_vendor ON stock_base_catalog(vendor);
CREATE INDEX idx_catalog_lookup ON stock_base_catalog(lookup_key);


-- --------------------------------------------------------------------------
-- MATERIAL CONTEXT — drives UI behavior per material type
-- --------------------------------------------------------------------------

CREATE TABLE material_context (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_type   TEXT UNIQUE NOT NULL,

    -- Which UI sections to show
    show_lumber_thickness   BOOLEAN DEFAULT false,
    show_species_picker     BOOLEAN DEFAULT false,
    show_stone_picker       BOOLEAN DEFAULT false,
    show_edge_profile       BOOLEAN DEFAULT true,
    show_stain_color        BOOLEAN DEFAULT true,

    -- Defaults for new products of this type
    default_margins         JSONB,
    default_labor_centers   JSONB,     -- ["LC101","LC102",...]

    -- Dropdown options
    material_options        JSONB,     -- ["Ash","Red Oak","Walnut",...]
    edge_options            JSONB,
    stain_options           JSONB,
    sheen_options           JSONB
);

INSERT INTO material_context (material_type, show_lumber_thickness, show_species_picker,
    default_margins, default_labor_centers, material_options) VALUES
    ('Hardwood', true, true,
     '{"hardwood":0.05,"stock_base":0.25,"unit_cost":0.05}',
     '["LC100","LC101","LC102","LC103","LC104","LC105","LC106","LC109","LC110","LC111"]',
     '["Ash","Red Oak","Walnut","White Oak","Maple","Mahogany"]'),
    ('Stone', false, false,
     '{"stone":0.25,"stock_base":0.25}',
     '["LC100","LC108","LC110","LC111"]',
     '["Quartz","Terrazzo","Granite","Solid Surface","Travertine","Marble - Natural","Sintered Stone","Porcelain"]'),
    ('Live Edge', true, true,
     '{"hardwood":0.05,"stock_base":0.25}',
     '["LC100","LC101","LC102","LC105","LC106","LC109","LC110","LC111"]',
     '["Walnut Live Edge","Maple Live Edge","White Oak Live Edge","Solid Hardwood Live Edge","Live Edge Slab"]'),
    ('Laminate', false, false,
     '{"unit_cost":0.05,"stock_base":0.25}',
     '["LC100","LC103","LC110","LC111"]',
     '["Laminate"]'),
    ('Wood Edge Laminate', false, false,
     '{"unit_cost":0.05,"stock_base":0.25}',
     '["LC100","LC103","LC105","LC106","LC109","LC110","LC111"]',
     NULL),
    ('Outdoor', false, false,
     '{"unit_cost":0.05,"stock_base":0.25}',
     '["LC100","LC101","LC102","LC103","LC106","LC109","LC110","LC111"]',
     '["Acre","Thermally Modified Ash","HPL"]');


-- --------------------------------------------------------------------------
-- DESCRIPTION TEMPLATES — context-aware description autofill
-- --------------------------------------------------------------------------

CREATE TABLE description_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_type   TEXT NOT NULL,
    field_target    TEXT NOT NULL,                     -- top_line_1, top_line_2, base_line_1
    template        TEXT NOT NULL,                     -- "{thickness} {species}, {edge}, {stain} {sheen}"
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_default      BOOLEAN NOT NULL DEFAULT true
);


-- --------------------------------------------------------------------------
-- AUDIT LOG
-- --------------------------------------------------------------------------

CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    table_name      TEXT NOT NULL,
    record_id       UUID NOT NULL,
    action          TEXT NOT NULL,                     -- insert, update, delete
    changed_by      UUID REFERENCES users(id),
    changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    old_values      JSONB,
    new_values      JSONB
);

CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_time ON audit_log(changed_at);


-- --------------------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quotes_updated    BEFORE UPDATE ON quotes    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_products_updated  BEFORE UPDATE ON products  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_presets_updated   BEFORE UPDATE ON presets   FOR EACH ROW EXECUTE FUNCTION update_timestamp();


-- ============================================================================
-- FUTURE PHASE NOTES
-- ============================================================================
--
-- LEARNING LOOP:
--   - Add actual_hours, actual_material_cost to products (Harvest + QuickBooks)
--   - Claude queries similar products by material + size + base_type
--   - "Products like this averaged X hours in LC105"
--
-- AIRTABLE SYNC:
--   - quotes.airtable_record enables bidirectional sync
--   - Push on status change to 'quoted'
--
-- PDF EXPORT:
--   - Group by tag for itemized breakdowns
--   - Option comparison table when multiple options exist
--
-- SHEETS MIGRATION:
--   - Import via Product Log data
--   - Map legacy quote numbers
--
-- ============================================================================
