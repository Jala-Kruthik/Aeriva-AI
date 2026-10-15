from typing import TypedDict

from langgraph.graph import StateGraph, START, END


class HealthState(TypedDict):
    # Basic user information
    user_name: str
    age: int
    height: float
    weight: float
    health_goal: str

    # Sleep information
    sleep_hours: float

    # Daily food information
    food_details: str
    daily_calories: float

    # Exercise information
    exercise_minutes: float

    # Daily routine
    daily_routine: str

    # Calculated health information
    bmi: float
    bmi_category: str
    calorie_status: str
    sleep_status: str
    activity_status: str
    goal_analysis: str

    # AI-generated analysis
    health_summary: str
    recommendations: list[str]


def collect_health_data(state: HealthState):
    print("Collecting health data for:", state["user_name"])

    return state


def calculate_bmi(state: HealthState):
    height_meters = state["height"] / 100

    bmi = state["weight"] / (height_meters * height_meters)

    if bmi < 18.5:
        category = "Underweight"
    elif bmi < 25:
        category = "Normal weight"
    elif bmi < 30:
        category = "Overweight"
    else:
        category = "Obese"

    return {
        "bmi": round(bmi, 2),
        "bmi_category": category
    }


def analyze_sleep(state: HealthState):
    sleep_hours = state["sleep_hours"]

    if sleep_hours < 7:
        status = "Insufficient sleep"
    elif sleep_hours <= 9:
        status = "Healthy sleep duration"
    else:
        status = "Long sleep duration"

    return {
        "sleep_status": status
    }


def analyze_activity(state: HealthState):
    exercise_minutes = state["exercise_minutes"]

    if exercise_minutes < 30:
        status = "Low physical activity"
    elif exercise_minutes < 60:
        status = "Moderate physical activity"
    else:
        status = "Good physical activity"

    return {
        "activity_status": status
    }


def analyze_calories(state: HealthState):
    calories = state["daily_calories"]

    if calories < 1500:
        status = "Low calorie intake"
    elif calories <= 2500:
        status = "Moderate calorie intake"
    else:
        status = "High calorie intake"

    return {
        "calorie_status": status
    }


def analyze_health_goal(state: HealthState):
    goal = state["health_goal"].strip().lower()

    if "fitness" in goal:
        analysis = (
            "The user's goal is to improve fitness. "
            "Focus on consistent physical activity, adequate sleep, "
            "balanced nutrition, and gradual improvement in exercise."
        )

    elif "lose" in goal or "weight loss" in goal:
        analysis = (
            "The user's goal is weight loss. "
            "Focus on sustainable physical activity, balanced nutrition, "
            "appropriate calorie intake, and consistent sleep."
        )

    elif "gain" in goal or "weight gain" in goal:
        analysis = (
            "The user's goal is weight gain. "
            "Focus on adequate nutrition, sufficient calories, "
            "strength-building exercise, and proper recovery."
        )

    elif "maintain" in goal:
        analysis = (
            "The user's goal is maintaining health. "
            "Focus on maintaining consistent sleep, nutrition, "
            "physical activity, and daily healthy habits."
        )

    else:
        analysis = (
            "The user's health goal requires a general lifestyle approach "
            "focused on balanced nutrition, regular physical activity, "
            "adequate sleep, and healthy daily routines."
        )

    return {
        "goal_analysis": analysis
    }


def generate_health_summary(state: HealthState):
    summary = (
        f"{state['user_name']} has a BMI of {state['bmi']} "
        f"({state['bmi_category']}). "
        f"Sleep status: {state['sleep_status']}. "
        f"Activity status: {state['activity_status']}. "
        f"Calorie status: {state['calorie_status']}. "
        f"Health goal: {state['health_goal']}. "
        f"Goal analysis: {state['goal_analysis']}"
    )

    return {
        "health_summary": summary
    }


def generate_recommendations(state: HealthState):
    recommendations = []

    # Sleep recommendations
    if state["sleep_hours"] < 7:
        recommendations.append(
            "Try to maintain at least 7 hours of sleep each night."
        )
    elif state["sleep_hours"] > 9:
        recommendations.append(
            "Maintain a consistent sleep schedule and monitor your sleep duration."
        )

    # Exercise recommendations
    if state["exercise_minutes"] < 30:
        recommendations.append(
            "Increase daily physical activity gradually."
        )
    elif state["exercise_minutes"] < 60:
        recommendations.append(
            "Gradually increase exercise duration while maintaining consistency."
        )

    # Calorie recommendations
    if state["daily_calories"] < 1500:
        recommendations.append(
            "Review your daily food intake to ensure adequate nutrition."
        )
    elif state["daily_calories"] > 2500:
        recommendations.append(
            "Review your calorie intake and maintain balanced portion sizes."
        )

    # Goal-specific recommendations
    goal = state["health_goal"].strip().lower()

    if "fitness" in goal:
        recommendations.append(
            "For fitness improvement, combine cardiovascular exercise "
            "with strength training and maintain consistent weekly activity."
        )

    elif "lose" in goal or "weight loss" in goal:
        recommendations.append(
            "For weight management, focus on sustainable nutrition habits "
            "and regular physical activity rather than extreme dieting."
        )

    elif "gain" in goal or "weight gain" in goal:
        recommendations.append(
            "For weight gain, focus on balanced nutrition, adequate calories, "
            "strength training, and proper recovery."
        )

    elif "maintain" in goal:
        recommendations.append(
            "Continue maintaining balanced nutrition, regular exercise, "
            "adequate sleep, and consistent daily habits."
        )

    # Default recommendation
    if not recommendations:
        recommendations.append(
            "Continue maintaining your current healthy lifestyle habits."
        )

    return {
        "recommendations": recommendations
    }


# Create the LangGraph state graph
graph_builder = StateGraph(HealthState)


# Add processing nodes
graph_builder.add_node(
    "collect_health_data",
    collect_health_data
)

graph_builder.add_node(
    "calculate_bmi",
    calculate_bmi
)

graph_builder.add_node(
    "analyze_sleep",
    analyze_sleep
)

graph_builder.add_node(
    "analyze_activity",
    analyze_activity
)

graph_builder.add_node(
    "analyze_calories",
    analyze_calories
)

graph_builder.add_node(
    "analyze_health_goal",
    analyze_health_goal
)

graph_builder.add_node(
    "generate_health_summary",
    generate_health_summary
)

graph_builder.add_node(
    "generate_recommendations",
    generate_recommendations
)


# Define the LangGraph workflow
graph_builder.add_edge(
    START,
    "collect_health_data"
)

graph_builder.add_edge(
    "collect_health_data",
    "calculate_bmi"
)

graph_builder.add_edge(
    "calculate_bmi",
    "analyze_sleep"
)

graph_builder.add_edge(
    "analyze_sleep",
    "analyze_activity"
)

graph_builder.add_edge(
    "analyze_activity",
    "analyze_calories"
)

graph_builder.add_edge(
    "analyze_calories",
    "analyze_health_goal"
)

graph_builder.add_edge(
    "analyze_health_goal",
    "generate_health_summary"
)

graph_builder.add_edge(
    "generate_health_summary",
    "generate_recommendations"
)

graph_builder.add_edge(
    "generate_recommendations",
    END
)


# Compile the graph
health_graph = graph_builder.compile()