from typing import TypedDict

from langgraph.graph import StateGraph, END


class FoodCalorieState(TypedDict, total=False):
    food_name: str
    quantity: float
    normalized_food: str
    calories_per_unit: float
    estimated_calories: float
    explanation: str
    confidence: str


def collect_food_data(state: FoodCalorieState):
    food_name = str(state.get("food_name", "")).strip()
    quantity = float(state.get("quantity", 0))

    if not food_name:
        raise ValueError("Food name cannot be empty.")

    if quantity <= 0:
        raise ValueError("Quantity must be greater than zero.")

    return {
        "food_name": food_name,
        "quantity": quantity,
    }


def normalize_food(state: FoodCalorieState):
    food_name = state["food_name"].lower().strip()
    food_name = food_name.replace("-", " ").replace("_", " ")
    food_name = " ".join(food_name.split())

    return {
        "normalized_food": food_name,
    }


def estimate_food_calories(state: FoodCalorieState):
    food = state["normalized_food"]
    quantity = state["quantity"]

    if "idli" in food or "idly" in food:
        calories_per_unit = 60.0
    elif "dosa" in food or "dosai" in food:
        calories_per_unit = 130.0
    elif "chapati" in food or "roti" in food:
        calories_per_unit = 110.0
    elif "rice" in food:
        calories_per_unit = 200.0
    elif "banana" in food:
        calories_per_unit = 105.0
    elif "apple" in food:
        calories_per_unit = 95.0
    elif "egg" in food:
        calories_per_unit = 75.0
    elif "milk" in food:
        calories_per_unit = 120.0
    elif "curd" in food or "yogurt" in food:
        calories_per_unit = 100.0
    elif "bread" in food:
        calories_per_unit = 80.0
    elif "oats" in food:
        calories_per_unit = 150.0
    elif "dal" in food or "lentil" in food:
        calories_per_unit = 180.0
    elif "chicken" in food:
        calories_per_unit = 240.0
    elif "fish" in food:
        calories_per_unit = 200.0
    elif "paneer" in food:
        calories_per_unit = 265.0
    elif "vegetable" in food:
        calories_per_unit = 100.0
    elif "biryani" in food:
        calories_per_unit = 300.0
    elif "pizza" in food:
        calories_per_unit = 285.0
    elif "burger" in food:
        calories_per_unit = 350.0
    elif "noodle" in food:
        calories_per_unit = 220.0
    elif "pasta" in food:
        calories_per_unit = 220.0
    else:
        calories_per_unit = 200.0

    estimated_calories = calories_per_unit * quantity

    return {
        "calories_per_unit": calories_per_unit,
        "estimated_calories": round(estimated_calories, 2),
    }


def generate_food_explanation(state: FoodCalorieState):
    food = state["food_name"]
    quantity = state["quantity"]
    calories = state["estimated_calories"]

    explanation = (
        f"AERIVA estimates approximately {round(calories)} kcal "
        f"for {quantity:g} serving/unit of {food}. "
        "Actual calories can vary depending on portion size, "
        "ingredients, and preparation."
    )

    return {
        "explanation": explanation,
        "confidence": "estimated",
    }


food_graph_builder = StateGraph(FoodCalorieState)

food_graph_builder.add_node(
    "collect_food_data",
    collect_food_data,
)
food_graph_builder.add_node(
    "normalize_food",
    normalize_food,
)
food_graph_builder.add_node(
    "estimate_food_calories",
    estimate_food_calories,
)
food_graph_builder.add_node(
    "generate_food_explanation",
    generate_food_explanation,
)

food_graph_builder.set_entry_point("collect_food_data")

food_graph_builder.add_edge(
    "collect_food_data",
    "normalize_food",
)
food_graph_builder.add_edge(
    "normalize_food",
    "estimate_food_calories",
)
food_graph_builder.add_edge(
    "estimate_food_calories",
    "generate_food_explanation",
)
food_graph_builder.add_edge(
    "generate_food_explanation",
    END,
)

food_graph = food_graph_builder.compile()


def calculate_food_calories(food_name: str, quantity: float):
    result = food_graph.invoke({
        "food_name": food_name,
        "quantity": quantity,
    })

    return {
        "food_name": result["food_name"],
        "quantity": result["quantity"],
        "calories": result["estimated_calories"],
        "calories_per_unit": result["calories_per_unit"],
        "explanation": result["explanation"],
        "confidence": result["confidence"],
    }
