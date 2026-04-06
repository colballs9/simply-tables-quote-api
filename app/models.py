"""
SQLAlchemy ORM models — mirrors schema_v1.sql.

All UUID primary keys use server-side gen_random_uuid().
Computed fields (cost_pp, hours_pp, totals) are stored and
updated by the calc engine after every input change.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    String, Text, Integer, Numeric, Boolean, DateTime, ForeignKey, UniqueConstraint, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .database import Base


# ──────────────────────────────────────────────────────────────────────
# Users
# ──────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ──────────────────────────────────────────────────────────────────────
# Tags
# ──────────────────────────────────────────────────────────────────────

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    category: Mapped[str | None] = mapped_column(String)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ──────────────────────────────────────────────────────────────────────
# Quotes
# ──────────────────────────────────────────────────────────────────────

class Quote(Base):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Identity
    deal_id: Mapped[str | None] = mapped_column(String)
    airtable_record: Mapped[str | None] = mapped_column(String)
    project_name: Mapped[str] = mapped_column(String, nullable=False)

    # Versioning
    quote_set: Mapped[int] = mapped_column(Integer, default=1)
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Rep
    has_rep: Mapped[bool] = mapped_column(Boolean, default=True)
    rep_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.08)

    # Status
    status: Mapped[str] = mapped_column(String, default="draft")

    # External links
    drive_folder_id: Mapped[str | None] = mapped_column(String)
    sheet_id: Mapped[str | None] = mapped_column(String)

    # Computed totals
    total_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_hours: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # Metadata
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    quoted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    options: Mapped[list["QuoteOption"]] = relationship(back_populates="quote", cascade="all, delete-orphan",
                                                         order_by="QuoteOption.sort_order")
    group_cost_pools: Mapped[list["GroupCostPool"]] = relationship(back_populates="quote", cascade="all, delete-orphan")
    group_labor_pools: Mapped[list["GroupLaborPool"]] = relationship(back_populates="quote", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("deal_id", "quote_set", "version"),
        Index("idx_quotes_status", "status"),
        Index("idx_quotes_deal", "deal_id"),
    )

    @property
    def quote_number(self) -> str:
        deal = self.deal_id or "NEW"
        return f"{deal}-{self.quote_set}-{self.version}"


# ──────────────────────────────────────────────────────────────────────
# Quote Options
# ──────────────────────────────────────────────────────────────────────

class QuoteOption(Base):
    __tablename__ = "quote_options"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, default="Standard")
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Computed
    total_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_hours: Mapped[float | None] = mapped_column(Numeric(10, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    quote: Mapped["Quote"] = relationship(back_populates="options")
    products: Mapped[list["Product"]] = relationship(back_populates="option", cascade="all, delete-orphan",
                                                      order_by="Product.sort_order")


# ──────────────────────────────────────────────────────────────────────
# Products
# ──────────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    option_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quote_options.id", ondelete="CASCADE"))

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    product_group: Mapped[str | None] = mapped_column(String)

    # Core specs
    title: Mapped[str | None] = mapped_column(String)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    width: Mapped[float | None] = mapped_column(Numeric(8, 2))
    length: Mapped[float | None] = mapped_column(Numeric(8, 2))
    shape: Mapped[str] = mapped_column(String, default="Standard")
    shape_custom: Mapped[str | None] = mapped_column(String)
    height_name: Mapped[str] = mapped_column(String, default="Dining Height")
    height_input: Mapped[str | None] = mapped_column(String)

    # Material
    material_type: Mapped[str] = mapped_column(String, nullable=False)
    material_detail: Mapped[str | None] = mapped_column(String)
    lumber_thickness: Mapped[str | None] = mapped_column(String)

    # Base
    base_type: Mapped[str] = mapped_column(String, default="Stock Base")
    base_vendor: Mapped[str | None] = mapped_column(String)
    base_style: Mapped[str | None] = mapped_column(String)
    base_size: Mapped[str | None] = mapped_column(String)

    # Descriptions
    edge_profile: Mapped[str | None] = mapped_column(String)
    stain_or_color: Mapped[str | None] = mapped_column(String)
    color_name: Mapped[str | None] = mapped_column(String)
    sheen: Mapped[str | None] = mapped_column(String)
    top_description: Mapped[str | None] = mapped_column(Text)
    base_description: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    # Computed dimensions
    sq_ft: Mapped[float | None] = mapped_column(Numeric(10, 4))
    bd_ft: Mapped[float | None] = mapped_column(Numeric(10, 4))
    bases_per_top: Mapped[int] = mapped_column(Integer, default=1)

    # Margin rates
    hardwood_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.05)
    stone_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.25)
    stock_base_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.25)
    stock_base_ship_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.05)
    powder_coat_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.10)
    custom_base_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.05)
    unit_cost_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.05)
    group_cost_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.05)
    misc_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.00)
    consumables_margin_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.00)

    # Pricing controls
    hourly_rate: Mapped[float] = mapped_column(Numeric(8, 2), default=155.00)
    final_adjustment_rate: Mapped[float] = mapped_column(Numeric(6, 4), default=1.0)

    # Computed pricing
    total_material_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_material_margin: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_material_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_hours_pp: Mapped[float | None] = mapped_column(Numeric(10, 2))
    hours_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    price_pp: Mapped[float | None] = mapped_column(Numeric(12, 2))
    final_price_pp: Mapped[float | None] = mapped_column(Numeric(12, 2))
    sale_price_pp: Mapped[float | None] = mapped_column(Numeric(12, 2))
    sale_price_total: Mapped[float | None] = mapped_column(Numeric(12, 2))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    option: Mapped["QuoteOption"] = relationship(back_populates="products")
    cost_blocks: Mapped[list["CostBlock"]] = relationship(back_populates="product", cascade="all, delete-orphan",
                                                           order_by="CostBlock.sort_order")
    labor_blocks: Mapped[list["LaborBlock"]] = relationship(back_populates="product", cascade="all, delete-orphan",
                                                             order_by="LaborBlock.sort_order")

    __table_args__ = (
        Index("idx_products_option", "option_id"),
        Index("idx_products_material", "material_type"),
    )


# ──────────────────────────────────────────────────────────────────────
# Cost Blocks
# ──────────────────────────────────────────────────────────────────────

class CostBlock(Base):
    __tablename__ = "cost_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"))
    tag_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"))

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    cost_category: Mapped[str] = mapped_column(String, nullable=False)

    description: Mapped[str | None] = mapped_column(Text)
    cost_per_unit: Mapped[float | None] = mapped_column(Numeric(12, 4))
    units_per_product: Mapped[float] = mapped_column(Numeric(10, 4), default=1)
    multiplier_type: Mapped[str] = mapped_column(String, default="fixed")

    # Computed
    cost_pp: Mapped[float | None] = mapped_column(Numeric(12, 4))
    cost_pt: Mapped[float | None] = mapped_column(Numeric(12, 4))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="cost_blocks")
    tag: Mapped["Tag | None"] = relationship()

    __table_args__ = (
        Index("idx_cost_blocks_product", "product_id"),
        Index("idx_cost_blocks_category", "cost_category"),
    )


# ──────────────────────────────────────────────────────────────────────
# Group Cost Pools
# ──────────────────────────────────────────────────────────────────────

class GroupCostPool(Base):
    __tablename__ = "group_cost_pools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"))
    tag_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"))

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    cost_category: Mapped[str] = mapped_column(String, default="group_cost")

    description: Mapped[str | None] = mapped_column(Text)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    distribution_type: Mapped[str] = mapped_column(String, default="units")
    on_qty_change: Mapped[str] = mapped_column(String, default="redistribute")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    quote: Mapped["Quote"] = relationship(back_populates="group_cost_pools")
    members: Mapped[list["GroupCostPoolMember"]] = relationship(back_populates="pool", cascade="all, delete-orphan")
    tag: Mapped["Tag | None"] = relationship()


class GroupCostPoolMember(Base):
    __tablename__ = "group_cost_pool_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pool_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("group_cost_pools.id", ondelete="CASCADE"))
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"))

    # Computed
    metric_value: Mapped[float | None] = mapped_column(Numeric(12, 4))
    cost_pp: Mapped[float | None] = mapped_column(Numeric(12, 4))
    cost_pt: Mapped[float | None] = mapped_column(Numeric(12, 4))

    # Relationships
    pool: Mapped["GroupCostPool"] = relationship(back_populates="members")

    __table_args__ = (
        UniqueConstraint("pool_id", "product_id"),
    )


# ──────────────────────────────────────────────────────────────────────
# Labor Blocks
# ──────────────────────────────────────────────────────────────────────

class LaborBlock(Base):
    __tablename__ = "labor_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"))
    tag_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"))

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    labor_center: Mapped[str] = mapped_column(String, nullable=False)
    block_type: Mapped[str] = mapped_column(String, nullable=False)  # rate, unit, group

    description: Mapped[str | None] = mapped_column(Text)

    # Rate block
    rate_value: Mapped[float | None] = mapped_column(Numeric(10, 4))
    metric_source: Mapped[str | None] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Unit block
    hours_per_unit: Mapped[float | None] = mapped_column(Numeric(10, 4))

    # Computed
    hours_pp: Mapped[float | None] = mapped_column(Numeric(10, 4))
    hours_pt: Mapped[float | None] = mapped_column(Numeric(10, 4))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="labor_blocks")
    tag: Mapped["Tag | None"] = relationship()

    __table_args__ = (
        Index("idx_labor_blocks_product", "product_id"),
        Index("idx_labor_blocks_lc", "labor_center"),
    )


# ──────────────────────────────────────────────────────────────────────
# Group Labor Pools
# ──────────────────────────────────────────────────────────────────────

class GroupLaborPool(Base):
    __tablename__ = "group_labor_pools"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quotes.id", ondelete="CASCADE"))
    tag_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id"))

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    labor_center: Mapped[str] = mapped_column(String, nullable=False)

    description: Mapped[str | None] = mapped_column(Text)
    total_hours: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    distribution_type: Mapped[str] = mapped_column(String, default="units")
    on_qty_change: Mapped[str] = mapped_column(String, default="redistribute")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    quote: Mapped["Quote"] = relationship(back_populates="group_labor_pools")
    members: Mapped[list["GroupLaborPoolMember"]] = relationship(back_populates="pool", cascade="all, delete-orphan")
    tag: Mapped["Tag | None"] = relationship()


class GroupLaborPoolMember(Base):
    __tablename__ = "group_labor_pool_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pool_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("group_labor_pools.id", ondelete="CASCADE"))
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"))

    metric_value: Mapped[float | None] = mapped_column(Numeric(12, 4))
    hours_pp: Mapped[float | None] = mapped_column(Numeric(10, 4))
    hours_pt: Mapped[float | None] = mapped_column(Numeric(10, 4))

    pool: Mapped["GroupLaborPool"] = relationship(back_populates="members")

    __table_args__ = (
        UniqueConstraint("pool_id", "product_id"),
    )


# ──────────────────────────────────────────────────────────────────────
# Presets
# ──────────────────────────────────────────────────────────────────────

class Preset(Base):
    __tablename__ = "presets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    preset_id_code: Mapped[str | None] = mapped_column(String, unique=True)
    category: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)

    # Product spec snapshot
    material_type: Mapped[str | None] = mapped_column(String)
    material_detail: Mapped[str | None] = mapped_column(String)
    lumber_thickness: Mapped[str | None] = mapped_column(String)
    base_type: Mapped[str | None] = mapped_column(String)
    edge_profile: Mapped[str | None] = mapped_column(String)
    stain_or_color: Mapped[str | None] = mapped_column(String)
    sheen: Mapped[str | None] = mapped_column(String)

    # Margin overrides
    hardwood_margin_rate: Mapped[float | None] = mapped_column(Numeric(5, 4))
    stone_margin_rate: Mapped[float | None] = mapped_column(Numeric(5, 4))
    stock_base_margin_rate: Mapped[float | None] = mapped_column(Numeric(5, 4))

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    blocks: Mapped[list["PresetBlock"]] = relationship(back_populates="preset", cascade="all, delete-orphan")


class PresetBlock(Base):
    __tablename__ = "preset_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    preset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("presets.id", ondelete="CASCADE"))

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    domain: Mapped[str] = mapped_column(String, nullable=False)  # cost, labor

    # Cost fields
    cost_category: Mapped[str | None] = mapped_column(String)
    block_type: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    cost_per_unit: Mapped[float | None] = mapped_column(Numeric(12, 4))
    multiplier_type: Mapped[str | None] = mapped_column(String)

    # Labor fields
    labor_center: Mapped[str | None] = mapped_column(String)
    rate_value: Mapped[float | None] = mapped_column(Numeric(10, 4))
    hours_per_unit: Mapped[float | None] = mapped_column(Numeric(10, 4))
    metric_source: Mapped[str | None] = mapped_column(String)

    tag_name: Mapped[str | None] = mapped_column(String)

    preset: Mapped["Preset"] = relationship(back_populates="blocks")


# ──────────────────────────────────────────────────────────────────────
# Stock Base Catalog
# ──────────────────────────────────────────────────────────────────────

class StockBaseCatalog(Base):
    __tablename__ = "stock_base_catalog"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    vendor: Mapped[str] = mapped_column(String, nullable=False)
    style: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[str | None] = mapped_column(String)
    height: Mapped[str | None] = mapped_column(String)
    color: Mapped[str | None] = mapped_column(String)
    ji_column: Mapped[str | None] = mapped_column(String)
    ji_top_plate: Mapped[str | None] = mapped_column(String)
    ji_footring: Mapped[str | None] = mapped_column(String)

    cost_each: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    tariff_note: Mapped[str | None] = mapped_column(String)

    max_top_rect_w: Mapped[float | None] = mapped_column(Numeric(8, 2))
    max_top_rect_l: Mapped[float | None] = mapped_column(Numeric(8, 2))
    max_top_round: Mapped[float | None] = mapped_column(Numeric(8, 2))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def lookup_key(self) -> str:
        return "|".join([
            self.vendor, self.style,
            self.size or "", self.height or "", self.color or "",
            self.ji_column or "", self.ji_top_plate or "", self.ji_footring or "",
        ])


# ──────────────────────────────────────────────────────────────────────
# Material Context
# ──────────────────────────────────────────────────────────────────────

class MaterialContext(Base):
    __tablename__ = "material_context"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    material_type: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    show_lumber_thickness: Mapped[bool] = mapped_column(Boolean, default=False)
    show_species_picker: Mapped[bool] = mapped_column(Boolean, default=False)
    show_stone_picker: Mapped[bool] = mapped_column(Boolean, default=False)
    show_edge_profile: Mapped[bool] = mapped_column(Boolean, default=True)
    show_stain_color: Mapped[bool] = mapped_column(Boolean, default=True)

    default_margins: Mapped[dict | None] = mapped_column(JSONB)
    default_labor_centers: Mapped[list | None] = mapped_column(JSONB)
    material_options: Mapped[list | None] = mapped_column(JSONB)
    edge_options: Mapped[list | None] = mapped_column(JSONB)
    stain_options: Mapped[list | None] = mapped_column(JSONB)
    sheen_options: Mapped[list | None] = mapped_column(JSONB)
