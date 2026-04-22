from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from utils.database import Base


class WhatsAppConfig(Base):
    __tablename__ = "whatsapp_configs"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), unique=True)
    phone_numbers = Column(String, default="")  # comma-separated: "971501234567,971509876543"
    alert_types = Column(String, default="sales,budget,stock,expiry")  # comma-separated

    branch = relationship("Branch", foreign_keys=[branch_id])
