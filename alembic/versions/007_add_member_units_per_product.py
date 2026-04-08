"""Add units_per_product to quote_block_members for per-product piece counts.

Revision ID: 007
Revises: 006_quote_block_architecture
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006_quote_block_architecture"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "quote_block_members",
        sa.Column("units_per_product", sa.Numeric(10, 4), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("quote_block_members", "units_per_product")
