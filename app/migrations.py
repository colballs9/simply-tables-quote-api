"""Alembic migration runner for startup."""

from alembic import command
from alembic.config import Config
import os


def run_migrations():
    """Run all pending Alembic migrations."""
    # Load alembic.ini from project root
    alembic_ini = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        'alembic.ini'
    )

    alembic_cfg = Config(alembic_ini)

    # Run migrations
    command.upgrade(alembic_cfg, "head")
