"""
AERIVA AI — Dynamic Food & Calorie Service
Powered by LangGraph and Groq API.
Does not store food names or static calories in this file.
All calorie estimations, portions, and food suggestions are guessed dynamically by the AI Agent.
"""

from typing import List, Dict, Any
from agents.food_agent import (
    calculate_food_calories_langgraph,
    guess_food_suggestions_langgraph
)


def estimate_calories(food_name: str, quantity: float = 1.0) -> Dict[str, Any]:
    """
    Dynamically estimates calories for any food using LangGraph and Groq LLM.
    No food database is stored in this file.
    """
    clean_name = str(food_name).strip()
    qty = max(0.1, float(quantity))

    if not clean_name:
        return {
            "food_name": "",
            "quantity": qty,
            "calories": 0.0,
            "found": False,
            "message": "Please enter a food name."
        }

    # Invoke LangGraph Groq Food Agent
    ai_result = calculate_food_calories_langgraph(clean_name, qty)

    return {
        "food_name": ai_result["food_name"],
        "quantity": qty,
        "calories": ai_result["calories"],
        "calories_per_unit": ai_result["calories_per_unit"],
        "serving_description": ai_result["serving_description"],
        "category": ai_result["category"],
        "macros": ai_result.get("macros", {}),
        "is_junk": ai_result.get("is_junk", False),
        "healthy_swap": ai_result.get("healthy_swap", ""),
        "explanation": ai_result["explanation"],
        "confidence": ai_result.get("confidence", "AI estimated"),
        "found": True,
        "message": "Calculated dynamically using LangGraph & Groq AI."
    }


def search_indian_foods(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """
    Dynamically predicts and guesses matching food names and calories as the user types.
    Powered by LangGraph and Groq LLM without storing static data in this file.
    """
    return guess_food_suggestions_langgraph(query, limit=limit)
