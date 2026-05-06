from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from utils.database import Base


class LoginLog(Base):
    __tablename__ = "login_logs"

    id = Column(Integer, primary_key=True, index=True)
    app = Column(String(50), nullable=False)           # "admin_dashboard" | "flavor_expert"
    login_name = Column(String(255), nullable=False)   # username or branch login_id
    display_name = Column(String(255), nullable=True)  # full name or branch name
    user_id = Column(Integer, nullable=True)           # admin user id
    branch_id = Column(Integer, nullable=True)         # branch id (flavor expert)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(Text, nullable=True)
    success = Column(Boolean, default=True)
    failure_reason = Column(String(500), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
