"""initial schema v1

Revision ID: 001_initial_schema_v1
Revises:
Create Date: 2026-04-06 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001_initial_schema_v1'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Load the initial schema from schema_v1.sql"""
    import os

    # Path to schema file (relative to this migrations file)
    schema_path = os.path.join(
        os.path.dirname(__file__),
        '..', '..', 'schema_v1.sql'
    )

    with open(schema_path, 'r') as f:
        schema_sql = f.read()

    # Split by semicolon and execute each statement
    for statement in schema_sql.split(';'):
        statement = statement.strip()
        if statement and not statement.startswith('--'):
            op.execute(statement)


def downgrade() -> None:
    """Drop all tables (reverse of upgrade)"""
    op.execute("DROP TABLE IF EXISTS audit_log CASCADE")
    op.execute("DROP TABLE IF EXISTS description_templates CASCADE")
    op.execute("DROP TABLE IF EXISTS material_context CASCADE")
    op.execute("DROP TABLE IF EXISTS stock_base_catalog CASCADE")
    op.execute("DROP TABLE IF EXISTS preset_blocks CASCADE")
    op.execute("DROP TABLE IF EXISTS presets CASCADE")
    op.execute("DROP TABLE IF EXISTS group_labor_pool_members CASCADE")
    op.execute("DROP TABLE IF EXISTS group_labor_pools CASCADE")
    op.execute("DROP TABLE IF EXISTS group_cost_pool_members CASCADE")
    op.execute("DROP TABLE IF EXISTS group_cost_pools CASCADE")
    op.execute("DROP TABLE IF EXISTS labor_blocks CASCADE")
    op.execute("DROP TABLE IF EXISTS cost_blocks CASCADE")
    op.execute("DROP TABLE IF EXISTS products CASCADE")
    op.execute("DROP TABLE IF EXISTS quote_options CASCADE")
    op.execute("DROP TABLE IF EXISTS quotes CASCADE")
    op.execute("DROP TABLE IF EXISTS tags CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
    op.execute("DROP FUNCTION IF EXISTS update_timestamp()")
