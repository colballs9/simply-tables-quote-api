"""schema additions: product_components, species_assignments, is_builtin, panel data, sales_tax

Revision ID: 003_schema_additions
Revises: 002_add_shipping_to_quotes
Create Date: 2026-04-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '003_schema_additions'
down_revision = '002_add_shipping_to_quotes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── New tables ───────────────────────────────────────────────────────

    op.create_table(
        'product_components',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('product_id', UUID(as_uuid=True),
                  sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('component_type', sa.Text, nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('width', sa.Numeric(8, 2)),
        sa.Column('length', sa.Numeric(8, 2)),
        sa.Column('thickness', sa.Numeric(8, 4)),
        sa.Column('qty_per_base', sa.Integer, server_default='1'),
        sa.Column('material', sa.Text),
        # Computed by engine
        sa.Column('bd_ft_per_piece', sa.Numeric(10, 4)),
        sa.Column('bd_ft_pp', sa.Numeric(10, 4)),
        sa.Column('sq_ft_per_piece', sa.Numeric(10, 4)),
        sa.Column('sq_ft_pp', sa.Numeric(10, 4)),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()')),
    )
    op.create_index('idx_components_product', 'product_components', ['product_id'])

    op.create_table(
        'species_assignments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('quote_id', UUID(as_uuid=True),
                  sa.ForeignKey('quotes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('species_name', sa.Text, nullable=False),
        sa.Column('quarter_code', sa.Text, nullable=False),
        sa.Column('species_key', sa.Text, nullable=False),
        sa.Column('price_per_bdft', sa.Numeric(10, 4)),
        sa.Column('total_bdft', sa.Numeric(12, 4)),
        sa.Column('total_cost', sa.Numeric(12, 2)),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()')),
        sa.UniqueConstraint('quote_id', 'species_key', name='uq_species_assignment'),
    )
    op.create_index('idx_species_quote', 'species_assignments', ['quote_id'])

    # ── Alter existing tables ─────────────────────────────────────────────

    # cost_blocks / labor_blocks: built-in flag
    op.add_column('cost_blocks',
                  sa.Column('is_builtin', sa.Boolean, nullable=False, server_default='false'))
    op.add_column('labor_blocks',
                  sa.Column('is_builtin', sa.Boolean, nullable=False, server_default='false'))

    # quotes: additional job-level fields (shipping + grand_total already added in 002)
    op.add_column('quotes',
                  sa.Column('sales_tax', sa.Numeric(12, 2), server_default='0'))
    op.add_column('quotes',
                  sa.Column('budget_buffer_rate', sa.Numeric(5, 4), server_default='0.05'))

    # products: panel data for rate labor pipeline
    op.add_column('products',
                  sa.Column('panel_sqft', sa.Numeric(10, 4)))
    op.add_column('products',
                  sa.Column('panel_count', sa.Integer))


def downgrade() -> None:
    op.drop_column('products', 'panel_count')
    op.drop_column('products', 'panel_sqft')
    op.drop_column('quotes', 'budget_buffer_rate')
    op.drop_column('quotes', 'sales_tax')
    op.drop_column('labor_blocks', 'is_builtin')
    op.drop_column('cost_blocks', 'is_builtin')
    op.drop_index('idx_species_quote', 'species_assignments')
    op.drop_table('species_assignments')
    op.drop_index('idx_components_product', 'product_components')
    op.drop_table('product_components')
