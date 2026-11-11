import os
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv
from pydantic import BaseModel

# Load .env file
load_dotenv()

from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import base64
import uuid
import time
import io
from PIL import Image
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
    estimate_calories,
    search_indian_foods
)




# =========================================
# PATHS & STORAGE
# =========================================

BASE_DIR = Path(__file__).resolve().parent.parent

FRONTEND_DIR = BASE_DIR / "frontend"
UPLOADS_DIR = BASE_DIR / "uploads"
FOOD_IMAGES_DIR = UPLOADS_DIR / "food_images"
FOOD_IMAGES_DIR.mkdir(parents=True, exist_ok=True)


# =========================================
# FASTAPI
# =========================================

app = FastAPI(
    title="AERIVA AI",
    description="AI-powered health and lifestyle assistant",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================
# DATABASE & MIGRATIONS
# =========================================

Base.metadata.create_all(bind=engine)

def ensure_db_migrations():
    """Ensures food_logs has the image_url column in SQLite."""
    try:
        import sqlite3
        db_path = BASE_DIR / "database" / "aeriva.db"
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(food_logs)")
            cols = [r[1] for r in cursor.fetchall()]
            if "image_url" not in cols:
                cursor.execute("ALTER TABLE food_logs ADD COLUMN image_url VARCHAR")
                conn.commit()
            conn.close()
    except Exception as e:
        print("Database migration check note:", e)

ensure_db_migrations()


# =========================================
# 7-DAY FOOD IMAGE RETENTION CLEANUP
# =========================================

def cleanup_old_food_images(max_age_days: int = 7):
    """
    Cleans up food images older than max_age_days (1 week).
    Removes files from uploads/food_images/ and clears image_url in database.
    """
    try:
        cutoff_date = date.today() - timedelta(days=max_age_days)
        cutoff_seconds = time.time() - (max_age_days * 86400)

        # Clear expired references from database
        db = SessionLocal()
        try:
            old_logs = (
                db.query(FoodLog)
                .filter(FoodLog.log_date < cutoff_date, FoodLog.image_url.isnot(None))
                .all()
            )
            for item in old_logs:
                if item.image_url:
                    rel_path = item.image_url.lstrip("/")
                    target_file = BASE_DIR / rel_path
                    if target_file.exists() and target_file.is_file():
                        try:
                            target_file.unlink()
                        except Exception:
                            pass
                item.image_url = None
            if old_logs:
                db.commit()
        finally:
            db.close()

        # Delete any orphaned image files in FOOD_IMAGES_DIR older than 7 days
        if FOOD_IMAGES_DIR.exists():
            for f in FOOD_IMAGES_DIR.iterdir():
                if f.is_file() and not f.name.startswith("."):
                    stat = f.stat()
                    if stat.st_mtime < cutoff_seconds:
                        try:
                            f.unlink()
                        except Exception:
                            pass
    except Exception as err:
        print("Old food images cleanup note:", err)

# Auto cleanup images older than 7 days on startup
cleanup_old_food_images(7)


def save_food_image_file(image_bytes: bytes) -> str:
    """Saves image bytes to uploads/food_images and returns the relative URL."""
    FOOD_IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"food_{int(time.time())}_{uuid.uuid4().hex[:8]}.jpg"
    target_path = FOOD_IMAGES_DIR / filename

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")
        img.thumbnail((1600, 1600))
        img.save(target_path, format="JPEG", quality=85, optimize=True)
    except Exception:
        with open(target_path, "wb") as f:
            f.write(image_bytes)

    # Clean up older images (7-day retention)
    cleanup_old_food_images(max_age_days=7)

    return f"/uploads/food_images/{filename}"


# =========================================
# STATIC FILES
# =========================================

app.mount(
    "/static",
    StaticFiles(directory=str(FRONTEND_DIR)),
    name="static"
)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOADS_DIR)),
    name="uploads"
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
# GOOGLE SIGN-IN & AUTHENTICATION
# =========================================

class GoogleAuthRequest(BaseModel):
    id_token: str


@app.get("/auth/google/client-id")
def get_google_client_id():
    """Returns the Google Client ID configured in environment."""
    return {"client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip()}


@app.get("/auth/google/callback")
def google_callback_page():
    """Fallback handler for OAuth redirect callbacks."""
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.post("/auth/google")
def auth_google(req: GoogleAuthRequest):
    """
    Verifies Google ID token, registers new user or signs in existing user,
    and returns a valid AERIVA JWT access token.
    """
    import requests
    import secrets

    token_str = req.id_token.strip()
    if not token_str:
        raise HTTPException(status_code=400, detail="Missing Google ID token")

    # Verify ID token with Google's public tokeninfo service
    try:
        resp = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={token_str}",
            timeout=10.0
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid Google token")
        info = resp.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to verify Google token: {str(e)}")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain an email address")

    email = normalize_email(email)
    name = (info.get("name") or info.get("given_name") or "Google User").strip()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        is_new_user = False

        if not user:
            is_new_user = True
            random_pw = secrets.token_urlsafe(32)
            hashed_pw = hash_password(random_pw)
            user = User(
                name=name,
                email=email,
                password=hashed_pw,
                onboarding_completed=False
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_access_token({"sub": str(user.id)})

        return {
            "message": "Google authentication successful",
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "onboarding_completed": bool(user.onboarding_completed)
            },
            "onboarding_completed": bool(user.onboarding_completed),
            "is_new_user": is_new_user
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
            calories=calculated_calories,
            image_url=food.image_url
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
            "calories": calculated_calories,
            "image_url": food_log.image_url
        }

    finally:
        db.close()


# =========================================
# FOOD SEARCH & AUTOCOMPLETE
# =========================================

@app.get("/food/search")
def search_food(q: str = "", limit: int = 20):
    return {
        "query": q,
        "results": search_indian_foods(q, limit=limit)
    }


@app.get("/food/database")
def get_all_food_items():
    items = search_indian_foods("", limit=10)
    return {
        "count": len(items),
        "items": items
    }



# =========================================
# FOOD ESTIMATE
# =========================================

@app.post("/food/estimate")
def get_food_estimate(data: dict):
    food_name = str(data.get("food_name", "")).strip()
    quantity = float(data.get("quantity", 1.0))
    return estimate_calories(food_name, quantity)


# =========================================
# AI FOOD IMAGE SCANNING & VISION
# =========================================

@app.post("/food/upload-image")
async def upload_food_image(
    file: UploadFile = File(...),
    authorization: str | None = Header(default=None)
):
    """Directly uploads a food photo and stores it for up to 1 week."""
    user = get_current_user(authorization)
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")
    image_url = save_food_image_file(image_bytes)
    return {"image_url": image_url, "message": "Photo stored successfully for 7 days."}


@app.post("/food/scan-image")
async def scan_food_image(
    file: UploadFile = File(None),
    payload: dict = None
):
    from agents.food_agent import analyze_food_image_langgraph

    image_bytes = None
    mime_type = "image/jpeg"

    if file:
        image_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"
    elif payload and "image_base64" in payload:
        raw_b64 = str(payload["image_base64"])
        if "," in raw_b64:
            header, raw_b64 = raw_b64.split(",", 1)
            if "image/png" in header:
                mime_type = "image/png"
            elif "image/webp" in header:
                mime_type = "image/webp"
            elif "image/gif" in header:
                mime_type = "image/gif"
        try:
            image_bytes = base64.b64decode(raw_b64)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Please upload a food image or pass base64 image data")

    # Store the photo securely in uploads/food_images (retained for up to 1 week)
    saved_image_url = save_food_image_file(image_bytes)

    try:
        result = analyze_food_image_langgraph(image_bytes, mime_type=mime_type)
        result["image_url"] = saved_image_url
        result["is_recognized"] = True
        return result
    except Exception as e:
        print("Vision scan error details:", e)
        # Check if filename offers any helpful hint
        inferred_name = ""
        if file and file.filename:
            raw_fn = os.path.splitext(file.filename)[0].replace("_", " ").replace("-", " ")
            if not re.match(r"^(?:img|image|photo|screenshot|camera|\d+)", raw_fn.lower()):
                inferred_name = raw_fn.title()

        return {
            "food_name": inferred_name,
            "portion_description": "1 standard serving",
            "quantity": 1.0,
            "calories": 250.0 if inferred_name else 0.0,
            "macros": {"protein": 8.0, "carbs": 32.0, "fat": 9.0} if inferred_name else {"protein": 0.0, "carbs": 0.0, "fat": 0.0},
            "explanation": f"Photo saved to food logs. AI Vision Note: {str(e)}",
            "image_url": saved_image_url,
            "is_recognized": bool(inferred_name),
            "error_detail": str(e)
        }


# =========================================
# BATCH FOOD LOG
# =========================================

@app.post("/food/log/batch")
def log_food_batch(
    payload: dict,
    authorization: str | None = Header(default=None)
):
    user = get_current_user(authorization)
    items = payload.get("items", [])
    meal_type = payload.get("meal_type", "Snack")
    batch_image_url = payload.get("image_url") or None

    if not items:
        raise HTTPException(status_code=400, detail="No food items provided")

    db = SessionLocal()
    logged_records = []

    try:
        for idx, item in enumerate(items):
            name = str(item.get("food_name", "")).strip()
            if not name:
                continue
            qty = float(item.get("quantity", 1.0))
            item_image_url = item.get("image_url") or batch_image_url
            cal_data = estimate_calories(name, qty)
            cals = float(cal_data.get("calories", 0.0))

            food_log = FoodLog(
                user_id=user.id,
                log_date=date.today(),
                meal_type=meal_type,
                food_name=name,
                quantity=str(qty),
                calories=cals,
                image_url=item_image_url
            )
            db.add(food_log)
            db.flush()
            logged_records.append({
                "id": food_log.id,
                "log_date": str(food_log.log_date),
                "meal_type": food_log.meal_type,
                "food_name": food_log.food_name,
                "quantity": qty,
                "calories": cals,
                "image_url": food_log.image_url
            })

        db.commit()
        return {"logged": logged_records, "count": len(logged_records)}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# =========================================
# TODAY FOOD LOGS
# =========================================

@app.get("/food/log/today")
def get_today_food_logs(authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    cleanup_old_food_images(max_age_days=7)
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

        result = []
        for item in logs:
            qty = 1.0
            try:
                if item.quantity:
                    qty = float(item.quantity)
            except Exception:
                qty = 1.0
            result.append({
                "id": item.id,
                "log_date": str(item.log_date),
                "meal_type": item.meal_type,
                "food_name": item.food_name,
                "quantity": qty,
                "calories": float(item.calories) if item.calories is not None else 0.0,
                "image_url": item.image_url,
                "created_at": item.created_at.strftime("%I:%M %p") if item.created_at else ""
            })
        return result

    finally:
        db.close()


# =========================================
# 7-DAY (1 WEEK) FOOD & PHOTO HISTORY
# =========================================

@app.get("/food/log/week")
def get_week_food_logs(authorization: str | None = Header(default=None)):
    """
    Returns food logs and photos for up to 7 days (1 week).
    Automatically runs 7-day retention cleanup.
    """
    user = get_current_user(authorization)
    cleanup_old_food_images(max_age_days=7)

    today = date.today()
    start_date = today - timedelta(days=6)

    db = SessionLocal()
    try:
        logs = (
            db.query(FoodLog)
            .filter(
                FoodLog.user_id == user.id,
                FoodLog.log_date >= start_date,
                FoodLog.log_date <= today
            )
            .order_by(FoodLog.log_date.desc(), FoodLog.created_at.desc())
            .all()
        )

        # Build 7-day chronological buckets
        days_map = {}
        for d in range(7):
            cur_date = today - timedelta(days=d)
            d_str = str(cur_date)
            label = "Today" if d == 0 else ("Yesterday" if d == 1 else cur_date.strftime("%a, %b %d"))
            days_map[d_str] = {
                "date": d_str,
                "label": label,
                "total_calories": 0.0,
                "meals": []
            }

        for item in logs:
            d_str = str(item.log_date)
            if d_str in days_map:
                cals = float(item.calories) if item.calories is not None else 0.0
                days_map[d_str]["total_calories"] += cals
                qty = 1.0
                try:
                    if item.quantity:
                        qty = float(item.quantity)
                except Exception:
                    qty = 1.0
                days_map[d_str]["meals"].append({
                    "id": item.id,
                    "meal_type": item.meal_type,
                    "food_name": item.food_name,
                    "quantity": qty,
                    "calories": round(cals, 1),
                    "image_url": item.image_url,
                    "time": item.created_at.strftime("%I:%M %p") if item.created_at else ""
                })

        for d_str in days_map:
            days_map[d_str]["total_calories"] = round(days_map[d_str]["total_calories"])

        return {
            "retention": "Images are stored up to 1 week (7 days) and auto-purged.",
            "days": list(days_map.values())
        }
    finally:
        db.close()


# =========================================
# NEXT-DAY MEAL SUGGESTIONS BASED ON TODAY & YESTERDAY
# =========================================

@app.get("/food/suggestions/next-day")
def get_next_day_food_suggestions(authorization: str | None = Header(default=None)):
    user = None
    if authorization:
        try:
            user = get_current_user(authorization)
        except Exception:
            user = None

    db = SessionLocal()

    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    try:
        # 1. Fetch Today and Yesterday Food Logs
        today_logs = []
        yesterday_logs = []
        if user:
            today_logs = (
                db.query(FoodLog)
                .filter(FoodLog.user_id == user.id, FoodLog.log_date == today)
                .all()
            )
            yesterday_logs = (
                db.query(FoodLog)
                .filter(FoodLog.user_id == user.id, FoodLog.log_date == yesterday)
                .all()
            )

        today_calories = sum(float(l.calories or 0.0) for l in today_logs)
        yesterday_calories = sum(float(l.calories or 0.0) for l in yesterday_logs)

        today_foods = [l.food_name.lower() for l in today_logs]
        yesterday_foods = [l.food_name.lower() for l in yesterday_logs]
        all_recent_foods = today_foods + yesterday_foods

        # Calorie Baseline
        weight = float(user.weight or 68.0) if (user and user.weight) else 68.0
        goal = (user.health_goal or "Maintain weight").lower() if (user and user.health_goal) else "maintain weight"

        # Determine target daily calories based on user goal
        if "loss" in goal or "lose" in goal:
            base_target = 1600.0
        elif "gain" in goal or "muscle" in goal:
            base_target = 2200.0
        else:
            base_target = 1900.0

        # Try Groq AI dynamic meal planning based on 48h history
        from agents.food_agent import get_groq_llm
        groq_llm = get_groq_llm(model="openai/gpt-oss-120b", temperature=0.2)
        if groq_llm:
            try:
                import json as json_mod
                groq_prompt = (
                    "You are a clinical nutritionist specialized in Indian cuisine. "
                    f"User goal: {goal}, Weight: {weight}kg. Target calories: ~{base_target} kcal.\n"
                    f"Today's logged foods: {', '.join(today_foods) if today_foods else 'None logged yet'} (Total: {round(today_calories)} kcal)\n"
                    f"Yesterday's logged foods: {', '.join(yesterday_foods) if yesterday_foods else 'None logged yet'} (Total: {round(yesterday_calories)} kcal)\n"
                    "Synthesize a customized Next-Day Indian Meal Plan (Breakfast, Lunch, Snack, Dinner) specifically offsetting or balancing what they ate today and yesterday. "
                    "Output strictly valid JSON with no markdown and no extra text:\n"
                    "{\n"
                    '  "status": "3-5 word status title (e.g. Metabolic Reset & Detox / High-Protein Replenishment / Balanced Fiber Fueling)",\n'
                    '  "rationale": "2-3 sentences explaining exactly how tomorrow\'s menu balances today\'s and yesterday\'s logged meals",\n'
                    '  "meals": [\n'
                    '    {"meal_type": "Breakfast", "food_name": "...", "portion": "...", "calories": 250, "category": "...", "reason": "..."},\n'
                    '    {"meal_type": "Lunch", "food_name": "...", "portion": "...", "calories": 420, "category": "...", "reason": "..."},\n'
                    '    {"meal_type": "Snack", "food_name": "...", "portion": "...", "calories": 130, "category": "...", "reason": "..."},\n'
                    '    {"meal_type": "Dinner", "food_name": "...", "portion": "...", "calories": 320, "category": "...", "reason": "..."}\n'
                    '  ]\n'
                    "}"
                )
                groq_res = groq_llm.invoke(groq_prompt)
                groq_txt = groq_res.content.strip()
                if groq_txt.startswith("```"):
                    groq_txt = re.sub(r"^```(?:json)?\s*", "", groq_txt)
                    groq_txt = re.sub(r"\s*```$", "", groq_txt)
                parsed_plan = json_mod.loads(groq_txt)
                if "meals" in parsed_plan and len(parsed_plan["meals"]) >= 3:
                    total_rec = sum(float(m.get("calories", 0)) for m in parsed_plan["meals"])
                    return {
                        "target_date": str(tomorrow),
                        "status": parsed_plan.get("status", "Groq AI Personalized Plan"),
                        "rationale": parsed_plan.get("rationale", ""),
                        "today_calories": round(today_calories, 1),
                        "yesterday_calories": round(yesterday_calories, 1),
                        "today_meals_logged": len(today_logs),
                        "yesterday_meals_logged": len(yesterday_logs),
                        "total_recommended_calories": round(total_rec),
                        "meals": parsed_plan["meals"]
                    }
            except Exception as e:
                print("Groq next-day suggestion fallback to heuristics:", e)

        # Heuristic Pattern Analysis of Present and Before Day (when Groq key not set)
        is_heavy_eating = (today_calories > 2200) or (yesterday_calories > 2200) or ((today_calories + yesterday_calories) > 4200)
        is_low_protein = not any(any(k in f for k in ["egg", "paneer", "chicken", "dal", "chana", "sprout", "soya", "fish"]) for f in all_recent_foods)
        is_high_carb_fried = any(any(k in f for k in ["biryani", "samosa", "bhatura", "puri", "pakora", "fried", "burger", "pizza", "sweet", "jalebi"]) for f in all_recent_foods)
        is_light_eating = (today_calories > 0 and today_calories < 1300) and (yesterday_calories < 1300)


        # Plan Next-Day Meals dynamically based on past 2 days
        if is_heavy_eating or is_high_carb_fried:
            status = "Metabolic Reset & Detox"
            rationale = (
                f"Your intake over the past 48 hours (Today: {round(today_calories)} kcal, Yesterday: {round(yesterday_calories)} kcal) "
                "had higher caloric density or refined carbs. Tomorrow's plan focuses on light, high-fiber, and plant-based protein options "
                "to reset your digestion, reduce water retention, and stabilize insulin sensitivity."
            )
            meals = [
                {
                    "meal_type": "Breakfast",
                    "food_name": "Moong Dal Chilla & Mint Chutney",
                    "portion": "2 small chillas with fresh mint chutney & 1 cup Green Tea",
                    "calories": 240,
                    "category": "Healthy & Fitness",
                    "reason": "Rich in lean plant protein and complex fiber; gentle on morning digestion without heavy carbs."
                },
                {
                    "meal_type": "Lunch",
                    "food_name": "2 Multigrain Phulkas + Palak Dal + Kachumber Salad",
                    "portion": "2 phulkas, 1 bowl spinach toor dal, 1 large plate fresh cucumber-tomato salad",
                    "calories": 370,
                    "category": "Dals & Pulses",
                    "reason": "Provides iron, folate, and sustained fullness while balancing out past carbohydrate surplus."
                },
                {
                    "meal_type": "Snack",
                    "food_name": "Roasted Makhana & Tender Coconut Water",
                    "portion": "1 bowl lightly spiced fox nuts + 1 glass natural coconut water",
                    "calories": 135,
                    "category": "Healthy & Fitness",
                    "reason": "Zero trans fats, rich in potassium and electrolytes to flush excess sodium from recent meals."
                },
                {
                    "meal_type": "Dinner",
                    "food_name": "Vegetable Moong Dal Khichdi with Low-Fat Curd",
                    "portion": "1 bowl light khichdi cooked with carrots, beans & peas + 1 cup dahi",
                    "calories": 260,
                    "category": "Rice & Biryani",
                    "reason": "Ayurvedic gut-healing staple. High bioavailability and low glycemic impact for restful sleep."
                }
            ]
        elif is_low_protein:
            status = "High-Protein Replenishment"
            rationale = (
                f"Analysis of today ({round(today_calories)} kcal) and yesterday ({round(yesterday_calories)} kcal) showed limited protein sources. "
                "Tomorrow's menu incorporates lean protein across every meal to support muscle recovery, satiety, and metabolic rate."
            )
            meals = [
                {
                    "meal_type": "Breakfast",
                    "food_name": "Sprouts Salad with Boiled Eggs or Paneer",
                    "portion": "1 bowl sprouted moong with 2 boiled egg whites (or 60g raw paneer) & lemon",
                    "calories": 230,
                    "category": "Healthy & Fitness",
                    "reason": "Delivers 18g+ of bioavailable morning protein to jumpstart muscle repair and curb hunger pangs."
                },
                {
                    "meal_type": "Lunch",
                    "food_name": "Paneer Bhurji / Grilled Chicken with 2 Phulkas & Dal Tadka",
                    "portion": "1 bowl cottage cheese bhurji (or chicken curry), 2 phulkas, 1 cup yellow dal",
                    "calories": 480,
                    "category": "Veg Curries",
                    "reason": "High-protein powerhouse lunch maintaining steady amino acid delivery and sustained afternoon focus."
                },
                {
                    "meal_type": "Snack",
                    "food_name": "Boiled Peanut Chaat or Sattu Sharbat",
                    "portion": "1 small bowl tempered boiled peanuts with chopped onions & lime",
                    "calories": 160,
                    "category": "Healthy & Fitness",
                    "reason": "Slow-digesting plant protein and healthy unsaturated fats preventing late-evening cravings."
                },
                {
                    "meal_type": "Dinner",
                    "food_name": "Vegetable Clear Soup & 2 Moong Dal Chillas / Grilled Tikka",
                    "portion": "1 warm bowl broccoli-carrot broth + 2 chillas with curd",
                    "calories": 290,
                    "category": "Healthy & Fitness",
                    "reason": "Light, high-protein evening recovery meal ensuring peak nocturnal growth hormone release."
                }
            ]
        elif is_light_eating:
            status = "Nutrient Density & Energy Boost"
            rationale = (
                f"Your logged intake over the last 2 days (Today: {round(today_calories)} kcal, Yesterday: {round(yesterday_calories)} kcal) "
                "was lower than your body's maintenance needs. Tomorrow's plan provides wholesome, nutrient-dense Indian meals to replenish glycogen and energy."
            )
            meals = [
                {
                    "meal_type": "Breakfast",
                    "food_name": "Masala Dosa with Sambar & Coconut Chutney",
                    "portion": "1 golden dosa with potato filling, 1 cup sambar, 1 tablespoon chutney",
                    "calories": 330,
                    "category": "South Indian Breakfast",
                    "reason": "Balanced fermented carbs and lentils to replenish liver glycogen stores for daytime vitality."
                },
                {
                    "meal_type": "Lunch",
                    "food_name": "Steamed Basmati Rice with Rajma Masala & Cucumber Raita",
                    "portion": "1 cup rice, 1 hearty bowl slow-cooked rajma, 1 bowl cool cucumber raita",
                    "calories": 490,
                    "category": "Dals & Pulses",
                    "reason": "Complete amino acid profile (rice + kidney beans), high soluble fiber, and gut-healthy probiotics."
                },
                {
                    "meal_type": "Snack",
                    "food_name": "Mixed Seasonal Fruit Bowl & Almonds",
                    "portion": "1 bowl papaya, apple & pomegranate with 6-8 soaked almonds",
                    "calories": 160,
                    "category": "Healthy & Fitness",
                    "reason": "Packed with vitamin C, antioxidants, and healthy omega fatty acids."
                },
                {
                    "meal_type": "Dinner",
                    "food_name": "2 Methi Parathas with Paneer Bhurji & Yellow Moong Dal",
                    "portion": "2 soft parathas, 1 cup paneer bhurji, 1 cup light dal",
                    "calories": 420,
                    "category": "Breads & Rotis",
                    "reason": "Nutrient-dense comforting dinner promoting restorative deep sleep."
                }
            ]
        else:
            status = "Optimal Balanced Nutrition"
            rationale = (
                f"Your nutrition over the present day ({round(today_calories)} kcal) and yesterday ({round(yesterday_calories)} kcal) "
                f"is on a steady trajectory. Tomorrow's curated Indian menu maintains healthy macro balance, consistent energy, and steady metabolic burn."
            )
            meals = [
                {
                    "meal_type": "Breakfast",
                    "food_name": "Vegetable Poha or 2 Idlis with Sambar",
                    "portion": "1 bowl flattened rice with peanuts, curry leaves & lime (or 2 idlis with sambar)",
                    "calories": 220,
                    "category": "South Indian Breakfast",
                    "reason": "Probiotic fermentation / iron-fortified poha offering easy digestibility and sustained morning glucose."
                },
                {
                    "meal_type": "Lunch",
                    "food_name": "2 Whole Wheat Rotis + Dal Tadka + Bhindi Masala + Curd",
                    "portion": "2 rotis, 1 cup tempered dal, 1 bowl spiced okra, 1 cup fresh dahi",
                    "calories": 430,
                    "category": "Veg Curries",
                    "reason": "Classic Indian thali balance: complex carbohydrates, plant protein, dietary fiber, and active digestive cultures."
                },
                {
                    "meal_type": "Snack",
                    "food_name": "Chaas (Spiced Buttermilk) & Roasted Makhana",
                    "portion": "1 tall glass mint-cumin buttermilk + 1 small bowl roasted lotus seeds",
                    "calories": 120,
                    "category": "Beverages & Drinks",
                    "reason": "Cooling beverage that beats afternoon fatigue without sugary calorie spikes."
                },
                {
                    "meal_type": "Dinner",
                    "food_name": "Moong Dal Khichdi or 2 Phulkas with Mix Veg Curry",
                    "portion": "1 bowl light khichdi with 1 spoon ghee (or 2 phulkas with seasonal sabzi)",
                    "calories": 310,
                    "category": "Rice & Biryani",
                    "reason": "Warm, light, wholesome dinner allowing your body to transition seamlessly into recovery."
                }
            ]

        total_recommended_cals = sum(m["calories"] for m in meals)

        return {
            "target_date": str(tomorrow),
            "status": status,
            "rationale": rationale,
            "today_calories": round(today_calories, 1),
            "yesterday_calories": round(yesterday_calories, 1),
            "today_meals_logged": len(today_logs),
            "yesterday_meals_logged": len(yesterday_logs),
            "total_recommended_calories": total_recommended_cals,
            "meals": meals
        }

    finally:
        db.close()


# =========================================
# SMART EXERCISE & FREE-TIME WORKOUT RECOMMENDATION
# =========================================

@app.post("/exercise/recommend")
def get_exercise_recommendation(
    payload: dict,
    authorization: str | None = Header(default=None)
):
    user = None
    if authorization:
        try:
            user = get_current_user(authorization)
        except Exception:
            user = None

    db = SessionLocal()

    steps = int(payload.get("steps", 0))
    calories_input = payload.get("daily_calories")

    try:
        # 1. Calculate calories consumed today if not passed
        if calories_input is None:
            if user:
                today_logs = (
                    db.query(FoodLog)
                    .filter(FoodLog.user_id == user.id, FoodLog.log_date == date.today())
                    .all()
                )
                daily_calories = sum(float(l.calories or 0.0) for l in today_logs)
            else:
                daily_calories = 610.0
        else:
            daily_calories = float(calories_input)

        # 2. User metrics & Basal Metabolic Rate
        weight_kg = float(user.weight or 68.0) if (user and user.weight) else 68.0
        height_cm = float(user.height or 172.0) if (user and user.height) else 172.0
        age = int(user.age or 25) if (user and user.age) else 25
        goal = str(user.health_goal or "Maintain health").lower() if (user and user.health_goal) else "maintain health"

        # Mifflin-St Jeor Basal Metabolic Rate estimate
        bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
        tdee_sedentary = bmr * 1.25

        # Calories burned through steps (approx 0.04 kcal per step)
        step_burn = round(steps * 0.04, 1)

        # Net balance: food consumed minus maintenance baseline and step burn
        net_calorie_balance = round(daily_calories - (tdee_sedentary + step_burn), 1)

        # 3. Schedule Check for Free Time Window Today
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        today_weekday = days[date.today().weekday()]

        schedule = None
        if user:
            schedule = (
                db.query(DailySchedule)
                .filter(
                    DailySchedule.user_id == user.id,
                    DailySchedule.day_of_week.ilike(today_weekday)
                )
                .first()
            )

        free_start = schedule.free_start_time if schedule and schedule.free_start_time else "17:30"
        free_end = schedule.free_end_time if schedule and schedule.free_end_time else "18:30"

        # Calculate free time window duration in minutes
        try:
            sh, sm = map(int, free_start.split(":"))
            eh, em = map(int, free_end.split(":"))
            total_free_mins = (eh * 60 + em) - (sh * 60 + sm)
            if total_free_mins <= 0:
                total_free_mins = 60
        except Exception:
            total_free_mins = 60

        # 4. Tailor Exercise Time & Routines Based on Food & Steps
        # Higher calorie surplus or low step count demands higher intensity workout
        if daily_calories > 2100 or net_calorie_balance > 250 or (steps < 4000 and daily_calories > 1500):
            needed_burn = 280
            # Target 35-40 mins, but capped at available free time
            recommended_mins = min(max(30, total_free_mins - 10), 40)
            workout_title = "Metabolic Fat-Burn & Calisthenics Circuit"
            intensity = "High"
            desc = (
                f"You consumed {round(daily_calories)} kcal today with {steps:,} steps walked (~{round(step_burn)} kcal burned). "
                f"To offset the net surplus and accelerate lipid oxidation, dedicate {recommended_mins} minutes during your free window."
            )
            exercises = [
                {
                    "name": "Dynamic Warmup & Arm Circles",
                    "key": "warmup",
                    "duration": "3 mins",
                    "reps": "Continuous movement",
                    "target_muscles": "Shoulders, Upper Back & Chest",
                    "instructions": [
                        "Stand upright with feet shoulder-width apart and extend arms straight out to sides.",
                        "Make controlled circular motions with arms, gradually increasing circle size for 30s.",
                        "Reverse circle direction, then add gentle torso rotations to awaken your spine."
                    ]
                },
                {
                    "name": "Jumping Jacks & High Knees",
                    "key": "jumping_jacks",
                    "duration": "8 mins",
                    "reps": "4 sets × 45s work / 15s rest",
                    "target_muscles": "Full Body Cardio & Calves",
                    "instructions": [
                        "Start with feet together and arms at sides. Jump feet wide while bringing arms overhead.",
                        "Land softly on the balls of your feet and immediately jump back to starting position.",
                        "Switch to high knees: drive knees upward alternately toward chest at a rapid pace."
                    ]
                },
                {
                    "name": "Bodyweight Air Squats & Alternating Lunges",
                    "key": "squats",
                    "duration": "10 mins",
                    "reps": "4 sets × 15 reps each",
                    "target_muscles": "Quadriceps, Glutes & Hamstrings",
                    "instructions": [
                        "Stand with feet shoulder-width apart, chest upright, and toes pointed slightly out.",
                        "Hinge hips backward and bend knees until thighs are at least parallel to floor.",
                        "Drive through heels to stand. Step forward into a lunge, bending both knees to 90 degrees."
                    ]
                },
                {
                    "name": "Mountain Climbers & Push-Ups",
                    "key": "pushups",
                    "duration": "8 mins",
                    "reps": "3 sets × 12 reps",
                    "target_muscles": "Chest, Triceps & Core",
                    "instructions": [
                        "Assume a high plank position with wrists directly under shoulders and body straight.",
                        "Drive one knee toward chest and switch legs rapidly in a rhythmic running cadence.",
                        "For push-ups: lower chest until 2 inches from floor, elbows at 45°, then press up explosively."
                    ]
                },
                {
                    "name": "Forearm Plank Holds",
                    "key": "plank",
                    "duration": "4 mins",
                    "reps": "3 sets × 45s hold",
                    "target_muscles": "Deep Abdominal Wall & Lower Back",
                    "instructions": [
                        "Rest forearms on the floor with elbows directly under shoulders, hands separated.",
                        "Extend legs back, tuck pelvis slightly, and brace your core as if anticipating impact.",
                        "Maintain a continuous straight line from crown of head to heels without sagging hips."
                    ]
                },
                {
                    "name": "Full Body Hamstring & Quad Stretch",
                    "key": "stretching",
                    "duration": "3 mins",
                    "reps": "Cool-down recovery",
                    "target_muscles": "Hamstrings, Quads & Lower Back",
                    "instructions": [
                        "Stand tall, bend one knee and grasp ankle behind you to stretch front of thigh for 30s.",
                        "Extend one heel forward, hinge at the waist, and reach toward toes to stretch hamstring.",
                        "Breathe deeply and smoothly to allow muscle fibers to relax and recover."
                    ]
                }
            ]
        elif steps >= 10000 or (daily_calories < 1400 and daily_calories > 0):
            needed_burn = 140
            recommended_mins = min(20, total_free_mins)
            workout_title = "Active Recovery, Mobility & Core Flow"
            intensity = "Low - Moderate"
            desc = (
                f"Fantastic daily activity! You logged {steps:,} steps (~{round(step_burn)} kcal burned) and kept nutrition balanced. "
                f"A gentle {recommended_mins}-minute mobility and core routine during your free window will flush lactic acid and protect posture."
            )
            exercises = [
                {
                    "name": "Cat-Cow & Spine Decompression",
                    "key": "cat_cow",
                    "duration": "4 mins",
                    "reps": "Controlled breathing",
                    "target_muscles": "Erector Spinae & Thoracic Mobility",
                    "instructions": [
                        "Begin on all fours in tabletop position, wrists under shoulders and knees under hips.",
                        "Inhale: Drop your belly toward the mat, lift your chest, chin, and tailbone (Cow Pose).",
                        "Exhale: Pull your navel firmly to your spine, rounding back toward ceiling and tucking chin (Cat Pose)."
                    ]
                },
                {
                    "name": "Surya Namaskar (Sun Salutations)",
                    "key": "surya_namaskar",
                    "duration": "8 mins",
                    "reps": "6 slow rounds",
                    "target_muscles": "Full Body Mobility & Core",
                    "instructions": [
                        "Stand tall with palms joined in prayer position at chest (Pranamasana).",
                        "Inhale: Raise arms overhead and gently arch backward (Hastauttanasana).",
                        "Exhale: Fold forward from hips to touch feet, flowing through plank, cobra, and downward dog."
                    ]
                },
                {
                    "name": "Glute Bridges & Bird-Dog Core",
                    "key": "glute_bridge",
                    "duration": "5 mins",
                    "reps": "3 sets × 12 reps",
                    "target_muscles": "Gluteus Maximus, Hamstrings & Core",
                    "instructions": [
                        "Lie on your back with knees bent and feet flat on the floor hip-width apart.",
                        "Drive through heels to lift hips until thighs and torso align; squeeze glutes at the top for 2s.",
                        "For Bird-Dog: on all fours, simultaneously extend right arm forward and left leg backward."
                    ]
                },
                {
                    "name": "Child's Pose & Deep Hip Openers",
                    "key": "child_pose",
                    "duration": "3 mins",
                    "reps": "Restorative stretches",
                    "target_muscles": "Hips, Groin & Latissimus",
                    "instructions": [
                        "Kneel on the floor with big toes touching, spreading your knees wide apart.",
                        "Lower your hips all the way back onto your heels and fold torso forward between thighs.",
                        "Extend arms out on floor in front of you, rest forehead down, and take slow calming breaths."
                    ]
                }
            ]
        else:
            needed_burn = 210
            recommended_mins = min(max(25, total_free_mins - 15), 30)
            workout_title = "Cardio-Strength Interval Power Session"
            intensity = "Moderate"
            desc = (
                f"You logged {round(daily_calories)} kcal and {steps:,} steps (~{round(step_burn)} kcal burned). "
                f"Completing this {recommended_mins}-minute session during your free window ({free_start} – {free_end}) keeps your metabolism firing at peak efficiency."
            )
            exercises = [
                {
                    "name": "Brisk Pace Warmup & Torso Twists",
                    "key": "warmup",
                    "duration": "3 mins",
                    "reps": "Warmup",
                    "target_muscles": "Spine Rotators & Dynamic Joints",
                    "instructions": [
                        "March briskly in place, swinging arms to increase blood circulation and body temperature.",
                        "Plant feet shoulder-width and gently rotate torso left and right with relaxed arms."
                    ]
                },
                {
                    "name": "Bodyweight Squats to Overhead Reach",
                    "key": "squats",
                    "duration": "7 mins",
                    "reps": "3 sets × 15 reps",
                    "target_muscles": "Legs, Glutes & Shoulders",
                    "instructions": [
                        "Lower into a steady squat, keeping knees behind toes and chest lifted.",
                        "As you push back up to standing, extend both arms straight overhead toward the sky."
                    ]
                },
                {
                    "name": "Incline Push-Ups / Knee Push-Ups",
                    "key": "pushups",
                    "duration": "6 mins",
                    "reps": "3 sets × 10 reps",
                    "target_muscles": "Pectorals & Triceps",
                    "instructions": [
                        "Place hands on an elevated ledge or keep knees grounded to maintain strict horizontal posture.",
                        "Lower chest with control until elbows form a 90° angle, then push back to starting extension."
                    ]
                },
                {
                    "name": "Brisk Walk-Jog Intervals or Skipping",
                    "key": "jumping_jacks",
                    "duration": "8 mins",
                    "reps": "30s sprint / 30s walk",
                    "target_muscles": "Cardiovascular Endurance & Calves",
                    "instructions": [
                        "Alternate between 30 seconds of high-intensity jogging or skipping and 30 seconds of brisk walking.",
                        "Maintain a steady rhythmic breath and land softly on the balls of your feet."
                    ]
                },
                {
                    "name": "Full Body Spine & Shoulder Release",
                    "key": "stretching",
                    "duration": "3 mins",
                    "reps": "Cool-down",
                    "target_muscles": "Full Body Posterior Chain",
                    "instructions": [
                        "Interlace fingers and stretch arms upward, taking deep diaphragmatic inhales.",
                        "Bend softly from side to side to elongate the ribcage and decompress spine."
                    ]
                }
            ]

        # Calculate exact free time schedule window
        try:
            sh, sm = map(int, free_start.split(":"))
            end_minutes = sm + recommended_mins
            workout_end_h = sh + (end_minutes // 60)
            workout_end_m = end_minutes % 60
            exercise_slot = f"{free_start} – {str(workout_end_h).zfill(2)}:{str(workout_end_m).zfill(2)}"
        except Exception:
            exercise_slot = f"{free_start} ({recommended_mins} mins)"

        return {
            "recommended_duration_minutes": recommended_mins,
            "target_calories_to_burn": needed_burn,
            "intensity": intensity,
            "workout_name": workout_title,
            "free_time_slot": exercise_slot,
            "full_free_window": f"{free_start} – {free_end}",
            "description": desc,
            "daily_calories": round(daily_calories),
            "steps_walked": steps,
            "steps_calories_burned": round(step_burn),
            "net_calorie_balance": round(net_calorie_balance),
            "exercises": exercises
        }

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
# AI HEALTH PRECAUTIONS & LIVE SHIELD
# =========================================

@app.get("/health/precautions")
def get_health_precautions(
    steps: int = 0,
    exercise_minutes: int = 0,
    authorization: str | None = Header(default=None)
):
    user = get_current_user(authorization)
    db = SessionLocal()

    try:
        from datetime import datetime, time

        today = date.today()
        # 1. Fetch today's food logs
        food_logs = (
            db.query(FoodLog)
            .filter(FoodLog.user_id == user.id, FoodLog.log_date == today)
            .all()
        )

        total_cals = sum([float(f.calories or 0.0) for f in food_logs])
        logged_meals = set([f.meal_type.lower() for f in food_logs if f.meal_type])
        has_junk = any([bool(f.is_junk) for f in food_logs])

        # 2. Fetch user's schedule for today
        day_name = today.strftime("%A")
        schedule = (
            db.query(DailySchedule)
            .filter(
                DailySchedule.user_id == user.id,
                DailySchedule.day_of_week.ilike(day_name)
            )
            .first()
        )
        if not schedule:
            schedule = db.query(DailySchedule).filter(DailySchedule.user_id == user.id).first()

        now = datetime.now()
        current_hour = now.hour + (now.minute / 60.0)

        # ---------------------------------------------
        # A. FOOD / NUTRITION PRECAUTIONS
        # ---------------------------------------------
        food_status = "OPTIMAL"
        food_badge = "PROPER FOOD & BALANCED FUEL"
        food_color = "#10B981"
        food_icon = "🥗"
        food_msg = "Your nutrition logs indicate consistent, healthy fueling today."
        food_rec = "Keep maintaining regular meal intervals and stay well hydrated with water."
        food_action = "+ LOG MEAL"

        missing_meals = []
        if current_hour >= 11.5 and "breakfast" not in logged_meals:
            missing_meals.append("Breakfast")
        if current_hour >= 15.5 and "lunch" not in logged_meals:
            missing_meals.append("Lunch")
        if current_hour >= 21.0 and "dinner" not in logged_meals:
            missing_meals.append("Dinner")

        if len(food_logs) == 0:
            food_status = "CRITICAL"
            food_badge = "NO FOOD LOGGED TODAY"
            food_color = "#EF4444"
            food_icon = "⚠️"
            food_msg = "You have not logged any meals today! Skipping food leads to acute hypoglycemia, cognitive fog, and metabolic slowdown."
            food_rec = "Eat a balanced meal containing complex carbs, lean protein (dal, paneer, eggs), and fresh vegetables right now."
            food_action = "+ LOG MEAL NOW"
        elif len(missing_meals) > 0:
            food_status = "WARNING"
            food_badge = f"MISSED {', '.join(missing_meals).upper()}"
            food_color = "#F59E0B"
            food_icon = "⚠️"
            food_msg = f"You appear to have missed your regular {', '.join(missing_meals)}! Irregular meal timing causes energy dips and digestive stress."
            food_rec = f"Prioritize having your {missing_meals[0]} immediately. Do not substitute meals with caffeine or sugary snacks."
            food_action = f"+ LOG {missing_meals[0].upper()}"
        elif total_cals < 800 and current_hour >= 16.0:
            food_status = "WARNING"
            food_badge = "SEVERE CALORIE DEFICIT"
            food_color = "#F59E0B"
            food_icon = "⚠️"
            food_msg = f"Your logged intake is only {int(total_cals)} kcal so far. Under-fueling puts stress on your nervous system and causes muscle breakdown."
            food_rec = "Add nutrient-dense whole foods like nuts, curd, lentils, and bananas to safely meet your daily energy floor."
            food_action = "+ ADD NOURISHING FOOD"
        elif has_junk:
            food_status = "CAUTION"
            food_badge = "JUNK FOOD NEUTRALIZATION NEEDED"
            food_color = "#F59E0B"
            food_icon = "🍟"
            food_msg = "You logged high-oil or processed items today. High sodium and trans fats can trigger inflammation and lethargy."
            food_rec = "Drink 2 extra glasses of water, consume antioxidant-rich green tea or cucumber slices, and keep dinner light and fiber-rich."
            food_action = "+ LOG HEALTHY MEAL"

        # ---------------------------------------------
        # B. REST & SLEEP PRECAUTIONS
        # ---------------------------------------------
        rest_status = "OPTIMAL"
        rest_badge = "REST & SLEEP ON TRACK"
        rest_color = "#10B981"
        rest_icon = "🌙"
        rest_msg = "Your routine schedule provides adequate sleep and recovery periods."
        rest_rec = "Maintain a consistent sleep window and avoid stimulating screens 30 minutes before sleep."
        rest_action = "VIEW ROUTINE"

        sleep_duration = 8.0
        if schedule and schedule.wake_up_time and schedule.sleep_time:
            try:
                wt_parts = [int(p) for p in schedule.wake_up_time.split(":")[:2]]
                st_parts = [int(p) for p in schedule.sleep_time.split(":")[:2]]
                wake_dec = wt_parts[0] + (wt_parts[1] / 60.0)
                sleep_dec = st_parts[0] + (st_parts[1] / 60.0)
                if wake_dec <= sleep_dec:
                    sleep_duration = (24.0 - sleep_dec) + wake_dec
                else:
                    sleep_duration = wake_dec - sleep_dec
            except Exception:
                sleep_duration = 8.0

        if sleep_duration < 6.5:
            rest_status = "CRITICAL"
            rest_badge = f"SEVERE SLEEP DEFICIT ({round(sleep_duration, 1)} HRS)"
            rest_color = "#EF4444"
            rest_icon = "🛑"
            rest_msg = f"Your daily schedule allocates only {round(sleep_duration, 1)} hours of sleep. Chronic sleep restriction impairs insulin sensitivity, heart health, and mental acuity."
            rest_rec = "Adjust your bedtime at least 60 minutes earlier. Adults require a minimum of 7 to 8 hours of uninterrupted rest."
            rest_action = "ADJUST SLEEP SCHEDULE"
        elif sleep_duration < 7.5:
            rest_status = "CAUTION"
            rest_badge = f"BORDERLINE REST ({round(sleep_duration, 1)} HRS)"
            rest_color = "#F59E0B"
            rest_icon = "🌙"
            rest_msg = f"You are averaging {round(sleep_duration, 1)} hours of rest. While functional, it is on the low end for optimal muscle and cognitive recovery."
            rest_rec = "Plan a 20-minute mid-day power rest or wind down 30 minutes earlier tonight."
            rest_action = "OPTIMIZE ROUTINE"

        # Check late-night active status
        if current_hour >= 23.5 or current_hour < 4.5:
            rest_status = "WARNING"
            rest_badge = "LATE NIGHT SCREEN HAZARD"
            rest_color = "#EF4444"
            rest_icon = "💤"
            rest_msg = "It is past midnight! Using digital devices right now suppresses melatonin production and damages deep REM sleep architecture."
            rest_rec = "Shut down screens, turn off blue light, practice slow 4-7-8 breathing, and go to sleep immediately."
            rest_action = "ENABLE SLEEP MODE"

        # ---------------------------------------------
        # C. EXERCISE & ACTIVITY PRECAUTIONS
        # ---------------------------------------------
        ex_status = "OPTIMAL"
        ex_badge = "ACTIVE & MOVING WELL"
        ex_color = "#10B981"
        ex_icon = "⚡"
        ex_msg = "Great movement today! Physical activity is protecting your metabolic rate and cardiovascular endurance."
        ex_rec = "Do post-workout static stretches and maintain adequate hydration with electrolytes."
        ex_action = "VIEW EXERCISES"

        if steps < 2500 and exercise_minutes == 0 and current_hour >= 15.0:
            ex_status = "CRITICAL"
            ex_badge = "SEDENTARY DANGER ALERT"
            ex_color = "#EF4444"
            ex_icon = "⚠️"
            ex_msg = f"You have only walked {steps} steps and logged 0 exercise minutes today. Prolonged sitting causes vascular stiffness, low back pain, and energy stagnation."
            ex_rec = "Stand up right now! Complete a 15-minute brisk walk or execute 2 rounds of our guided mobility exercises."
            ex_action = "START 10-MIN WORKOUT"
        elif steps < 5000 and exercise_minutes < 15 and current_hour >= 18.0:
            ex_status = "WARNING"
            ex_badge = "EXERCISE DEFICIT"
            ex_color = "#F59E0B"
            ex_icon = "⚡"
            ex_msg = f"Your daily activity is lagging ({steps} steps, {exercise_minutes} active mins). Daily movement is crucial for burning glucose and reducing stress hormones."
            ex_rec = "Complete at least one short exercise session (Surya Namaskar or Glute Bridges) before dinner."
            ex_action = "START WORKOUT QUEST"
        elif steps < 6000 and current_hour < 15.0:
            ex_status = "CAUTION"
            ex_badge = "MID-DAY MOVEMENT NEEDED"
            ex_color = "#38BDF8"
            ex_icon = "🚶"
            ex_msg = f"You have logged {steps} steps so far. Aim to take micro-walk breaks during work to reach your 10,000 steps goal."
            ex_rec = "Take a 5-minute walk break every 60 minutes of sitting."
            ex_action = "LOG STEPS"

        # ---------------------------------------------
        # OVERALL SHIELD SUMMARY
        # ---------------------------------------------
        overall_severity = "HEALTHY"
        overall_score = 92
        if "CRITICAL" in [food_status, rest_status, ex_status]:
            overall_severity = "CRITICAL"
            overall_score = 52
            overall_title = "CRITICAL HEALTH PRECAUTIONS DETECTED"
            overall_summary = "AI Health Monitor identified urgent gaps in your daily regimen. Immediate attention required on food intake, sleep, or physical activity."
        elif "WARNING" in [food_status, rest_status, ex_status] or "CAUTION" in [food_status, rest_status, ex_status]:
            overall_severity = "CAUTION"
            overall_score = 72
            overall_title = "ACTIONABLE HEALTH PRECAUTIONS"
            overall_summary = "Your daily habits are moderately steady, but AI detected precautions regarding meals, rest, or movement that should be addressed today."
        else:
            overall_title = "ALL HEALTH SHIELDS OPTIMAL"
            overall_summary = "Exceptional balance across nutrition, sleep schedule, and physical activity today. Keep up this championship routine!"

        action_bullets = []
        if food_status != "OPTIMAL":
            action_bullets.append(food_rec)
        if rest_status != "OPTIMAL":
            action_bullets.append(rest_rec)
        if ex_status != "OPTIMAL":
            action_bullets.append(ex_rec)
        if not action_bullets:
            action_bullets.append("Stay hydrated with 2.5-3L water today.")
            action_bullets.append("Keep consistent with your sleep and wake schedule.")

        return {
            "overall_severity": overall_severity,
            "overall_score": overall_score,
            "overall_title": overall_title,
            "overall_summary": overall_summary,
            "food": {
                "status": food_status,
                "badge": food_badge,
                "icon": food_icon,
                "color": food_color,
                "message": food_msg,
                "recommendation": food_rec,
                "action_label": food_action
            },
            "rest": {
                "status": rest_status,
                "badge": rest_badge,
                "icon": rest_icon,
                "color": rest_color,
                "message": rest_msg,
                "recommendation": rest_rec,
                "action_label": rest_action
            },
            "exercise": {
                "status": ex_status,
                "badge": ex_badge,
                "icon": ex_icon,
                "color": ex_color,
                "message": ex_msg,
                "recommendation": ex_rec,
                "action_label": ex_action
            },
            "action_bullets": action_bullets
        }

    except Exception as e:
        print("Error calculating precautions:", e)
        return {
            "overall_severity": "CAUTION",
            "overall_score": 75,
            "overall_title": "AI HEALTH PRECAUTIONS MONITOR",
            "overall_summary": "Make sure to take proper balanced food, get 7-8 hours of sleep, and engage in daily physical exercise.",
            "food": {
                "status": "WARNING",
                "badge": "EAT PROPER MEALS",
                "icon": "🥗",
                "color": "#F59E0B",
                "message": "Do not skip meals. Ensure you take nutritious breakfast, lunch, and dinner.",
                "recommendation": "Fuel with balanced Indian meals rich in fiber, dal, vegetables, and complex grains.",
                "action_label": "+ LOG MEAL"
            },
            "rest": {
                "status": "CAUTION",
                "badge": "MAINTAIN PROPER REST",
                "icon": "🌙",
                "color": "#F59E0B",
                "message": "Adequate sleep (7-8 hours) is vital for your immune system and recovery.",
                "recommendation": "Avoid late night screens and sleep at a consistent hour.",
                "action_label": "VIEW ROUTINE"
            },
            "exercise": {
                "status": "WARNING",
                "badge": "DAILY EXERCISE NEEDED",
                "icon": "⚡",
                "color": "#38BDF8",
                "message": "Sedentary routine harms posture and heart health. Ensure regular movement.",
                "recommendation": "Complete at least 20-30 minutes of physical exercise or 8,000 steps today.",
                "action_label": "START EXERCISE"
            },
            "action_bullets": [
                "Take proper balanced food on time",
                "Get 7-8 hours of deep restful sleep",
                "Engage in 20+ minutes of physical activity or walking"
            ]
        }
    finally:
        db.close()


# =========================================
# AERIVA AI COPILOT CHATBOT
# =========================================

class ChatAssistantRequest(BaseModel):
    message: str
    history: list[dict] | None = None
    is_auth_screen: bool | None = False


AERIVA_SYSTEM_PROMPT = """You are AERIVA, the intelligent, friendly, and knowledgeable AI health assistant and platform copilot for the "AERIVA AI — Smart Health & Lifestyle Dashboard".
Your visual appearance is a cute, friendly white robot with a green sprout leaf on top, smiling curved cyan digital eyes, an "A" emblem with a pulse heartbeat on your chest, and a glowing cyan/purple halo aura.

Your primary mission is to:
1. Explain how to use every single feature of the AERIVA webpage from first to last in simple, encouraging, actionable terms.
2. Provide personalized guidance for diet, routine tracking, water, steps, workouts, and precautions.
3. Help users navigate and get the maximum benefit from the platform.

### COMPREHENSIVE PLATFORM KNOWLEDGE:

1. TOP HUD (Header):
   - Brand & Welcome: Shows your name and greeting.
   - Corner Dashboard Switcher (Top Left): Quick number buttons (1 - Daily Routine, 2 - What To Do, 3 - Precautions) to switch between all 3 main dashboards instantly.
   - Level & XP Meter: Earn XP by logging meals (+15 XP), drinking water (+5 XP), logging steps (+15 XP), and completing workouts (+25 XP). Level increases as your XP bar fills!
   - Live Digital Clock: Real-time clock with green status beacon.
   - Red Logout Button (Top Right): Power button in red to log out safely.
   - Health Score & Energy Battery:
     * Health Score (Radial gauge, 0-100%): Evaluates your meal consistency, sleep duration, and movement.
     * Energy Level (Battery meter, 0-100%): Measures hydration, calorie balance, and activity levels.

2. DASHBOARD 1: DAILY ROUTINE (Tab 1):
   - Schedule Timeline: Shows your 7-day weekly schedule with Wake-Up, Breakfast, Lunch, Snack, Dinner, Work hours, Free/Rest time, and Sleep. Click "Edit Routine" to customize your schedule.
   - What Food We Eat (Food Log):
     * "+ LOG A MEAL": Opens multi-item meal logger.
     * AI Food Photo Scanner: Click "📷 SCAN FOOD PHOTO" or upload any meal photo. Multimodal Groq Vision AI detects the dish name, portions, calories, and macros, and breaks down multi-component platters (e.g. Poori Chana with Halwa, Biryani, Dosa).
     * 7-Day Photo History: Click "📸 7-DAY PHOTO HISTORY" to view all past meals and photos saved for up to 1 week.
   - Step Tracker: 10,000 daily step goal with distance in km and calories burned. Click "+ LOG STEPS" to adjust steps.
   - Water Tracker: 2,500 ml daily goal. Click the water glasses (+250 ml each) to log hydration.

3. DASHBOARD 2: WHAT TO DO (Tab 2):
   - Personalized Workout Prescription: Dynamically calculates required exercise duration and intensity based on today's calorie intake and step count.
   - Interactive Exercise Mode: Click "⚡ START EXERCISE MODE" to open a step-by-step popup guide with animated visual exercise illustrations, target muscles, reps/duration, voice/timer guide, and completion reward (+25 XP).
   - Curated routines: Surya Namaskar, Cat-Cow Spine Decompression, Glute Bridges & Bird-Dog Core, Plank.

4. DASHBOARD 3: PRECAUTIONS & GUIDANCE (Tab 3):
   - AI Health Safety Shield: Real-time clinical risk monitor detecting whether you are eating proper food, getting adequate rest, and maintaining daily movement. Statuses: OPTIMAL (Green), CAUTION (Amber), CRITICAL (Red).
   - 3 Precaution Pillars:
     * 🥗 Food & Nutrition Precaution: Warns if breakfast, lunch, or dinner was missed, or if calorie intake is too low.
     * 🌙 Rest & Recovery Precaution: Warns if routine sleep is under 7 hours or if screen time is occurring late at night past bedtime.
     * ⚡ Physical Exercise Precaution: Warns if steps are under 3,500 and zero workouts are logged.
   - Essential Precaution Checklist: Actionable daily summary bullets.
   - Next-Day Meal Suggestions (According to Today): Formulates tomorrow's curated 4-meal menu (Breakfast, Lunch, Snack, Dinner) balanced specifically against today's logged food!

### INTERACTIVE ACTIONS YOU CAN EMBED:
Whenever relevant, you can include interactive action tags in your response that the UI renders as instant clickable buttons for the user:
- [action:focus_login|🔐 SIGN IN TO ACCOUNT]
- [action:switch_register|✨ CREATE NEW ACCOUNT]
- [action:open_food|📷 SCAN FOOD WITH CAMERA]
- [action:open_steps|👟 LOG STEPS]
- [action:open_routine|⚙️ EDIT SCHEDULE]
- [action:open_exercise|🏃 START EXERCISE MODE]
- [action:tab_routine|📋 GO TO DASHBOARD 1]
- [action:tab_fitness|⚡ GO TO DASHBOARD 2]
- [action:tab_precautions|🛡️ GO TO DASHBOARD 3]

### CRITICAL DISPLAY & FORMATTING RULES FOR CHAT POPUP:
- YOU ARE TALKING INSIDE A COMPACT, SLEEK FLOATING CHAT POPUP (~380px wide).
- NEVER USE ASCII / MARKDOWN TABLES (| Col 1 | Col 2 |). Tables look cluttered, broken, and unreadable on chat screens.
- Instead, present information using clean, beautiful formatting:
  * Bold section headers with emojis (e.g., "### 🎮 Top HUD (Control Center)").
  * Clean bullet points with bold keywords (`• **Feature Name**: Clear, concise explanation`).
  * Short, bite-sized paragraphs (1-2 sentences).
  * Use numbered lists when explaining step-by-step instructions.
- Be friendly, enthusiastic, and direct. Explain features clearly and concisely.
- ALWAYS complete every thought and sentence cleanly. Never stop or cut off mid-sentence.
- Always include 2 to 4 interactive action buttons at the end so the user can jump straight to the discussed features."""


@app.post("/chat/assistant")
def chat_with_aeriva(
    req: ChatAssistantRequest,
    authorization: str | None = Header(default=None)
):
    user_name = "Friend"
    is_authenticated = False
    try:
        if authorization:
            user = get_current_user(authorization)
            if user and user.name:
                user_name = user.name
                is_authenticated = True
    except Exception:
        pass

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        if req.is_auth_screen or not is_authenticated:
            return {
                "reply": "👋 Welcome to **AERIVA AI**!\n\n"
                         "AERIVA is your personal smart health & lifestyle dashboard. Here you can track your daily routine, meals using our AI camera food scanner, daily steps, water intake, workouts, and health safety precautions!\n\n"
                         "👉 **To get started**:\n"
                         "• If you already have an account, enter your email and password and click **Sign In**.\n"
                         "• If you don't have an account yet, click **Create Account** to register your profile!\n\n"
                         "[action:focus_login|🔐 SIGN IN TO ACCOUNT]\n"
                         "[action:switch_register|✨ CREATE NEW ACCOUNT]"
            }
        return {
            "reply": f"Hello {user_name}! I am **AERIVA**, your health & platform guide. Please make sure `GROQ_API_KEY` is configured in your `.env` to enable my full live AI chat. In the meantime, you can explore Dashboard 1 (Daily Routine), Dashboard 2 (What To Do / Exercise Mode), and Dashboard 3 (Precautions & Guidance)!"
        }

    try:
        from groq import Groq
        client = Groq(api_key=api_key)

        system_content = AERIVA_SYSTEM_PROMPT
        if req.is_auth_screen or not is_authenticated:
            system_content += (
                "\n\n### USER CONTEXT: LOGIN / ONBOARDING SCREEN\n"
                "The user is currently at the LOGIN / WELCOME SCREEN (not signed in yet).\n"
                "- When they ask what this webpage is or ask for help, introduce AERIVA AI as the all-in-one smart health & lifestyle command center.\n"
                "- Highlight the 4 core pillars: Daily Routine tracking, AI Camera Food Photo Scanner, Exercise Mode with rep counters, and Health Safety Shield precautions.\n"
                "- Tell the user clearly: 'If you already have an account, enter your credentials and sign in. If you don't have an account, please create a new account to begin!'\n"
                "- If they ask how to create an account, explain the easy step-by-step process: Click the 'CREATE ACCOUNT' tab, enter your name, email, and password, and click the button to enter!\n"
                "- ALWAYS conclude with interactive buttons: [action:focus_login|🔐 SIGN IN TO ACCOUNT] and [action:switch_register|✨ CREATE NEW ACCOUNT]."
            )
        else:
            system_content += f"\n\nThe current user is named '{user_name}' and is actively logged in."

        messages = [
            {"role": "system", "content": system_content}
        ]

        # Add recent conversation history if provided
        if req.history and isinstance(req.history, list):
            for h in req.history[-6:]:
                if isinstance(h, dict) and "role" in h and "content" in h:
                    messages.append({
                        "role": "user" if h["role"] == "user" else "assistant",
                        "content": str(h["content"])[:500]
                    })

        messages.append({"role": "user", "content": req.message})

        # Try openai/gpt-oss-120b, fallback to qwen/qwen3.8-27b
        try:
            resp = client.chat.completions.create(
                model="openai/gpt-oss-120b",
                messages=messages,
                max_tokens=1500,
                temperature=0.3,
                timeout=30.0
            )
        except Exception:
            resp = client.chat.completions.create(
                model="qwen/qwen3.8-27b",
                messages=messages,
                max_tokens=1500,
                temperature=0.3,
                timeout=30.0
            )

        reply = resp.choices[0].message.content.strip()
        return {"reply": reply}

    except Exception as e:
        print("AERIVA chatbot error:", e)
        return {
            "reply": f"Hi {user_name}! I'm **AERIVA**, your platform copilot. I am here to help you navigate: \n\n"
                     f"• **Dashboard 1**: Daily Routine, Food logging with AI camera, Steps, and Water.\n"
                     f"• **Dashboard 2**: Exercise Mode with step-by-step workouts.\n"
                     f"• **Dashboard 3**: Health Precautions (Food, Rest & Exercise warnings) and Next-Day Meal suggestions.\n\n"
                     f"*(AI note: {str(e)})*"
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
