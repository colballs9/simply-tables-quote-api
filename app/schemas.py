"""
Pydantic schemas for API request/response validation.

Naming convention:
    XxxCreate  — POST body (inputs only)
    XxxUpdate  — PATCH body (all fields optional)
    XxxRead    — GET response (includes computed fields)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


# ──────────────────────────────────────────────────────────────────────
# System Defaults
# ──────────────────────────────────────────────────────────────────────

class SystemDefaultsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    key: str
    hourly_rate: float
    hardwood_margin_rate: float
    stone_margin_rate: float
    stock_base_margin_rate: float
    stock_base_ship_margin_rate: float
    powder_coat_margin_rate: float
    custom_base_margin_rate: float
    unit_cost_margin_rate: float
    group_cost_margin_rate: float
    misc_margin_rate: float
    consumables_margin_rate: float


class SystemDefaultsUpdate(BaseModel):
    hourly_rate: Optional[float] = None
    hardwood_margin_rate: Optional[float] = None
    stone_margin_rate: Optional[float] = None
    stock_base_margin_rate: Optional[float] = None
    stock_base_ship_margin_rate: Optional[float] = None
    powder_coat_margin_rate: Optional[float] = None
    custom_base_margin_rate: Optional[float] = None
    unit_cost_margin_rate: Optional[float] = None
    group_cost_margin_rate: Optional[float] = None
    misc_margin_rate: Optional[float] = None
    consumables_margin_rate: Optional[float] = None


# ──────────────────────────────────────────────────────────────────────
# Tags
# ──────────────────────────────────────────────────────────────────────

class TagRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    category: Optional[str] = None
    is_default: bool
    sort_order: int


class TagCreate(BaseModel):
    name: str
    category: Optional[str] = None
    is_default: bool = False


# ──────────────────────────────────────────────────────────────────────
# Product Components (Material Builder)
# ──────────────────────────────────────────────────────────────────────

class ComponentCreate(BaseModel):
    sort_order: int = 0
    component_type: str          # plank, leg, apron_l, apron_w, metal_part, other
    description: Optional[str] = None
    width: Optional[float] = None
    length: Optional[float] = None
    thickness: Optional[float] = None   # raw lumber inches
    qty_per_base: int = 1
    material: Optional[str] = None      # species name or material type


class ComponentUpdate(BaseModel):
    sort_order: Optional[int] = None
    component_type: Optional[str] = None
    description: Optional[str] = None
    width: Optional[float] = None
    length: Optional[float] = None
    thickness: Optional[float] = None
    qty_per_base: Optional[int] = None
    material: Optional[str] = None


class ComponentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    product_id: uuid.UUID
    sort_order: int
    component_type: str
    description: Optional[str] = None
    width: Optional[float] = None
    length: Optional[float] = None
    thickness: Optional[float] = None
    qty_per_base: int
    material: Optional[str] = None
    # Computed
    bd_ft_per_piece: Optional[float] = None
    bd_ft_pp: Optional[float] = None
    sq_ft_per_piece: Optional[float] = None
    sq_ft_pp: Optional[float] = None


# ──────────────────────────────────────────────────────────────────────
# Quote Block Members
# ──────────────────────────────────────────────────────────────────────

class QuoteBlockMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    quote_block_id: uuid.UUID
    product_id: uuid.UUID
    # Per-member overrides
    description: Optional[str] = None
    hours_per_unit: Optional[float] = None
    cost_per_unit: Optional[float] = None
    units_per_product: Optional[float] = None
    is_active: Optional[bool] = None
    # Computed
    cost_pp: Optional[float] = None
    cost_pt: Optional[float] = None
    hours_pp: Optional[float] = None
    hours_pt: Optional[float] = None
    metric_value: Optional[float] = None


class QuoteBlockMemberUpdate(BaseModel):
    description: Optional[str] = None
    hours_per_unit: Optional[float] = None
    cost_per_unit: Optional[float] = None
    units_per_product: Optional[float] = None
    is_active: Optional[bool] = None


# ──────────────────────────────────────────────────────────────────────
# Quote Blocks
# ──────────────────────────────────────────────────────────────────────

class QuoteBlockCreate(BaseModel):
    tag_id: Optional[uuid.UUID] = None
    sort_order: int = 0
    is_active: bool = True
    block_domain: str          # cost | labor
    block_type: str            # rate | unit | group
    label: Optional[str] = None
    # Cost fields
    cost_category: Optional[str] = None
    cost_per_unit: Optional[float] = None
    units_per_product: Optional[float] = None
    multiplier_type: Optional[str] = None
    # Labor fields
    labor_center: Optional[str] = None
    rate_value: Optional[float] = None
    metric_source: Optional[str] = None
    rate_type: Optional[str] = None
    hours_per_unit: Optional[float] = None
    # Group fields
    total_amount: Optional[float] = None
    total_hours: Optional[float] = None
    distribution_type: Optional[str] = None
    on_qty_change: str = "redistribute"
    # Initial member product IDs
    product_ids: list[uuid.UUID] = []


class QuoteBlockUpdate(BaseModel):
    tag_id: Optional[uuid.UUID] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    block_type: Optional[str] = None      # unit | group | rate
    label: Optional[str] = None
    # Cost fields
    cost_category: Optional[str] = None
    cost_per_unit: Optional[float] = None
    units_per_product: Optional[float] = None
    multiplier_type: Optional[str] = None
    # Labor fields
    labor_center: Optional[str] = None
    rate_value: Optional[float] = None
    metric_source: Optional[str] = None
    rate_type: Optional[str] = None
    hours_per_unit: Optional[float] = None
    # Group fields
    total_amount: Optional[float] = None
    total_hours: Optional[float] = None
    distribution_type: Optional[str] = None
    on_qty_change: Optional[str] = None


class QuoteBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    quote_id: uuid.UUID
    tag_id: Optional[uuid.UUID] = None
    sort_order: int
    is_builtin: bool
    is_active: bool
    block_domain: str
    block_type: str
    label: Optional[str] = None
    # Cost fields
    cost_category: Optional[str] = None
    cost_per_unit: Optional[float] = None
    units_per_product: Optional[float] = None
    multiplier_type: Optional[str] = None
    # Labor fields
    labor_center: Optional[str] = None
    rate_value: Optional[float] = None
    metric_source: Optional[str] = None
    rate_type: Optional[str] = None
    hours_per_unit: Optional[float] = None
    # Group fields
    total_amount: Optional[float] = None
    total_hours: Optional[float] = None
    distribution_type: Optional[str] = None
    on_qty_change: Optional[str] = None
    # Members
    members: list[QuoteBlockMemberRead] = []


# ──────────────────────────────────────────────────────────────────────
# Products
# ──────────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    sort_order: int = 0
    product_group: Optional[str] = None
    title: Optional[str] = None
    quantity: int = 1
    width: Optional[float] = None
    length: Optional[float] = None
    shape: str = "Standard"
    shape_custom: Optional[str] = None
    height_name: str = "Dining Height"
    height_input: Optional[str] = None
    material_type: str
    material_detail: Optional[str] = None
    lumber_thickness: Optional[str] = None
    base_type: str = "Stock Base"
    base_vendor: Optional[str] = None
    base_style: Optional[str] = None
    base_size: Optional[str] = None
    edge_profile: Optional[str] = None
    stain_or_color: Optional[str] = None
    color_name: Optional[str] = None
    sheen: Optional[str] = None
    notes: Optional[str] = None
    bases_per_top: int = 1
    hourly_rate: Optional[float] = None  # None = inherit from quote defaults
    final_adjustment_rate: float = 1.0


class ProductUpdate(BaseModel):
    sort_order: Optional[int] = None
    product_group: Optional[str] = None
    title: Optional[str] = None
    quantity: Optional[int] = None
    width: Optional[float] = None
    length: Optional[float] = None
    shape: Optional[str] = None
    shape_custom: Optional[str] = None
    height_name: Optional[str] = None
    height_input: Optional[str] = None
    material_type: Optional[str] = None
    material_detail: Optional[str] = None
    lumber_thickness: Optional[str] = None
    base_type: Optional[str] = None
    base_vendor: Optional[str] = None
    base_style: Optional[str] = None
    base_size: Optional[str] = None
    edge_profile: Optional[str] = None
    stain_or_color: Optional[str] = None
    color_name: Optional[str] = None
    sheen: Optional[str] = None
    notes: Optional[str] = None
    bases_per_top: Optional[int] = None
    hourly_rate: Optional[float] = None
    final_adjustment_rate: Optional[float] = None
    # Margin rates
    hardwood_margin_rate: Optional[float] = None
    stone_margin_rate: Optional[float] = None
    stock_base_margin_rate: Optional[float] = None
    stock_base_ship_margin_rate: Optional[float] = None
    powder_coat_margin_rate: Optional[float] = None
    custom_base_margin_rate: Optional[float] = None
    unit_cost_margin_rate: Optional[float] = None
    group_cost_margin_rate: Optional[float] = None
    misc_margin_rate: Optional[float] = None
    consumables_margin_rate: Optional[float] = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    option_id: uuid.UUID
    sort_order: int
    product_group: Optional[str] = None
    title: Optional[str] = None
    quantity: int
    width: Optional[float] = None
    length: Optional[float] = None
    shape: str
    shape_custom: Optional[str] = None
    height_name: str
    height_input: Optional[str] = None
    material_type: str
    material_detail: Optional[str] = None
    lumber_thickness: Optional[str] = None
    base_type: str
    edge_profile: Optional[str] = None
    stain_or_color: Optional[str] = None
    sheen: Optional[str] = None
    notes: Optional[str] = None
    bases_per_top: int
    hourly_rate: float
    final_adjustment_rate: float
    # Margin rates (returned so UI can display/edit current values)
    hardwood_margin_rate: float
    stone_margin_rate: float
    stock_base_margin_rate: float
    stock_base_ship_margin_rate: float
    powder_coat_margin_rate: float
    custom_base_margin_rate: float
    unit_cost_margin_rate: float
    group_cost_margin_rate: float
    misc_margin_rate: float
    consumables_margin_rate: float
    # Computed dimensions
    sq_ft: Optional[float] = None
    bd_ft: Optional[float] = None
    # Computed pricing
    total_material_cost: Optional[float] = None
    total_material_margin: Optional[float] = None
    total_material_price: Optional[float] = None
    total_hours_pp: Optional[float] = None
    hours_price: Optional[float] = None
    price_pp: Optional[float] = None
    final_price_pp: Optional[float] = None
    sale_price_pp: Optional[float] = None
    sale_price_total: Optional[float] = None
    # Nested
    components: list[ComponentRead] = []


# ──────────────────────────────────────────────────────────────────────
# Job Summary (side panel aggregation)
# ──────────────────────────────────────────────────────────────────────

class TagLineSummary(BaseModel):
    """Cost and hours totals for a single tag across the whole job."""
    cost_pt: float = 0.0
    hours_pt: float = 0.0


class QuoteJobSummary(BaseModel):
    """
    Aggregated view of the quote for the side panel.
    Sums cost_pt and hours_pt from all blocks across all products.
    """
    quote_id: uuid.UUID

    # Cost totals by category (flat dict, category key → total cost_pt)
    cost_by_category: dict[str, float] = {}

    # Three visual cost groups (derived from cost_by_category)
    material_cost_total: float = 0.0    # species, stone, hardwood_base
    base_cost_total: float = 0.0        # stock_base, SB shipping, powder coat, custom base
    other_cost_total: float = 0.0       # unit_cost, misc, consumables, group_cost, etc.

    # Tag aggregations (tag_name → totals)
    cost_by_tag: dict[str, TagLineSummary] = {}

    # Labor by center (labor_center → total hours_pt across job)
    hours_by_labor_center: dict[str, float] = {}

    # Quote-level totals (already stored on the quote after recalc)
    total_cost: Optional[float] = None      # raw material cost across job
    total_margin: float = 0.0              # total margin dollars
    total_material_price: float = 0.0      # cost + margin
    total_hours: Optional[float] = None
    hours_price: float = 0.0
    quote_total: Optional[float] = None    # sale price total (ex shipping)
    shipping: float = 0.0
    grand_total: Optional[float] = None

    # Op metrics
    op_revenue: Optional[float] = None     # quote_total - total_cost
    job_dollar_per_hr: Optional[float] = None   # op_revenue / total_hours


# ──────────────────────────────────────────────────────────────────────
# Quote Options
# ──────────────────────────────────────────────────────────────────────

class QuoteOptionCreate(BaseModel):
    name: str = "Standard"
    description: Optional[str] = None
    sort_order: int = 0


class QuoteOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    quote_id: uuid.UUID
    name: str
    description: Optional[str] = None
    sort_order: int
    total_cost: Optional[float] = None
    total_price: Optional[float] = None
    total_hours: Optional[float] = None
    products: list[ProductRead] = []


# ──────────────────────────────────────────────────────────────────────
# Quotes
# ──────────────────────────────────────────────────────────────────────

class QuoteCreate(BaseModel):
    deal_id: Optional[str] = None
    project_name: str
    quote_set: int = 1
    version: int = 1
    has_rep: bool = True
    rep_rate: float = 0.08
    status: str = "draft"
    drive_folder_id: Optional[str] = None
    shipping: float = 0.0


class QuoteUpdate(BaseModel):
    project_name: Optional[str] = None
    has_rep: Optional[bool] = None
    rep_rate: Optional[float] = None
    status: Optional[str] = None
    drive_folder_id: Optional[str] = None
    shipping: Optional[float] = None
    # Quote-level default overrides
    default_hourly_rate: Optional[float] = None
    default_hardwood_margin_rate: Optional[float] = None
    default_stone_margin_rate: Optional[float] = None
    default_stock_base_margin_rate: Optional[float] = None
    default_stock_base_ship_margin_rate: Optional[float] = None
    default_powder_coat_margin_rate: Optional[float] = None
    default_custom_base_margin_rate: Optional[float] = None
    default_unit_cost_margin_rate: Optional[float] = None
    default_group_cost_margin_rate: Optional[float] = None
    default_misc_margin_rate: Optional[float] = None
    default_consumables_margin_rate: Optional[float] = None


class QuoteSummary(BaseModel):
    """Lightweight list view."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    deal_id: Optional[str] = None
    project_name: str
    quote_number: str
    status: str
    has_rep: bool
    shipping: float = 0.0
    total_price: Optional[float] = None
    grand_total: Optional[float] = None
    total_hours: Optional[float] = None
    created_at: datetime
    updated_at: datetime


class QuoteRead(BaseModel):
    """Full quote with all nested data."""
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    deal_id: Optional[str] = None
    project_name: str
    quote_number: str
    quote_set: int
    version: int
    has_rep: bool
    rep_rate: float
    status: str
    shipping: float = 0.0
    # Default rates/margins
    default_hourly_rate: float = 155.00
    default_hardwood_margin_rate: float = 0.05
    default_stone_margin_rate: float = 0.25
    default_stock_base_margin_rate: float = 0.25
    default_stock_base_ship_margin_rate: float = 0.05
    default_powder_coat_margin_rate: float = 0.10
    default_custom_base_margin_rate: float = 0.05
    default_unit_cost_margin_rate: float = 0.05
    default_group_cost_margin_rate: float = 0.05
    default_misc_margin_rate: float = 0.00
    default_consumables_margin_rate: float = 0.00
    # Computed
    total_cost: Optional[float] = None
    total_price: Optional[float] = None
    total_hours: Optional[float] = None
    grand_total: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    options: list[QuoteOptionRead] = []
    quote_blocks: list[QuoteBlockRead] = []
    stone_assignments: list[StoneAssignmentRead] = []


# ──────────────────────────────────────────────────────────────────────
# Species Assignments
# ──────────────────────────────────────────────────────────────────────

class SpeciesAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    quote_id: uuid.UUID
    species_name: str
    quarter_code: str
    species_key: str
    price_per_bdft: Optional[float] = None
    total_bdft: Optional[float] = None
    total_cost: Optional[float] = None


class SpeciesAssignmentUpdate(BaseModel):
    price_per_bdft: float


# ──────────────────────────────────────────────────────────────────────
# Stone Assignments
# ──────────────────────────────────────────────────────────────────────

class StoneAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    quote_id: uuid.UUID
    stone_key: str
    total_sqft: Optional[float] = None
    total_cost: Optional[float] = None


class StoneAssignmentUpdate(BaseModel):
    total_cost: float


# ──────────────────────────────────────────────────────────────────────
# Presets
# ──────────────────────────────────────────────────────────────────────

class PresetBlockRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    sort_order: int
    domain: str
    cost_category: Optional[str] = None
    block_type: Optional[str] = None
    description: Optional[str] = None
    cost_per_unit: Optional[float] = None
    multiplier_type: Optional[str] = None
    labor_center: Optional[str] = None
    rate_value: Optional[float] = None
    hours_per_unit: Optional[float] = None
    metric_source: Optional[str] = None
    tag_name: Optional[str] = None


class PresetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    preset_id_code: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    material_type: Optional[str] = None
    material_detail: Optional[str] = None
    blocks: list[PresetBlockRead] = []


# ──────────────────────────────────────────────────────────────────────
# Stock Base Catalog
# ──────────────────────────────────────────────────────────────────────

class CatalogItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    vendor: str
    style: str
    size: Optional[str] = None
    height: Optional[str] = None
    color: Optional[str] = None
    cost_each: float
    max_top_rect_w: Optional[float] = None
    max_top_rect_l: Optional[float] = None
    max_top_round: Optional[float] = None


# ──────────────────────────────────────────────────────────────────────
# Material Context
# ──────────────────────────────────────────────────────────────────────

class MaterialContextRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    material_type: str
    show_lumber_thickness: bool
    show_species_picker: bool
    show_stone_picker: bool
    show_edge_profile: bool
    show_stain_color: bool
    default_margins: Optional[dict] = None
    default_labor_centers: Optional[list] = None
    material_options: Optional[list] = None
    edge_options: Optional[list] = None
    stain_options: Optional[list] = None
    sheen_options: Optional[list] = None
