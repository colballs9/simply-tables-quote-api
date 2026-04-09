"""Add stone_group to products for manual stone cost block grouping.

When material_type is Stone, the user assigns a group number (1, 2, 3...)
to control which stone cost block each product belongs to.

Revision ID: 011
Revises: 010
Create Date: 2026-04-09
"""

from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("stone_group", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "stone_group")
