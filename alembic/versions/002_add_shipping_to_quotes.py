"""add shipping to quotes

Revision ID: 002_add_shipping_to_quotes
Revises: 001_initial_schema_v1
Create Date: 2026-04-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_shipping_to_quotes'
down_revision = '001_initial_schema_v1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('quotes', sa.Column('shipping', sa.Numeric(12, 2), nullable=True, server_default='0'))
    op.add_column('quotes', sa.Column('grand_total', sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('quotes', 'grand_total')
    op.drop_column('quotes', 'shipping')
