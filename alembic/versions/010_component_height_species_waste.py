"""Add depth to product_components, waste_factor to species_assignments.

Components now have separate depth dimension (L x W x D) distinct from
lumber thickness. Species assignments get an editable waste_factor (default 25%).

Revision ID: 010
Revises: 009
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("product_components", sa.Column("depth", sa.Numeric(8, 2), nullable=True))
    op.add_column("species_assignments", sa.Column("waste_factor", sa.Numeric(5, 4), nullable=True, server_default="0.25"))


def downgrade() -> None:
    op.drop_column("product_components", "depth")
    op.drop_column("species_assignments", "waste_factor")
