"""Quote block architecture refactor

Revision ID: 006_quote_block_architecture
Revises: 005
Create Date: 2026-04-07

Phase 2A: Replace per-product cost_blocks/labor_blocks and quote-level
group_cost_pools/group_labor_pools with unified quote_blocks + quote_block_members.
Add system_defaults table and default rate/margin columns on quotes.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "006_quote_block_architecture"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. system_defaults ────────────────────────────────────────────
    op.create_table(
        "system_defaults",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("key", sa.String(), nullable=False, unique=True),
        sa.Column("hourly_rate", sa.Numeric(8, 2), nullable=False, server_default="155.00"),
        # Margin rates
        sa.Column("hardwood_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.0500"),
        sa.Column("stone_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.2500"),
        sa.Column("stock_base_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.2500"),
        sa.Column("stock_base_ship_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.0500"),
        sa.Column("powder_coat_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.1000"),
        sa.Column("custom_base_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.0500"),
        sa.Column("unit_cost_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.0500"),
        sa.Column("group_cost_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.0500"),
        sa.Column("misc_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.0000"),
        sa.Column("consumables_margin_rate", sa.Numeric(5, 4), nullable=False, server_default="0.0000"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # Seed the single defaults row
    op.execute("""
        INSERT INTO system_defaults (key) VALUES ('global')
    """)

    # ── 2. Add default rate/margin columns to quotes ──────────────────
    quote_defaults = [
        ("default_hourly_rate", sa.Numeric(8, 2), "155.00"),
        ("default_hardwood_margin_rate", sa.Numeric(5, 4), "0.0500"),
        ("default_stone_margin_rate", sa.Numeric(5, 4), "0.2500"),
        ("default_stock_base_margin_rate", sa.Numeric(5, 4), "0.2500"),
        ("default_stock_base_ship_margin_rate", sa.Numeric(5, 4), "0.0500"),
        ("default_powder_coat_margin_rate", sa.Numeric(5, 4), "0.1000"),
        ("default_custom_base_margin_rate", sa.Numeric(5, 4), "0.0500"),
        ("default_unit_cost_margin_rate", sa.Numeric(5, 4), "0.0500"),
        ("default_group_cost_margin_rate", sa.Numeric(5, 4), "0.0500"),
        ("default_misc_margin_rate", sa.Numeric(5, 4), "0.0000"),
        ("default_consumables_margin_rate", sa.Numeric(5, 4), "0.0000"),
    ]
    for col_name, col_type, default in quote_defaults:
        op.add_column(
            "quotes",
            sa.Column(col_name, col_type, nullable=False, server_default=default),
        )

    # ── 3. quote_blocks ───────────────────────────────────────────────
    op.create_table(
        "quote_blocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        # Block classification
        sa.Column("block_domain", sa.String(), nullable=False),  # cost | labor
        sa.Column("block_type", sa.String(), nullable=False),    # rate | unit | group
        sa.Column("label", sa.String(), nullable=True),
        # Cost fields
        sa.Column("cost_category", sa.String(), nullable=True),
        sa.Column("cost_per_unit", sa.Numeric(12, 4), nullable=True),
        sa.Column("units_per_product", sa.Numeric(10, 4), nullable=True),
        sa.Column("multiplier_type", sa.String(), nullable=True),
        # Labor fields
        sa.Column("labor_center", sa.String(), nullable=True),
        sa.Column("rate_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("metric_source", sa.String(), nullable=True),
        sa.Column("rate_type", sa.String(), nullable=True, server_default="metric"),
        sa.Column("hours_per_unit", sa.Numeric(10, 4), nullable=True),
        # Group fields
        sa.Column("total_amount", sa.Numeric(12, 4), nullable=True),
        sa.Column("total_hours", sa.Numeric(10, 4), nullable=True),
        sa.Column("distribution_type", sa.String(), nullable=True),
        sa.Column("on_qty_change", sa.String(), nullable=True, server_default="redistribute"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_index("idx_quote_blocks_quote", "quote_blocks", ["quote_id"])
    op.create_index("idx_quote_blocks_domain", "quote_blocks", ["block_domain"])

    # ── 4. quote_block_members ────────────────────────────────────────
    op.create_table(
        "quote_block_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_block_id", UUID(as_uuid=True), sa.ForeignKey("quote_blocks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        # Per-member overrides (nullable = use block-level value)
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("hours_per_unit", sa.Numeric(10, 4), nullable=True),
        sa.Column("cost_per_unit", sa.Numeric(12, 4), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        # Computed by engine
        sa.Column("cost_pp", sa.Numeric(12, 4), nullable=True),
        sa.Column("cost_pt", sa.Numeric(12, 4), nullable=True),
        sa.Column("hours_pp", sa.Numeric(10, 4), nullable=True),
        sa.Column("hours_pt", sa.Numeric(10, 4), nullable=True),
        sa.Column("metric_value", sa.Numeric(12, 4), nullable=True),
        sa.UniqueConstraint("quote_block_id", "product_id"),
    )

    op.create_index("idx_block_members_block", "quote_block_members", ["quote_block_id"])
    op.create_index("idx_block_members_product", "quote_block_members", ["product_id"])

    # ── 5. Drop old tables ────────────────────────────────────────────
    # Order matters: drop junction tables first, then parent tables
    op.drop_table("group_cost_pool_members")
    op.drop_table("group_labor_pool_members")
    op.drop_table("group_cost_pools")
    op.drop_table("group_labor_pools")
    op.drop_table("cost_blocks")
    op.drop_table("labor_blocks")


def downgrade():
    # ── Recreate old tables ───────────────────────────────────────────
    op.create_table(
        "cost_blocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_category", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("cost_per_unit", sa.Numeric(12, 4), nullable=True),
        sa.Column("units_per_product", sa.Numeric(10, 4), nullable=False, server_default="1"),
        sa.Column("multiplier_type", sa.String(), nullable=False, server_default="per_unit"),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("cost_pp", sa.Numeric(12, 4), nullable=True),
        sa.Column("cost_pt", sa.Numeric(12, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_cost_blocks_product", "cost_blocks", ["product_id"])
    op.create_index("idx_cost_blocks_category", "cost_blocks", ["cost_category"])

    op.create_table(
        "labor_blocks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("labor_center", sa.String(), nullable=False),
        sa.Column("block_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_builtin", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("rate_value", sa.Numeric(10, 4), nullable=True),
        sa.Column("metric_source", sa.String(), nullable=True),
        sa.Column("rate_type", sa.String(), nullable=False, server_default="metric"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("hours_per_unit", sa.Numeric(10, 4), nullable=True),
        sa.Column("hours_pp", sa.Numeric(10, 4), nullable=True),
        sa.Column("hours_pt", sa.Numeric(10, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_labor_blocks_product", "labor_blocks", ["product_id"])
    op.create_index("idx_labor_blocks_lc", "labor_blocks", ["labor_center"])

    op.create_table(
        "group_cost_pools",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cost_category", sa.String(), nullable=False, server_default="group_cost"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("total_amount", sa.Numeric(12, 4), nullable=False),
        sa.Column("distribution_type", sa.String(), nullable=False, server_default="units"),
        sa.Column("on_qty_change", sa.String(), nullable=False, server_default="redistribute"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "group_cost_pool_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("pool_id", UUID(as_uuid=True), sa.ForeignKey("group_cost_pools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metric_value", sa.Numeric(12, 4), nullable=True),
        sa.Column("cost_pp", sa.Numeric(12, 4), nullable=True),
        sa.Column("cost_pt", sa.Numeric(12, 4), nullable=True),
        sa.UniqueConstraint("pool_id", "product_id"),
    )

    op.create_table(
        "group_labor_pools",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("quote_id", UUID(as_uuid=True), sa.ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("labor_center", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("total_hours", sa.Numeric(10, 4), nullable=False),
        sa.Column("distribution_type", sa.String(), nullable=False, server_default="units"),
        sa.Column("on_qty_change", sa.String(), nullable=False, server_default="redistribute"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "group_labor_pool_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("pool_id", UUID(as_uuid=True), sa.ForeignKey("group_labor_pools.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("metric_value", sa.Numeric(12, 4), nullable=True),
        sa.Column("hours_pp", sa.Numeric(10, 4), nullable=True),
        sa.Column("hours_pt", sa.Numeric(10, 4), nullable=True),
        sa.UniqueConstraint("pool_id", "product_id"),
    )

    # Drop new tables
    op.drop_table("quote_block_members")
    op.drop_table("quote_blocks")

    # Remove quote default columns
    quote_cols = [
        "default_hourly_rate",
        "default_hardwood_margin_rate",
        "default_stone_margin_rate",
        "default_stock_base_margin_rate",
        "default_stock_base_ship_margin_rate",
        "default_powder_coat_margin_rate",
        "default_custom_base_margin_rate",
        "default_unit_cost_margin_rate",
        "default_group_cost_margin_rate",
        "default_misc_margin_rate",
        "default_consumables_margin_rate",
    ]
    for col_name in quote_cols:
        op.drop_column("quotes", col_name)

    op.drop_table("system_defaults")
