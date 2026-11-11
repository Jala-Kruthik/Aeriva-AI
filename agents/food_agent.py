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

    llm = get_groq_llm(model="openai/gpt-oss-120b", temperature=0.1)
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
    import io
    from PIL import Image

    client = Groq(api_key=api_key)

    # Ensure image has valid dimensions (at least 64px, at most 1024px) for Qwen Vision
    try:
        pil_img = Image.open(io.BytesIO(image_bytes))
        if pil_img.mode in ("RGBA", "P"):
            pil_img = pil_img.convert("RGB")
        w, h = pil_img.size
        if max(w, h) > 1024:
            pil_img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
        elif min(w, h) < 64:
            pil_img = pil_img.resize((max(128, w * 2), max(128, h * 2)))

        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        clean_bytes = buf.getvalue()
        mime_type = "image/jpeg"
    except Exception as img_err:
        print("Image preprocessing note:", img_err)
        clean_bytes = image_bytes

    # Encode image to base64
    b64_str = base64.b64encode(clean_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_str}"

    system_instruction = (
        "You are a Michelin-grade culinary computer vision specialist and master Indian & global food expert.\n"
        "Examine the food image closely with meticulous precision. Follow these strict visual discrimination rules:\n\n"
        "### 1. BREAD & CARBOHYDRATE DISCRIMINATION (CRITICAL):\n"
        "- **POORI / PURI**: Golden-yellow or golden-brown, circular, thin, puffed with fried blisters/bubbles, deep-fried in oil/ghee. "
        "If you see circular deep-fried puffed blistered breads, they are POORI / PURI (or BHATURA if very large/leavened). "
        "NEVER classify deep-fried puffy breads as paratha, roti, or chapati!\n"
        "- **BHATURA / BHATURE**: Large, puffy, leavened deep-fried bread, oval or large round, thick, traditionally paired with dark Chole.\n"
        "- **PARATHA / ALOO PARATHA**: Griddle-cooked (tawa) flatbread with browned circular spots, layered or stuffed texture. "
        "Aloo Paratha clearly shows potato/spice stuffing inside a flat griddle-roasted wheat bread, NOT a deep-fried puffed oil bubble!\n"
        "- **ROTI / PHULKA / CHAPATI**: Thin unleavened flatbread roasted dry on a tawa with light brown charred spots, no oil fry.\n"
        "- **NAAN / KULCHA**: Teardrop or oval leavened flatbread with charred tandoor blisters.\n"
        "- **DOSA**: Thin, crispy golden-brown crepe rolled or folded into a cylinder, cone, or triangle.\n"
        "- **IDLI / VADA**: Steamed white spongy rice cakes (Idli) or golden donut-shaped savory lentil fritters (Medu Vada).\n"
        "- **PAV / BUN**: Soft leavened fluffy dinner rolls (for Pav Bhaji, Vada Pav) or sesame burger buns.\n\n"
        "### 2. CURRIES, GRAVIES & SIDES:\n"
        "- **CHANA MASALA / CHOLE**: Chickpeas in spiced reddish-brown or yellow-brown gravy, often garnished with green chilies/ginger/coriander.\n"
        "- **ALOO BHAJI / SABZI**: Potatoes cooked dry or in a spiced yellow turmeric gravy, often with mustard seeds.\n"
        "- **DAL TADKA / DAL MAKHANI / RAJMA**: Lentil stews (yellow dal, black dal with kidney beans, or red kidney beans).\n"
        "- **SOOJI HALWA / SHEERA**: Semolina sweet pudding with ghee and cardamom, served in firm/grainy scoops or mounds on the plate. "
        "DO NOT mistake solid sweet halwa scoops for liquid raita!\n"
        "- **RAITA**: Liquid/creamy yogurt in a bowl or cup, NOT dry grainy solid mounds.\n\n"
        "### 3. CLASSIC COMBINATIONS:\n"
        "- **Poori Chana with Halwa** (or Halwa Poori): Poori + Chana Masala + Sooji Halwa.\n"
        "- **Chole Bhature**: Large puffed Bhatura + spicy Chole.\n"
        "- **Poori Bhaji**: Poori + spiced Aloo potato curry.\n"
        "- **Idli Vada Sambar**: Steamed idlis, crispy medu vada, vegetable lentil stew, and coconut chutney.\n"
        "- **Pav Bhaji**: Buttered pav bread rolls + thick vegetable mash gravy.\n"
        "- **Burger & Sides**: Patty, bun, sauce, fries, ketchup.\n\n"
        "### 4. MULTI-ITEM ANALYSIS:\n"
        "Detect every individual food component on the plate (e.g., bread, curry, sweet/side). "
        "Provide an accurate composite dish name, as well as an `items_breakdown` list specifying each item.\n\n"
        "Output strictly valid JSON with no markdown:\n"
        "{\n"
        '  "food_name": "Accurate Canonical Dish Name (e.g. Poori Chana with Halwa, Chicken Biryani, Masala Dosa)",\n'
        '  "items_breakdown": [\n'
        '    {"item_name": "Poori", "portion": "3 pieces", "calories": 540},\n'
        '    {"item_name": "Chana Masala", "portion": "1 bowl (approx 200g)", "calories": 250},\n'
        '    {"item_name": "Sooji Halwa", "portion": "2 scoops", "calories": 350}\n'
        '  ],\n'
        '  "portion_description": "Detailed description of all items and portions visible",\n'
        '  "quantity": 1.0,\n'
        '  "calories_per_unit": 1140,\n'
        '  "total_calories": 1140,\n'
        '  "protein_g": 22.0,\n'
        '  "carbs_g": 145.0,\n'
        '  "fat_g": 48.0,\n'
        '  "category": "Indian Breakfast / Thali",\n'
        '  "is_junk": false,\n'
        '  "healthy_swap": "Actionable swap or portion advice",\n'
        '  "visual_explanation": "Detailed step-by-step culinary explanation of visual traits (bread texture, cooking method, sides)"\n'
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
                        {"type": "text", "text": "Identify every food item on this plate with exact precision, distinguishing cooking methods and specific bread/curry/sweet types. Return JSON only."},
                        {"type": "image_url", "image_url": {"url": data_url}}
                    ]
                }
            ],
            max_tokens=800,
            temperature=0.1,
            timeout=30.0
        )

        content = response.choices[0].message.content.strip()
        
        # Extract JSON using regex
        json_match = re.search(r"\{.*\}", content, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group(0))
        else:
            if content.startswith("```"):
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)
            data = json.loads(content)

        # Flexible extraction of fields
        food_name = str(data.get("food_name") or data.get("dish_name") or data.get("name") or "Identified Dish")

        # Quantity parsing
        raw_qty = data.get("quantity", 1.0)
        if isinstance(raw_qty, (int, float)):
            qty = max(0.1, float(raw_qty))
        else:
            qty_match = re.search(r"(\d+(?:\.\d+)?)", str(raw_qty))
            qty = float(qty_match.group(1)) if qty_match else 1.0

        # Calorie parsing
        raw_total_cal = data.get("total_calories") or data.get("calories") or 0.0
        cal_unit = float(data.get("calories_per_unit") or 0.0)
        try:
            total_cal = float(raw_total_cal)
        except Exception:
            total_cal = 0.0

        if total_cal <= 0 and cal_unit > 0:
            total_cal = cal_unit * qty
        elif total_cal > 0 and cal_unit <= 0:
            cal_unit = total_cal / qty
        elif total_cal <= 0 and cal_unit <= 0:
            total_cal = 280.0
            cal_unit = 280.0

        portion_desc = str(data.get("portion_description") or data.get("portion") or f"{qty} serving")
        explanation = str(data.get("visual_explanation") or data.get("description") or f"Identified as {food_name} via Groq Vision AI")

        # Parse granular item breakdown if multi-component meal (e.g. Poori + Chana + Halwa)
        items_breakdown = []
        raw_items = data.get("items_breakdown")
        if isinstance(raw_items, list):
            for itm in raw_items:
                if isinstance(itm, dict):
                    i_name = str(itm.get("item_name") or itm.get("name") or "").strip()
                    i_portion = str(itm.get("portion") or itm.get("quantity") or "1 serving").strip()
                    try:
                        i_cal = round(float(itm.get("calories") or 0.0), 1)
                    except Exception:
                        i_cal = 0.0
                    if i_name:
                        items_breakdown.append({
                            "item_name": i_name,
                            "portion": i_portion,
                            "calories": i_cal
                        })

        return {
            "food_name": food_name,
            "items_breakdown": items_breakdown,
            "portion_description": portion_desc,
            "quantity": round(qty, 2),
            "calories": round(total_cal, 1),
            "calories_per_unit": round(cal_unit, 1),
            "macros": {
                "protein": float(data.get("protein_g", data.get("protein", 0.0))),
                "carbs": float(data.get("carbs_g", data.get("carbs", 0.0))),
                "fat": float(data.get("fat_g", data.get("fat", 0.0)))
            },
            "category": str(data.get("category", "Main Course")),
            "is_junk": bool(data.get("is_junk", False)),
            "healthy_swap": str(data.get("healthy_swap", "")),
            "explanation": explanation,
            "confidence": "high (Groq Vision AI)"
        }

    except Exception as e:
        print("Groq Vision analysis error:", e)
        raise ValueError(f"Could not analyze food image: {str(e)}")

