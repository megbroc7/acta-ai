from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class WordPressSite(Base):
    __tablename__ = "wordpress_sites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    api_url = Column(String, nullable=False)
    username = Column(String, nullable=False)
    app_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", backref="sites")
    categories = relationship("Category", back_populates="site", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="site", cascade="all, delete-orphan")

class Category(Base):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("wordpress_sites.id"), nullable=False)
    wp_id = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    
    # Relationships
    site = relationship("WordPressSite", back_populates="categories")

class Tag(Base):
    __tablename__ = "tags"
    
    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("wordpress_sites.id"), nullable=False)
    wp_id = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    
    # Relationships
    site = relationship("WordPressSite", back_populates="tags") 