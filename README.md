# AERIVA AI — Smart Health & Lifestyle Dashboard

A modern, full-stack AI-powered personal health and lifestyle management application featuring intelligent agents, weekly schedule tracking, food and calorie estimation, and a sleek cybernetic dashboard UI.

---

## Features

- **Personalized Health & Lifestyle Dashboard**: Interactive schedule view, activity tracking, and status metrics.
- **AI Agent Intelligence**:
  - **Health Agent**: Evaluates routine balance, activity levels, and daily workload.
  - **Food Agent & Calorie Service**: Analyzes meals and provides automatic calorie estimations.
- **Weekly Schedule Manager**: Plan and track 7-day schedules with activity breakdowns.
- **Food & Nutrition Log**: Record meals with instant nutritional insights and timestamped logging.
- **Secure Authentication**: Token-based JWT authentication with Argon2 password hashing.
- **Futuristic Glassmorphic UI**: High-contrast dark theme, ambient glow accents, and responsive layout.

---

## Tech Stack

- **Backend**: Python 3, FastAPI, Uvicorn, Pydantic
- **AI / Agentic Workflow**: LangGraph, LangChain Core
- **Database**: SQLite, SQLAlchemy
- **Authentication**: JWT (`python-jose`), Argon2 (`argon2-cffi`, `pwdlib`)
- **Frontend**: Vanilla JavaScript (ES6+), Modern HTML5, Responsive Custom CSS

---

## Project Structure

```text
aeriva-ai/
├── agents/              # AI Agents (Health & Food agents)
│   ├── food_agent.py
│   └── health_agent.py
├── backend/             # FastAPI application and route handlers
│   ├── main.py          # API entry point & static file serving
│   ├── schemas.py       # Pydantic models & request schemas
│   └── security.py      # Auth tokens & password hashing
├── database/            # Database layer & models
│   ├── database.py      # SQLAlchemy session & engine config
│   └── models.py        # Database entities (User, Schedule, FoodLog)
├── frontend/            # Web interface
│   ├── app.js           # Client-side state & API communication
│   ├── index.html       # Single-page application markup
│   └── style.css        # Glassmorphic UI styling
├── services/            # Supporting services (calorie estimation)
│   └── calorie_service.py
├── requirements.txt     # Python package dependencies
└── README.md
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/aeriva-ai.git
cd aeriva-ai
```

### 2. Set Up Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Application

```bash
uvicorn backend.main:app --reload --port 8000
```

Open your browser and navigate to:
```text
http://127.0.0.1:8000
```

---

## License

This project is licensed under the MIT License.
