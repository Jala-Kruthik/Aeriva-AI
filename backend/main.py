from datetime import date
from pathlib import Path

from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from database.database import (
    Base,
    engine,
    SessionLocal
)

from database.models import (
    User,
    DailySchedule,
    FoodLog
)

from backend.schemas import (
    UserCreate,
    UserLogin,
    WeeklyScheduleData,
    FoodLogCreate
)

from backend.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
    normalize_email
)

from services.calorie_service import (
    estimate_calories
)


# =========================================
# PATHS
# =========================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"


# =========================================
# FASTAPI
# =========================================

app = FastAPI(
    title="AERIVA AI",
    description="AI-powered health and lifestyle assistant",
    version="1.0.0"
)


# =========================================
# DATABASE
# =========================================

Base.metadata.create_all(bind=engine)


# =========================================
# STATIC FILES
# =========================================

app.mount(
    "/static",
    StaticFiles(directory=str(FRONTEND_DIR)),
    name="static"
)


# =========================================
# HOME
# =========================================

@app.get("/")
def home():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


# =========================================
# REGISTER
# =========================================

@app.post("/register")
def register_user(user: UserCreate):
    db = SessionLocal()

    try:
        email = normalize_email(str(user.email))

        existing_user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists"
            )

        hashed_password = hash_password(user.password)

        new_user = User(
            name=user.name.strip(),
            email=email,
            password=hashed_password,
            age=user.age,
            height=user.height,
            weight=user.weight,
            health_goal=user.health_goal,
            onboarding_completed=False
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        token = create_access_token({"sub": str(new_user.id)})

        return {
            "message": "User registered successfully",
            "user_id": new_user.id,
            "access_token": token,
            "token_type": "bearer",
            "onboarding_completed": bool(new_user.onboarding_completed)
        }

    except HTTPException:
        db.rollback()
        raise

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="An account with this email already exists"
        )

    finally:
        db.close()


# =========================================
# LOGIN
# =========================================

@app.post("/login")
def login_user(user: UserLogin):
    db = SessionLocal()

    try:
        email = normalize_email(str(user.email))

        existing_user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if not existing_user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        password_is_valid = verify_password(
            user.password,
            existing_user.password
        )

        if not password_is_valid:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        token = create_access_token({"sub": str(existing_user.id)})

        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": existing_user.id,
            "name": existing_user.name,
            "onboarding_completed": bool(existing_user.onboarding_completed)
        }

    finally:
        db.close()


# =========================================
# DEVELOPMENT PASSWORD RESET
# =========================================

@app.post("/dev/reset-password")
def reset_password(email: str, new_password: str):
    if not new_password:
        raise HTTPException(
            status_code=400,
            detail="Password cannot be empty"
        )

    if len(new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters"
        )

    db = SessionLocal()

    try:
        email = normalize_email(email)

        user = (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=404,
                detail="Account not found"
            )

        user.password = hash_password(new_password)
        db.commit()

        return {
            "message": "Password reset successfully",
            "email": user.email
        }

    finally:
        db.close()


# =========================================
# CURRENT USER HELPER
# =========================================

def get_current_user(authorization: str | None):
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header required"
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header"
        )

    token = authorization.replace("Bearer ", "", 1)
    user_id = verify_access_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    db = SessionLocal()

    try:
        user = (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

        if not user:
            raise HTTPException(
                status_code=401,
                detail="User not found"
            )

        return user

    finally:
        db.close()


# =========================================
# ME
# =========================================

@app.get("/me")
def get_me(authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "age": user.age,
        "height": user.height,
        "weight": user.weight,
        "health_goal": user.health_goal,
        "onboarding_completed": bool(user.onboarding_completed)
    }


# =========================================
# SAVE WEEKLY SCHEDULE
# =========================================

@app.post("/schedule/weekly")
def save_weekly_schedule(
    schedule_data: WeeklyScheduleData,
    authorization: str | None = Header(default=None)
):
    user = get_current_user(authorization)
    db = SessionLocal()

    try:
        db.query(DailySchedule).filter(
            DailySchedule.user_id == user.id
        ).delete()

        for item in schedule_data.schedules:
            schedule = DailySchedule(
                user_id=user.id,
                day_of_week=item.day_of_week,
                wake_up_time=item.wake_up_time,
                breakfast_time=item.breakfast_time,
                lunch_time=item.lunch_time,
                snack_time=item.snack_time,
                dinner_time=item.dinner_time,
                work_start_time=item.work_start_time,
                work_end_time=item.work_end_time,
                free_start_time=item.free_start_time,
                free_end_time=item.free_end_time,
                sleep_time=item.sleep_time
            )
            db.add(schedule)

        current_user = (
            db.query(User)
            .filter(User.id == user.id)
            .first()
        )

        if current_user:
            current_user.onboarding_completed = True

        db.commit()

        return {
            "message": "Weekly schedule saved successfully",
            "onboarding_completed": True
        }

    finally:
        db.close()


# =========================================
# GET WEEKLY SCHEDULE
# =========================================

@app.get("/schedule/weekly")
def get_weekly_schedule(authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    db = SessionLocal()

    try:
        schedules = (
            db.query(DailySchedule)
            .filter(DailySchedule.user_id == user.id)
            .all()
        )

        return [
            {
                "id": item.id,
                "day_of_week": item.day_of_week,
                "wake_up_time": item.wake_up_time,
                "breakfast_time": item.breakfast_time,
                "lunch_time": item.lunch_time,
                "snack_time": item.snack_time,
                "dinner_time": item.dinner_time,
                "work_start_time": item.work_start_time,
                "work_end_time": item.work_end_time,
                "free_start_time": item.free_start_time,
                "free_end_time": item.free_end_time,
                "sleep_time": item.sleep_time
            }
            for item in schedules
        ]

    finally:
        db.close()


# =========================================
# FOOD LOG
# =========================================

@app.post("/food/log")
def log_food(
    food: FoodLogCreate,
    authorization: str | None = Header(default=None)
):
    user = get_current_user(authorization)

    calorie_data = estimate_calories(
        food.food_name,
        food.quantity
    )

    # Ensure calories is a numeric float for database storage
    calculated_calories = float(calorie_data.get("calories", 0.0))

    db = SessionLocal()

    try:
        food_log = FoodLog(
            user_id=user.id,
            log_date=date.today(),
            meal_type=food.meal_type,
            food_name=food.food_name,
            quantity=str(food.quantity),
            calories=calculated_calories
        )

        db.add(food_log)
        db.commit()
        db.refresh(food_log)

        return {
            "id": food_log.id,
            "log_date": str(food_log.log_date),
            "meal_type": food_log.meal_type,
            "food_name": food_log.food_name,
            "quantity": food.quantity,
            "calories": calculated_calories
        }

    finally:
        db.close()


# =========================================
# TODAY FOOD LOGS
# =========================================

@app.get("/food/log/today")
def get_today_food_logs(authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    db = SessionLocal()

    try:
        logs = (
            db.query(FoodLog)
            .filter(
                FoodLog.user_id == user.id,
                FoodLog.log_date == date.today()
            )
            .order_by(FoodLog.created_at.desc())
            .all()
        )

        return [
            {
                "id": item.id,
                "log_date": str(item.log_date),
                "meal_type": item.meal_type,
                "food_name": item.food_name,
                "quantity": float(item.quantity) if item.quantity else None,
                "calories": item.calories
            }
            for item in logs
        ]

    finally:
        db.close()


# =========================================
# HEALTH ANALYSIS
# =========================================

@app.post("/health/analyze")
def analyze_health(
    sleep_hours: float,
    food_details: str,
    daily_calories: float,
    exercise_minutes: float,
    daily_routine: str,
    authorization: str | None = Header(default=None)
):
    user = get_current_user(authorization)

    try:
        from agents.health_agent import health_graph

        result = health_graph.invoke(
            {
                "user_name": user.name or "Player",
                "age": user.age or 25,
                "height": user.height or 170.0,
                "weight": user.weight or 65.0,
                "health_goal": user.health_goal or "Maintain health",
                "sleep_hours": sleep_hours,
                "food_details": food_details,
                "daily_calories": daily_calories,
                "exercise_minutes": exercise_minutes,
                "daily_routine": daily_routine
            }
        )

        return result

    except Exception as error:
        return {
            "message": "Health analysis completed with basic data",
            "user_id": user.id,
            "sleep_hours": sleep_hours,
            "daily_calories": daily_calories,
            "exercise_minutes": exercise_minutes,
            "error": str(error)
        }


# =========================================
# DEVELOPMENT RESET ALL
# =========================================

@app.delete("/dev/reset-all")
def reset_all_data():
    db = SessionLocal()

    try:
        db.query(FoodLog).delete()
        db.query(DailySchedule).delete()
        db.query(User).delete()
        db.commit()

        return {
            "message": "All AERIVA accounts, schedules, and food logs deleted successfully"
        }

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()
