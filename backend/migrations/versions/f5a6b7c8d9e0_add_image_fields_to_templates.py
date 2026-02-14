"""add image fields to templates

Revision ID: f5a6b7c8d9e0
Revises: 5345737bf6d2
Create Date: 2026-02-14 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = '5345737bf6d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('prompt_templates', sa.Column('image_source', sa.String(20), nullable=True))
    op.add_column('prompt_templates', sa.Column('image_style_guidance', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('prompt_templates', 'image_style_guidance')
    op.drop_column('prompt_templates', 'image_source')
