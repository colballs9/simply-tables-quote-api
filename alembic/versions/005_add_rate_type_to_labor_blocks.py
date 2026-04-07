"""Add rate_type to labor_blocks

Revision ID: 005
Revises: 004_add_stone_assignments
Create Date: 2026-04-07

Adds rate_type column to labor_blocks:
  - 'metric' (default): total_hours = total_metric / rate (sqft/hr, panels/hr)
  - 'units': total_hours = total_qty / rate; distribute by metric (tables/hr — LC104 CNC pattern)

Also adds 'sq_ft' as a valid metric_source (DIA-adjusted area, distinct from 'top_sqft' which is sq_ft_wl).
This is a data/application-level distinction; no schema column change needed for metric_source.
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004_add_stone_assignments"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "labor_blocks",
        sa.Column("rate_type", sa.String(), nullable=False, server_default="metric"),
    )


def downgrade():
    op.drop_column("labor_blocks", "rate_type")
