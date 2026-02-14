import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sites.id", ondelete="CASCADE"),
        nullable=False,
    )
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_schedules.id", ondelete="SET NULL"),
        nullable=True,
    )
    prompt_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prompt_templates.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Content
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    featured_image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    categories: Mapped[list] = mapped_column(JSON, default=list)
    tags: Mapped[list] = mapped_column(JSON, default=list)

    # Status
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft"
    )  # draft, pending_review, published, rejected
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Platform publishing
    platform_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Prompt audit trail
    system_prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic_prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    schedule: Mapped["BlogSchedule | None"] = relationship(back_populates="posts")
    site: Mapped["Site"] = relationship(lazy="selectin")


class ExecutionHistory(Base):
    __tablename__ = "execution_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_schedules.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("blog_posts.id", ondelete="SET NULL"),
        nullable=True,
    )

    execution_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # scheduled, manual
    execution_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    schedule: Mapped["BlogSchedule"] = relationship(back_populates="executions")


from app.models.blog_schedule import BlogSchedule  # noqa: E402, F401
from app.models.site import Site  # noqa: E402, F401
