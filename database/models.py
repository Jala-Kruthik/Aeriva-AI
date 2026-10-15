from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    ForeignKey,
    Date,
    DateTime
)
from sqlalchemy.orm import relationship
from datetime import datetime

from database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    name = Column(
        String,
        nullable=False
    )

    email = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    password = Column(
        String,
        nullable=False
    )

    age = Column(
        Integer,
        nullable=True
    )

    height = Column(
        Float,
        nullable=True
    )

    weight = Column(
        Float,
        nullable=True
    )

    health_goal = Column(
        String,
        nullable=True
    )

    # False = user still needs to complete
    # the first-time AERIVA onboarding.
    onboarding_completed = Column(
        Boolean,
        default=False,
        nullable=False
    )

    schedules = relationship(
        "DailySchedule",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    food_logs = relationship(
        "FoodLog",
        back_populates="user",
        cascade="all, delete-orphan"
    )


class DailySchedule(Base):
    __tablename__ = "daily_schedules"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    day_of_week = Column(
        String,
        nullable=False
    )

    wake_up_time = Column(
        String,
        nullable=False
    )

    breakfast_time = Column(
        String,
        nullable=False
    )

    lunch_time = Column(
        String,
        nullable=False
    )

    snack_time = Column(
        String,
        nullable=False
    )

    dinner_time = Column(
        String,
        nullable=False
    )

    work_start_time = Column(
        String,
        nullable=False
    )

    work_end_time = Column(
        String,
        nullable=False
    )

    free_start_time = Column(
        String,
        nullable=False
    )

    free_end_time = Column(
        String,
        nullable=False
    )

    sleep_time = Column(
        String,
        nullable=False
    )

    user = relationship(
        "User",
        back_populates="schedules"
    )


class FoodLog(Base):
    __tablename__ = "food_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    log_date = Column(
        Date,
        nullable=False
    )

    meal_type = Column(
        String,
        nullable=False
    )

    food_name = Column(
        String,
        nullable=False
    )

    quantity = Column(
        String,
        nullable=True
    )

    calories = Column(
        Float,
        nullable=False,
        default=0
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    user = relationship(
        "User",
        back_populates="food_logs"
    )