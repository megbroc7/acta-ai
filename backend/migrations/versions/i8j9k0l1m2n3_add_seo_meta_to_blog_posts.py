"""Add SEO meta columns to blog_posts

Revision ID: i8j9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2026-02-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "i8j9k0l1m2n3"
down_revision: Union[str, None] = "h7i8j9k0l1m2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("blog_posts", sa.Column("meta_title", sa.String(200), nullable=True))
    op.add_column("blog_posts", sa.Column("meta_description", sa.String(500), nullable=True))
    op.add_column("blog_posts", sa.Column("image_alt_text", sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column("blog_posts", "image_alt_text")
    op.drop_column("blog_posts", "meta_description")
    op.drop_column("blog_posts", "meta_title")
