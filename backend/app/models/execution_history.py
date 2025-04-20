from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class ExecutionHistory(Base):
    __tablename__ = "execution_history"
    
    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("blog_schedules.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Execution details
    execution_type = Column(String, nullable=False)  # "scheduled", "manual"
    execution_time = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    post_id = Column(Integer, ForeignKey("blog_posts.id"), nullable=True)  # If successful
    
    # Relationships
    schedule = relationship("BlogSchedule", backref="execution_history")
    user = relationship("User", backref="execution_history")
    post = relationship("BlogPost", backref="execution_history") 