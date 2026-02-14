"""multi_platform_site_abstraction

Revision ID: a1b2c3d4e5f6
Revises: c92b12c3030f
Create Date: 2026-02-12 22:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "c92b12c3030f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Rename table wordpress_sites -> sites
    op.rename_table("wordpress_sites", "sites")

    # 2. Add platform column with server default for backfill, then remove default
    op.add_column("sites", sa.Column("platform", sa.String(20), nullable=False, server_default="wordpress"))
    op.alter_column("sites", "platform", server_default=None)

    # 3. Add new columns for Shopify/Wix support
    op.add_column("sites", sa.Column("api_key", sa.String(500), nullable=True))
    op.add_column("sites", sa.Column("default_blog_id", sa.String(100), nullable=True))

    # 4. Make username and app_password nullable (they're required for WP but not Shopify/Wix)
    op.alter_column("sites", "username", existing_type=sa.String(255), nullable=True)
    op.alter_column("sites", "app_password", existing_type=sa.String(255), nullable=True)

    # 5. Drop + recreate FK constraints pointing at old table name
    # blog_schedules.site_id -> sites.id
    op.drop_constraint("blog_schedules_site_id_fkey", "blog_schedules", type_="foreignkey")
    op.create_foreign_key(
        "blog_schedules_site_id_fkey", "blog_schedules", "sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )

    # blog_posts.site_id -> sites.id
    op.drop_constraint("blog_posts_site_id_fkey", "blog_posts", type_="foreignkey")
    op.create_foreign_key(
        "blog_posts_site_id_fkey", "blog_posts", "sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )

    # categories.site_id -> sites.id
    op.drop_constraint("categories_site_id_fkey", "categories", type_="foreignkey")
    op.create_foreign_key(
        "categories_site_id_fkey", "categories", "sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )

    # tags.site_id -> sites.id
    op.drop_constraint("tags_site_id_fkey", "tags", type_="foreignkey")
    op.create_foreign_key(
        "tags_site_id_fkey", "tags", "sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )

    # 6. Categories: wp_id (integer) -> platform_id (string)
    op.add_column("categories", sa.Column("platform_id", sa.String(100), nullable=True))
    op.execute("UPDATE categories SET platform_id = wp_id::text")
    op.alter_column("categories", "platform_id", nullable=False)
    op.drop_column("categories", "wp_id")

    # 7. Tags: wp_id (integer) -> platform_id (string)
    op.add_column("tags", sa.Column("platform_id", sa.String(100), nullable=True))
    op.execute("UPDATE tags SET platform_id = wp_id::text")
    op.alter_column("tags", "platform_id", nullable=False)
    op.drop_column("tags", "wp_id")

    # 8. Blog posts: wordpress_id (integer) -> platform_post_id (string)
    op.add_column("blog_posts", sa.Column("platform_post_id", sa.String(255), nullable=True))
    op.execute("UPDATE blog_posts SET platform_post_id = wordpress_id::text WHERE wordpress_id IS NOT NULL")
    op.drop_column("blog_posts", "wordpress_id")

    # 9. Blog posts: wordpress_url -> published_url
    op.alter_column("blog_posts", "wordpress_url", new_column_name="published_url")


def downgrade() -> None:
    # Reverse published_url -> wordpress_url
    op.alter_column("blog_posts", "published_url", new_column_name="wordpress_url")

    # Reverse platform_post_id -> wordpress_id
    op.add_column("blog_posts", sa.Column("wordpress_id", sa.Integer, nullable=True))
    op.execute(
        "UPDATE blog_posts SET wordpress_id = platform_post_id::integer "
        "WHERE platform_post_id IS NOT NULL AND platform_post_id ~ '^[0-9]+$'"
    )
    op.drop_column("blog_posts", "platform_post_id")

    # Reverse tags platform_id -> wp_id
    op.add_column("tags", sa.Column("wp_id", sa.Integer, nullable=True))
    op.execute("UPDATE tags SET wp_id = platform_id::integer WHERE platform_id ~ '^[0-9]+$'")
    op.alter_column("tags", "wp_id", nullable=False)
    op.drop_column("tags", "platform_id")

    # Reverse categories platform_id -> wp_id
    op.add_column("categories", sa.Column("wp_id", sa.Integer, nullable=True))
    op.execute("UPDATE categories SET wp_id = platform_id::integer WHERE platform_id ~ '^[0-9]+$'")
    op.alter_column("categories", "wp_id", nullable=False)
    op.drop_column("categories", "platform_id")

    # Reverse FK constraints back to wordpress_sites
    op.drop_constraint("tags_site_id_fkey", "tags", type_="foreignkey")
    op.drop_constraint("categories_site_id_fkey", "categories", type_="foreignkey")
    op.drop_constraint("blog_posts_site_id_fkey", "blog_posts", type_="foreignkey")
    op.drop_constraint("blog_schedules_site_id_fkey", "blog_schedules", type_="foreignkey")

    # Rename table back
    op.rename_table("sites", "wordpress_sites")

    # Recreate FKs pointing at wordpress_sites
    op.create_foreign_key(
        "blog_schedules_site_id_fkey", "blog_schedules", "wordpress_sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "blog_posts_site_id_fkey", "blog_posts", "wordpress_sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "categories_site_id_fkey", "categories", "wordpress_sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )
    op.create_foreign_key(
        "tags_site_id_fkey", "tags", "wordpress_sites",
        ["site_id"], ["id"], ondelete="CASCADE",
    )

    # Remove new columns
    op.alter_column("sites" if False else "wordpress_sites", "username", existing_type=sa.String(255), nullable=False)
    op.alter_column("wordpress_sites", "app_password", existing_type=sa.String(255), nullable=False)
    op.drop_column("wordpress_sites", "default_blog_id")
    op.drop_column("wordpress_sites", "api_key")
    op.drop_column("wordpress_sites", "platform")
