"""Add description fields, indoor_outdoor, and product_description_items table.

Revision ID: 008
Revises: 007
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New product columns
    op.add_column("products", sa.Column("indoor_outdoor", sa.String(), server_default="Indoor"))
    op.add_column("products", sa.Column("grain_direction", sa.String(), nullable=True))
    op.add_column("products", sa.Column("stone_manufacturer", sa.String(), nullable=True))
    op.add_column("products", sa.Column("stone_color", sa.String(), nullable=True))
    op.add_column("products", sa.Column("stone_finish", sa.String(), nullable=True))
    op.add_column("products", sa.Column("base_height", sa.String(), nullable=True))
    op.add_column("products", sa.Column("base_finish_color", sa.String(), nullable=True))
    op.add_column("products", sa.Column("base_materials", sa.String(), nullable=True))
    op.add_column("products", sa.Column("base_finish", sa.String(), nullable=True))
    op.add_column("products", sa.Column("base_color", sa.String(), nullable=True))

    # Dynamic description items (details + exceptions per section)
    op.create_table(
        "product_description_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("product_id", UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section", sa.String(), nullable=False),   # top_finishes, top_edge, top_other, base
        sa.Column("item_type", sa.String(), nullable=False),  # detail, exception
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_desc_items_product", "product_description_items", ["product_id"])


def downgrade() -> None:
    op.drop_table("product_description_items")
    op.drop_column("products", "base_color")
    op.drop_column("products", "base_finish")
    op.drop_column("products", "base_materials")
    op.drop_column("products", "base_finish_color")
    op.drop_column("products", "base_height")
    op.drop_column("products", "stone_finish")
    op.drop_column("products", "stone_color")
    op.drop_column("products", "stone_manufacturer")
    op.drop_column("products", "grain_direction")
    op.drop_column("products", "indoor_outdoor")
