"""Add margin_rate to quote_blocks.

Each cost block now has its own margin rate instead of per-product
per-category rates. Default 5% for most blocks, pipelines set
appropriate defaults for species (5%) and stone (25%).

Revision ID: 012
Revises: 011
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quote_blocks", sa.Column("margin_rate", sa.Numeric(5, 4), nullable=True, server_default="0.05"))


def downgrade() -> None:
    op.drop_column("quote_blocks", "margin_rate")
