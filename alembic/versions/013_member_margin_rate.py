"""Add margin_rate to quote_block_members for per-product margin overrides.

Block.margin_rate is the default; member.margin_rate overrides per product.

Revision ID: 013
Revises: 012
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("quote_block_members", sa.Column("margin_rate", sa.Numeric(5, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("quote_block_members", "margin_rate")
