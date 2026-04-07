"""Add stone_assignments table

Revision ID: 004_add_stone_assignments
Revises: 003_schema_additions
Create Date: 2026-04-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '004_add_stone_assignments'
down_revision = '003_schema_additions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'stone_assignments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('quote_id', UUID(as_uuid=True),
                  sa.ForeignKey('quotes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('stone_key', sa.Text, nullable=False),        # 'Quartz', 'Terrazzo', etc.
        sa.Column('total_sqft', sa.Numeric(12, 4)),             # computed from products
        sa.Column('total_cost', sa.Numeric(12, 2)),             # user input
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('quote_id', 'stone_key', name='uq_stone_assignment'),
    )
    op.create_index('idx_stone_quote', 'stone_assignments', ['quote_id'])


def downgrade() -> None:
    op.drop_index('idx_stone_quote', table_name='stone_assignments')
    op.drop_table('stone_assignments')
