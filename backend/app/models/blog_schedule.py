from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class BlogSchedule(Base):
    __tablename__ = "blog_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("wordpress_sites.id"), nullable=False)
    prompt_template_id = Column(Integer, ForeignKey("prompt_templates.id"), nullable=False)
    name = Column(String, nullable=False)
    
    # Scheduling settings
    frequency = Column(String, nullable=False)  # daily, weekly, monthly, custom
    custom_cron = Column(String)
    day_of_week = Column(Integer)  # 0-6 (Monday to Sunday)
    day_of_month = Column(Integer)  # 1-31
    time_of_day = Column(String)  # HH:MM format
    
    # Content settings
    topics = Column(JSON)  # Array of topic strings or ideas to generate from
    word_count = Column(Integer)
    include_images = Column(Boolean, default=False)
    tone = Column(String)
    category_ids = Column(JSON)  # Array of category IDs
    tag_ids = Column(JSON)  # Array of tag IDs
    
    # Custom prompt replacements (override template defaults)
    prompt_replacements = Column(JSON)  # {"placeholder_name": "custom_value"}
    
    # Post settings
    post_status = Column(String, default="draft")  # draft, publish
    enable_review = Column(Boolean, default=True)  # Require manual approval before publishing
    
    # Status
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime(timezone=True))
    next_run = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", backref="schedules")
    site = relationship("WordPressSite", backref="schedules")
    prompt_template = relationship("PromptTemplate", backref="schedules")

class BlogPost(Base):
    __tablename__ = "blog_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("blog_schedules.id"))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    site_id = Column(Integer, ForeignKey("wordpress_sites.id"), nullable=False)
    prompt_template_id = Column(Integer, ForeignKey("prompt_templates.id"), nullable=False)
    
    # WordPress info
    wordpress_id = Column(Integer)
    wordpress_url = Column(String)
    
    # Content
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    excerpt = Column(Text)
    categories = Column(JSON)  # Array of category IDs
    tags = Column(JSON)  # Array of tag IDs
    featured_image_url = Column(String)
    
    # Prompt used
    system_prompt_used = Column(Text)
    topic_prompt_used = Column(Text)
    content_prompt_used = Column(Text)
    
    # Status info
    status = Column(String, default="draft")  # draft, pending_review, published, rejected
    review_notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    published_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", backref="posts")
    site = relationship("WordPressSite", backref="posts")
    schedule = relationship("BlogSchedule", backref="posts")
    prompt_template = relationship("PromptTemplate", backref="posts") 