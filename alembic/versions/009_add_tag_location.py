"""Add tag_location to products for PDF display.

Revision ID: 009
Revises: 008
Create Date: 2026-04-08
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("tag_location", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "tag_location")
