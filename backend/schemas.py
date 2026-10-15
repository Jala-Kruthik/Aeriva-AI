from pydantic import BaseModel, EmailStr, Field


# =========================================================
# USER REGISTRATION
# =========================================================

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

    age: int | None = None
    height: float | None = None
    weight: float | None = None
    health_goal: str | None = None


# =========================================================
# USER LOGIN
# =========================================================

class UserLogin(BaseModel):
    email: EmailStr
    password: str


# =========================================================
# HEALTH DATA
# =========================================================

class HealthData(BaseModel):
    sleep_hours: float = Field(
        ...,
        ge=0,
        le=24
    )

    food_details: str = Field(
        ...,
        min_length=1
    )

    daily_calories: float = Field(
        ...,
        ge=0
    )

    exercise_minutes: float = Field(
        ...,
        ge=0
    )

    daily_routine: str = Field(
        ...,
        min_length=1
    )


# =========================================================
# DAILY SCHEDULE
# =========================================================

class DailyScheduleData(BaseModel):
    day_of_week: str = Field(
        ...,
        min_length=1
    )

    wake_up_time: str

    breakfast_time: str

    lunch_time: str

    snack_time: str

    dinner_time: str

    work_start_time: str

    work_end_time: str

    free_start_time: str

    free_end_time: str

    sleep_time: str


# =========================================================
# WEEKLY SCHEDULE
# =========================================================

class WeeklyScheduleData(BaseModel):
    schedules: list[DailyScheduleData] = Field(
        ...,
        min_length=7,
        max_length=7
    )


# =========================================================
# FOOD LOG
# =========================================================

class FoodLogCreate(BaseModel):
    meal_type: str = Field(
        ...,
        min_length=1
    )

    food_name: str = Field(
        ...,
        min_length=1
    )

    quantity: float = Field(
        ...,
        gt=0
    )


# =========================================================
# FOOD LOG RESPONSE
# =========================================================

class FoodLogResponse(BaseModel):
    id: int

    log_date: str

    meal_type: str

    food_name: str

    quantity: float | None

    calories: float