import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BlogSchedule(Base):
    __tablename__ = "blog_schedules"

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
    prompt_template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prompt_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Scheduling
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)  # daily, weekly, monthly, custom
    custom_cron: Mapped[str | None] = mapped_column(String(100), nullable=True)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-6
    day_of_month: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-31
    time_of_day: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # Content settings
    topics: Mapped[list] = mapped_column(JSON, nullable=False)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    include_images: Mapped[bool] = mapped_column(Boolean, default=False)
    category_ids: Mapped[list] = mapped_column(JSON, default=list)
    tag_ids: Mapped[list] = mapped_column(JSON, default=list)
    skipped_dates: Mapped[list] = mapped_column(JSON, default=list)
    prompt_replacements: Mapped[dict] = mapped_column(JSON, default=dict)

    # Post settings
    post_status: Mapped[str] = mapped_column(String(20), default="draft")
    enable_review: Mapped[bool] = mapped_column(Boolean, default=True)

    # State
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_run: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    site: Mapped["Site"] = relationship(lazy="selectin")
    prompt_template: Mapped["PromptTemplate"] = relationship(lazy="selectin")
    posts: Mapped[list["BlogPost"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )
    executions: Mapped[list["ExecutionHistory"]] = relationship(
        back_populates="schedule", cascade="all, delete-orphan"
    )


# Avoid circular import — these are resolved by SQLAlchemy at runtime
from app.models.site import Site  # noqa: E402, F401
from app.models.prompt_template import PromptTemplate  # noqa: E402, F401
from app.models.blog_post import BlogPost, ExecutionHistory  # noqa: E402, F401
