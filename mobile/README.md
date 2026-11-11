# AERIVA AI — Flutter Mobile Application

A cross-platform Flutter mobile application implementing the dual dashboard health and fitness companion for **Android**, **iOS**, and **Mobile Web**.

---

## 📱 Features

### 1. Dual Dashboard System with Left-Side Corner Switcher
- **Left-Side Corner Switcher** in the top navigation bar:
  - `[ 1  Daily Routine ]`: Daily schedule, what food we eat, steps walked, water we drank.
  - `[ 2  What To Do ]`: Guided exercise mode & next-day nutrition suggestions.
- **Login Behavior**: Always opens directly to **Dashboard 1 (`1 - Daily Routine`)** upon login.

### 2. Live Accurate Vitals
- **Daily Health Score (0 - 100%)**: Dynamically computed across Sleep Quality (25 pts), Hydration (25 pts), Activity & Exercise (25 pts), and Nutrition (25 pts) with animated radial ring.
- **Energy Reserve (0 - 100%)**: Dynamically computed from human circadian rhythm throughout the 24h day, sleep foundation, hydration recharge, and meal replenishment with responsive battery meter.

### 3. Step-by-Step Exercise Mode in a Popup Way (`2 - What To Do`)
- Tap **`⚡ START EXERCISE MODE (OPEN STEP-BY-STEP POPUP)`** or any exercise.
- Opens bottom-sheet popup modal with **clean posture illustration diagrams** for easy understanding (Cat-Cow, Surya Namaskar, Glute Bridges, Child's Pose, etc.).
- Active exercise badge, form instructions, and interactive timer (Start/Pause/Reset).
- Sequential progression: clicking **`✓ 1ST EXERCISE COMPLETED → NEXT EXERCISE`** transitions to the next exercise in the **exact same format**.
- Completing the final exercise awards **+25 XP**, updates **Activity Time**, and shows the celebration trophy.

### 4. Next-Day Meal Suggestions
- Automatically recommends Breakfast, Lunch, Snack, and Dinner for tomorrow based on today's food logs and activity level.

---

## 🚀 How to Run the Flutter App

### Prerequisites
1. Install [Flutter SDK](https://flutter.dev/docs/get-started/install) (version 3.0+).
2. Start the AERIVA backend:
   ```bash
   cd /Users/kruthikjala/Downloads/aeriva-ai
   ./venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```

### Connecting to the Backend
You have two ways to connect:

#### Option A: 24/7 Cloud API (Works Even When Computer is OFF)
Deploy the backend once to a free host like **Render.com** or **Railway**:
1. Push project to GitHub.
2. Link repo to [Render.com](https://render.com) (Web Service, Free Plan).
3. Build Command: `pip install -r requirements.txt` | Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. In the Flutter App, tap **"Server Settings"** on the login screen and paste your Render URL:
   `https://aeriva-backend.onrender.com`
Now your phone accesses the API anytime, anywhere, 24/7!

#### Option B: Local Wi-Fi Development (While Computer is ON)
- **Physical Phone (via Wi-Fi)**: `http://10.45.15.91:8000` (both phone & Mac on same Wi-Fi).
- **Android Emulator**: `http://10.0.2.2:8000`.
- **iOS Simulator / Mac / Web**: `http://localhost:8000`.

#### Option C: 100% Offline / Standalone Mode (Zero Computer Needed!)
Tap **`⚡ USE OFFLINE (NO COMPUTER NEEDED)`** on the login screen. All exercise posture diagrams, timers, routines, step & water trackers, and vitals meters run directly on your phone hardware with zero dependencies.

### Running the App
```bash
cd /Users/kruthikjala/Downloads/aeriva-ai/mobile

# Get dependencies
flutter pub get

# Run on connected device or simulator
flutter run
```

---

## 📂 Project Structure
```
mobile/
├── pubspec.yaml                 # Flutter project configuration & dependencies
├── README.md                    # Setup & running instructions
└── lib/
    ├── main.dart                # App entry point & theme initialization
    ├── theme/
    │   └── app_theme.dart       # Cyberpunk neon dark theme colors & styling
    ├── services/
    │   └── api_service.dart     # Backend API integration (Auth, Food, Exercise, Suggestions)
    ├── painters/
    │   └── exercise_diagram_painter.dart # Vector illustrations of exercise postures
    ├── widgets/
    │   ├── vitals_cards.dart    # Health Score radial ring & Energy battery bar
    │   └── exercise_popup_modal.dart # Step-by-step popup with diagrams & sequential flow
    └── screens/
        ├── auth_screen.dart     # Login and registration screen
        ├── main_navigation_screen.dart # Top bar, left-corner switcher & dual view host
        ├── dashboard1_screen.dart # 1 - Daily Routine (Timeline, Food, Steps, Water)
        └── dashboard2_screen.dart # 2 - What To Do (Exercise Mode, Next-Day Meals)
```

