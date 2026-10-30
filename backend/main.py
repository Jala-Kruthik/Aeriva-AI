from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

# Load .env file
load_dotenv()

from fastapi import FastAPI, HTTPException, Header, UploadFile, File
import base64
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

    try:
        result = analyze_food_image_langgraph(image_bytes, mime_type=mime_type)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




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

    if not items:
        raise HTTPException(status_code=400, detail="No food items provided")

    db = SessionLocal()
    logged_records = []

    try:
        for item in items:
            name = str(item.get("food_name", "")).strip()
            if not name:
                continue
            qty = float(item.get("quantity", 1.0))
            cal_data = estimate_calories(name, qty)
            cals = float(cal_data.get("calories", 0.0))

            food_log = FoodLog(
                user_id=user.id,
                log_date=date.today(),
                meal_type=meal_type,
                food_name=name,
                quantity=str(qty),
                calories=cals
            )
            db.add(food_log)
            db.flush()
            logged_records.append({
                "id": food_log.id,
                "log_date": str(food_log.log_date),
                "meal_type": food_log.meal_type,
                "food_name": food_log.food_name,
                "quantity": qty,
                "calories": cals
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
                "calories": float(item.calories) if item.calories is not None else 0.0
            })
        return result

    finally:
        db.close()


# =========================================
# NEXT-DAY MEAL SUGGESTIONS BASED ON TODAY & YESTERDAY
# =========================================

@app.get("/food/suggestions/next-day")
def get_next_day_food_suggestions(authorization: str | None = Header(default=None)):
    user = get_current_user(authorization)
    db = SessionLocal()

    today = date.today()
    yesterday = today - timedelta(days=1)
    tomorrow = today + timedelta(days=1)

    try:
        # 1. Fetch Today and Yesterday Food Logs
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
        weight = float(user.weight or 68.0)
        goal = (user.health_goal or "Maintain weight").lower()

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
    user = get_current_user(authorization)
    db = SessionLocal()

    steps = int(payload.get("steps", 0))
    calories_input = payload.get("daily_calories")

    try:
        # 1. Calculate calories consumed today if not passed
        if calories_input is None:
            today_logs = (
                db.query(FoodLog)
                .filter(FoodLog.user_id == user.id, FoodLog.log_date == date.today())
                .all()
            )
            daily_calories = sum(float(l.calories or 0.0) for l in today_logs)
        else:
            daily_calories = float(calories_input)

        # 2. User metrics & Basal Metabolic Rate
        weight_kg = float(user.weight or 68.0)
        height_cm = float(user.height or 172.0)
        age = int(user.age or 25)
        goal = str(user.health_goal or "Maintain health").lower()

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
                {"name": "Dynamic Warmup & Arm Circles", "duration": "3 mins", "reps": "Continuous movement"},
                {"name": "Jumping Jacks & High Knees", "duration": "8 mins", "reps": "4 sets × 45s work / 15s rest"},
                {"name": "Bodyweight Air Squats & Alternating Lunges", "duration": "10 mins", "reps": "4 sets × 15 reps each"},
                {"name": "Mountain Climbers & Push-Ups", "duration": "8 mins", "reps": "3 sets × 12 reps"},
                {"name": "Forearm Plank Holds", "duration": "4 mins", "reps": "3 sets × 45s hold"},
                {"name": "Full Body Hamstring & Quad Stretch", "duration": "3 mins", "reps": "Cool-down recovery"}
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
                {"name": "Cat-Cow & Spine Decompression", "duration": "4 mins", "reps": "Controlled breathing"},
                {"name": "Surya Namaskar (Sun Salutations)", "duration": "8 mins", "reps": "6 slow rounds"},
                {"name": "Glute Bridges & Bird-Dog Core", "duration": "5 mins", "reps": "3 sets × 12 reps"},
                {"name": "Child's Pose & Deep Hip Openers", "duration": "3 mins", "reps": "Restorative stretches"}
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
                {"name": "Brisk Pace Warmup & Torso Twists", "duration": "3 mins", "reps": "Warmup"},
                {"name": "Bodyweight Squats to Overhead Reach", "duration": "7 mins", "reps": "3 sets × 15 reps"},
                {"name": "Incline Push-Ups / Knee Push-Ups", "duration": "6 mins", "reps": "3 sets × 10 reps"},
                {"name": "Brisk Walk-Jog Intervals or Skipping", "duration": "8 mins", "reps": "30s sprint / 30s walk"},
                {"name": "Full Body Spine & Shoulder Release", "duration": "3 mins", "reps": "Cool-down"}
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
