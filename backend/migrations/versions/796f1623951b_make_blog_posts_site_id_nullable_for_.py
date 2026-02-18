"""make blog_posts site_id nullable for unlisted posts

Revision ID: 796f1623951b
Revises: o4p5q6r7s8t9
Create Date: 2026-02-18 22:58:06.890316
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '796f1623951b'
down_revision: Union[str, None] = 'o4p5q6r7s8t9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('blog_posts', 'site_id',
               existing_type=sa.UUID(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('blog_posts', 'site_id',
               existing_type=sa.UUID(),
               nullable=False)
