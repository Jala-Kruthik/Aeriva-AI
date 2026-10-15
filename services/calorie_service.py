FOOD_CALORIES = {
    "idli": 58,
    "dosa": 168,
    "plain dosa": 168,
    "masala dosa": 220,
    "chapati": 120,
    "roti": 120,
    "rice": 130,
    "white rice": 130,
    "brown rice": 123,
    "curd": 98,
    "yogurt": 59,
    "banana": 89,
    "apple": 52,
    "orange": 47,
    "egg": 78,
    "boiled egg": 78,
    "chicken": 239,
    "chicken breast": 165,
    "dal": 116,
    "sambar": 75,
    "rasam": 30,
    "vegetable curry": 100,
    "vegetables": 65,
    "paneer": 265,
    "milk": 61,
    "bread": 79,
    "peanut butter": 588,
    "oats": 389,
    "upma": 150,
    "poha": 130,
    "pongal": 180,
    "biryani": 200,
    "chapati with dal": 236
}


def estimate_calories(food_name: str, quantity: float = 1) -> dict:
    normalized_food = food_name.strip().lower()

    calories_per_unit = FOOD_CALORIES.get(
        normalized_food
    )

    if calories_per_unit is None:
        return {
            "food_name": food_name,
            "quantity": quantity,
            "calories": 0,
            "found": False,
            "message": (
                "Food not found in the local calorie database. "
                "A nutrition lookup will be added later."
            )
        }

    calories = calories_per_unit * quantity

    return {
        "food_name": food_name,
        "quantity": quantity,
        "calories": round(calories, 2),
        "found": True,
        "message": "Calories estimated successfully."
    }