"""
AERIVA AI — LangGraph & Groq AI Food Agent
Dynamically analyzes, guesses, and estimates calories and nutritional data for any food using LangGraph and Groq API.
Does not rely on static calorie tables.
"""

import os
import json
import re
import base64
from typing import TypedDict, List, Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

from langgraph.graph import StateGraph, START, END

# In-memory query cache for instant autocomplete responses
_AI_SUGGESTIONS_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_AI_CALORIE_CACHE: Dict[str, Dict[str, Any]] = {}


def get_groq_llm(model: str = "openai/gpt-oss-120b", temperature: float = 0.1):
    """Initializes ChatGroq using the user-provided GROQ_API_KEY."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None

    try:
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=model,
            temperature=temperature,
            groq_api_key=api_key,
            max_tokens=800,
            timeout=10
        )
    except Exception as e:
        print("Failed to initialize ChatGroq:", e)
        return None



# =====================================================================
# LANGGRAPH STATE DEFINITION
# =====================================================================

class FoodAgentState(TypedDict, total=False):
    food_name: str
    quantity: float
    is_skipped: bool
    ai_raw_response: str
    parsed_food_name: str
    serving_description: str
    calories_per_unit: float
    total_calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    category: str
    is_junk: bool
    healthy_swap: str
    explanation: str
    confidence: str
    error: Optional[str]


# =====================================================================
# LANGGRAPH NODES
# =====================================================================

def validate_input_node(state: FoodAgentState) -> Dict[str, Any]:
    """Validates food name, quantity, and checks for skipped meal."""
    raw_name = str(state.get("food_name", "")).strip()
    qty = max(0.1, float(state.get("quantity", 1.0)))

    if not raw_name:
        return {
            "is_skipped": False,
            "error": "Food name cannot be empty.",
            "total_calories": 0.0,
            "explanation": "No food specified."
        }

    if "skip" in raw_name.lower():
        return {
            "food_name": raw_name,
            "quantity": qty,
            "is_skipped": True,
            "parsed_food_name": raw_name.title(),
            "serving_description": "Meal skipped",
            "calories_per_unit": 0.0,
            "total_calories": 0.0,
            "category": "Skipped",
            "is_junk": False,
            "healthy_swap": "",
            "explanation": "Meal recorded as skipped (0 kcal).",
            "confidence": "high"
        }

    return {
        "food_name": raw_name,
        "quantity": qty,
        "is_skipped": False
    }


def groq_food_agent_node(state: FoodAgentState) -> Dict[str, Any]:
    """Calls Groq LLM to dynamically guess and estimate calories, portion, and macros."""
    if state.get("is_skipped") or state.get("error"):
        return state

    food = state["food_name"]
    qty = state["quantity"]

    # Check cache first
    cache_key = f"{food.lower().strip()}_{qty}"
    if cache_key in _AI_CALORIE_CACHE:
        return _AI_CALORIE_CACHE[cache_key]

    llm = get_groq_llm(model="openai/gpt-oss-120b", temperature=0.1)
    if not llm:
        # If user hasn't set GROQ_API_KEY or key is invalid, fallback cleanly
        return heuristic_ai_estimate(food, qty, note="Groq API key not set in .env")

    system_prompt = (
        "You are an expert AI Indian and global culinary nutritionist. "
        "Analyze the provided food name and quantity. "
        "Estimate realistic nutritional values, standard Indian portion size, and calories. "
        "Output strictly valid JSON with no markdown and no extra text.\n"
        "Required JSON schema:\n"
        "{\n"
        '  "parsed_food_name": "Standard food name",\n'
        '  "serving_description": "e.g. 1 medium piece / 1 bowl (150g) / 1 plate",\n'
        '  "calories_per_unit": 240,\n'
        '  "total_calories": 240,\n'
        '  "protein_g": 6.5,\n'
        '  "carbs_g": 38.0,\n'
        '  "fat_g": 8.0,\n'
        '  "category": "e.g. South Indian Breakfast, North Indian Curries, Breads, Dals, Street Food, etc.",\n'
        '  "is_junk": false,\n'
        '  "healthy_swap": "optional healthier alternative if high in oil/sugar",\n'
        '  "explanation": "Brief 1-sentence nutritional breakdown"\n'
        "}"
    )

    user_prompt = f"Food item: '{food}' | Quantity: {qty}"

    try:
        response = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])
        content = response.content.strip()

        # Clean code fences if present
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        data = json.loads(content)

        cals_unit = float(data.get("calories_per_unit", 180))
        total_cals = float(data.get("total_calories", cals_unit * qty))
        if total_cals == 0 and cals_unit > 0:
            total_cals = round(cals_unit * qty, 1)

        result = {
            "parsed_food_name": str(data.get("parsed_food_name", food.title())),
            "serving_description": str(data.get("serving_description", f"{qty} serving")),
            "calories_per_unit": round(cals_unit, 1),
            "total_calories": round(total_cals, 1),
            "protein_g": float(data.get("protein_g", 0.0)),
            "carbs_g": float(data.get("carbs_g", 0.0)),
            "fat_g": float(data.get("fat_g", 0.0)),
            "category": str(data.get("category", "General Food")),
            "is_junk": bool(data.get("is_junk", False)),
            "healthy_swap": str(data.get("healthy_swap", "")),
            "explanation": str(data.get("explanation", f"AI estimated based on {food}")),
            "confidence": "high (Groq AI)"
        }

        # Cache valid result
        _AI_CALORIE_CACHE[cache_key] = result
        return result

    except Exception as e:
        print("Groq Food Agent invocation error:", e)
        return heuristic_ai_estimate(food, qty, note=f"Groq API call error: {str(e)[:50]}")


def heuristic_ai_estimate(food: str, qty: float, note: str = "") -> Dict[str, Any]:
    """Fallback estimator when GROQ_API_KEY is not configured, ensuring app never crashes."""
    clean = food.lower().strip()
    base_cal = 180.0
    cat = "Indian Cuisine"

    if any(w in clean for w in ["dosa", "idli", "vada", "uttapam", "pongal", "upma", "poha"]):
        base_cal = 190.0
        cat = "South Indian Breakfast"
    elif any(w in clean for w in ["biryani", "pulao", "rice"]):
        base_cal = 280.0
        cat = "Rice Dishes"
    elif any(w in clean for w in ["roti", "chapati", "phulka", "paratha", "naan"]):
        base_cal = 140.0
        cat = "Indian Breads"
    elif any(w in clean for w in ["paneer", "butter chicken", "chicken", "mutton", "curry", "dal"]):
        base_cal = 260.0
        cat = "Curries & Dals"
    elif any(w in clean for w in ["samosa", "pakora", "pizza", "burger", "chaat"]):
        base_cal = 250.0
        cat = "Snacks & Street Food"
    elif any(w in clean for w in ["tea", "chai", "coffee", "juice", "lassi"]):
        base_cal = 90.0
        cat = "Beverages"

    total = round(base_cal * qty, 1)

    return {
        "parsed_food_name": food.title(),
        "serving_description": f"{qty:g} serving",
        "calories_per_unit": base_cal,
        "total_calories": total,
        "protein_g": round(total * 0.05, 1),
        "carbs_g": round(total * 0.15, 1),
        "fat_g": round(total * 0.04, 1),
        "category": cat,
        "is_junk": False,
        "healthy_swap": "",
        "explanation": f"AI estimation ({note})",
        "confidence": "heuristic fallback"
    }


def format_response_node(state: FoodAgentState) -> Dict[str, Any]:
    """Ensures numeric calories and clean payload structure."""
    state["total_calories"] = round(float(state.get("total_calories", 0.0)), 1)
    return state


# =====================================================================
# BUILD & COMPILE LANGGRAPH
# =====================================================================

food_graph_builder = StateGraph(FoodAgentState)

food_graph_builder.add_node("validate_input", validate_input_node)
food_graph_builder.add_node("groq_food_agent", groq_food_agent_node)
food_graph_builder.add_node("format_response", format_response_node)

food_graph_builder.add_edge(START, "validate_input")
food_graph_builder.add_edge("validate_input", "groq_food_agent")
food_graph_builder.add_edge("groq_food_agent", "format_response")
food_graph_builder.add_edge("format_response", END)

food_graph = food_graph_builder.compile()


def calculate_food_calories_langgraph(food_name: str, quantity: float = 1.0) -> Dict[str, Any]:
    """Entry point invoking the LangGraph Food Agent."""
    result = food_graph.invoke({
        "food_name": food_name,
        "quantity": quantity
    })

    return {
        "food_name": result.get("parsed_food_name") or food_name,
        "quantity": result.get("quantity", quantity),
        "calories": result.get("total_calories", 0.0),
        "calories_per_unit": result.get("calories_per_unit", 0.0),
        "serving_description": result.get("serving_description", ""),
        "category": result.get("category", "Indian Food"),
        "macros": {
            "protein": result.get("protein_g", 0.0),
            "carbs": result.get("carbs_g", 0.0),
            "fat": result.get("fat_g", 0.0)
        },
        "is_junk": result.get("is_junk", False),
        "healthy_swap": result.get("healthy_swap", ""),
        "explanation": result.get("explanation", ""),
        "confidence": result.get("confidence", "AI")
    }


# =====================================================================
# AI AUTOCOMPLETE & DYNAMIC GUESSING (GROQ POWERED)
# =====================================================================

def guess_food_suggestions_langgraph(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """
    Dynamically guesses matching Indian food dishes on the fly using Groq API.
    Does NOT use a static stored database.
    """
    q = query.strip().lower()
    if not q:
        # Default smart staples
        q = "popular indian breakfast and dinner"

    # Check cache
    if q in _AI_SUGGESTIONS_CACHE:
        return _AI_SUGGESTIONS_CACHE[q][:limit]

    llm = get_groq_llm(model="qwen/qwen3.8-27b", temperature=0.1)
    if not llm:
        # Fast fallback guesses when API key is not yet set
        fallbacks = [
            {"name": f"{query.title()} Masala", "calories": 240, "portion": "1 bowl (150g)", "category": "Curries"},
            {"name": f"{query.title()} Dosa", "calories": 220, "portion": "1 medium dosa", "category": "South Indian"},
            {"name": f"{query.title()} Biryani", "calories": 360, "portion": "1 plate", "category": "Rice & Biryani"},
            {"name": f"{query.title()} Paratha", "calories": 280, "portion": "1 piece", "category": "Breads & Rotis"},
            {"name": f"{query.title()} Curry", "calories": 250, "portion": "1 bowl", "category": "Curries"}
        ]
        return fallbacks[:limit]

    prompt = (
        f"The user is typing in a search box: '{query}'. "
        "Predict and guess 5 to 6 popular Indian dishes they might be typing (covering South/North/Street Indian foods). "
        "For each dish, provide: name, typical calories per standard serving, portion description, and category. "
        "Return ONLY a valid JSON array of objects with keys: name, calories, portion, category. "
        "No explanation, no markdown backticks."
    )

    try:
        res = llm.invoke(prompt)
        text = res.content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

        items = json.loads(text)
        if isinstance(items, list):
            cleaned = []
            for it in items:
                if isinstance(it, dict) and "name" in it:
                    cleaned.append({
                        "name": str(it.get("name")),
                        "calories": round(float(it.get("calories", 200))),
                        "portion": str(it.get("portion", "1 serving")),
                        "category": str(it.get("category", "Indian Food"))
                    })
            if cleaned:
                _AI_SUGGESTIONS_CACHE[q] = cleaned
                return cleaned[:limit]

    except Exception as e:
        print("Groq guess suggestions error:", e)

    return [
        {"name": f"{query.title()}", "calories": 200, "portion": "1 serving", "category": "Indian Cuisine"}
    ]


# =====================================================================
# AI FOOD IMAGE VISION IDENTIFICATION (GROQ QWEN MULTIMODAL)
# =====================================================================

def analyze_food_image_langgraph(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Analyzes an uploaded food image using Groq's multimodal vision model (qwen/qwen3.8-27b).
    Identifies:
    - What food dish it is
    - Estimated quantity / portion size (e.g. 2 pieces, 1 bowl, 1 plate)
    - Calories per unit and total estimated calories
    - Macronutrients (protein, carbs, fat)
    - Detailed visual description of what is on the plate
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GROQ_API_KEY not configured in .env file.")

    from groq import Groq
    client = Groq(api_key=api_key)

    # Encode image to base64
    b64_str = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_str}"

    system_instruction = (
        "You are an expert culinary nutrition AI and computer vision specialist. "
        "Examine the food image closely. "
        "Identify: "
        "1. The exact name of the food dish (especially Indian or global dishes, e.g., Masala Dosa, Chicken Biryani, Dal Makhani with Roti, Paneer Tikka). "
        "2. The visible quantity and portion size (e.g., '2 medium dosas', '1 full plate (approx 350g)', '1 bowl'). "
        "3. Numerical quantity as a decimal number (e.g., 2.0 if 2 pieces/rotis/dosas, 1.0 if 1 plate/bowl, 1.5 if large portion). "
        "4. Estimated calories per unit and total calories for the visible portion. "
        "5. Estimated macronutrients (protein, carbs, fat in grams). "
        "6. Category (e.g., South Indian Breakfast, North Indian Curry, Rice Dishes, Breads, Snacks, etc.). "
        "7. Visual explanation detailing what items, sides, garnishes, and textures are visible in the image. "
        "Output strictly valid JSON with no markdown and no extra text:\n"
        "{\n"
        '  "food_name": "Exact Identified Dish Name",\n'
        '  "portion_description": "e.g. 2 medium dosas with potato masala & coconut chutney",\n'
        '  "quantity": 2.0,\n'
        '  "calories_per_unit": 220,\n'
        '  "total_calories": 440,\n'
        '  "protein_g": 10.0,\n'
        '  "carbs_g": 62.0,\n'
        '  "fat_g": 14.0,\n'
        '  "category": "South Indian Breakfast",\n'
        '  "is_junk": false,\n'
        '  "healthy_swap": "",\n'
        '  "visual_explanation": "Detailed visual description of food items seen in the image"\n'
        "}"
    )

    try:
        response = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_instruction},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Identify this food dish, estimate the visible quantity/portion, and calculate its calories."},
                        {"type": "image_url", "image_url": {"url": data_url}}
                    ]
                }
            ],
            max_tokens=600,
            temperature=0.1
        )

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        data = json.loads(content)

        qty = max(0.1, float(data.get("quantity", 1.0)))
        cal_unit = float(data.get("calories_per_unit", 200.0))
        total_cal = float(data.get("total_calories", cal_unit * qty))
        if total_cal == 0 and cal_unit > 0:
            total_cal = round(cal_unit * qty, 1)

        return {
            "food_name": str(data.get("food_name", "Identified Dish")),
            "portion_description": str(data.get("portion_description", f"{qty} serving")),
            "quantity": qty,
            "calories": round(total_cal, 1),
            "calories_per_unit": round(cal_unit, 1),
            "macros": {
                "protein": float(data.get("protein_g", 0.0)),
                "carbs": float(data.get("carbs_g", 0.0)),
                "fat": float(data.get("fat_g", 0.0))
            },
            "category": str(data.get("category", "Food")),
            "is_junk": bool(data.get("is_junk", False)),
            "healthy_swap": str(data.get("healthy_swap", "")),
            "explanation": str(data.get("visual_explanation", "Identified using Groq Vision AI")),
            "confidence": "high (Groq Vision AI)"
        }

    except Exception as e:
        print("Groq Vision analysis error:", e)
        raise ValueError(f"Could not analyze food image: {str(e)}")

