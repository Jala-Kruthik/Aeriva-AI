/* =========================================
   AERIVA AI - APP.JS
========================================= */


const API = "";


/* =========================================
   GLOBAL DATA
========================================= */


let authToken = localStorage.getItem("aeriva_token");

let currentUser = null;

let waterAmount = 0;

let xp = Number(localStorage.getItem("aeriva_xp")) || 0;

let timeAwarenessInterval = null;


/* =========================================
   PAGE START
========================================= */


document.addEventListener("DOMContentLoaded", async () => {

    updateXP();

    updateDate();

    startTimeAwareness();

    if (authToken) {

        try {

            await loadDashboard();

        } catch (error) {

            console.error(error);

            logoutUser();

        }

    } else {

        showLogin();

    }

});


/* =========================================
   LOGIN / REGISTER SCREEN
========================================= */


function showLogin() {

    document.getElementById("loginBox").classList.remove("hidden");

    document.getElementById("registerBox").classList.add("hidden");

    document.getElementById("loginMessage").textContent = "";

    document.getElementById("registerMessage").textContent = "";

}


function showRegister() {

    document.getElementById("loginBox").classList.add("hidden");

    document.getElementById("registerBox").classList.remove("hidden");

    document.getElementById("loginMessage").textContent = "";

    document.getElementById("registerMessage").textContent = "";

}


/* =========================================
   REGISTER
========================================= */


async function registerUser() {

    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;

    const age =
        document.getElementById("registerAge").value;

    const height =
        document.getElementById("registerHeight").value;

    const weight =
        document.getElementById("registerWeight").value;

    const healthGoal =
        document.getElementById("registerGoal").value;

    const message =
        document.getElementById("registerMessage");


    if (!name || !email || !password) {

        message.textContent =
            "Please enter name, email and password.";

        return;

    }


    try {

        message.textContent = "Creating account...";


        const response = await fetch(
            `${API}/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    name: name,

                    email: email,

                    password: password,

                    age: age ? Number(age) : null,

                    height: height ? Number(height) : null,

                    weight: weight ? Number(weight) : null,

                    health_goal:
                        healthGoal || null

                })

            }
        );


        const data = await response.json();


        if (!response.ok) {

            message.textContent =
                data.detail ||
                "Unable to create account.";

            return;

        }


        message.textContent =
            "Account created successfully. Logging you in...";


        document.getElementById("loginEmail").value =
            email;

        document.getElementById("loginPassword").value =
            password;


        setTimeout(() => {

            showLogin();

            document.getElementById("loginEmail").value =
                email;

            document.getElementById("loginPassword").value =
                password;

        }, 700);


    } catch (error) {

        console.error(error);

        message.textContent =
            "Could not connect to AERIVA server.";

    }

}


/* =========================================
   LOGIN
========================================= */


async function loginUser() {

    const email =
        document
            .getElementById("loginEmail")
            .value
            .trim();

    const password =
        document
            .getElementById("loginPassword")
            .value;

    const message =
        document.getElementById("loginMessage");


    if (!email || !password) {

        message.textContent =
            "Please enter email and password.";

        return;
    }


    try {

        message.textContent =
            "Logging in...";


        const response =
            await fetch(
                `${API}/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            message.textContent =
                data.detail ||
                "Invalid email or password.";

            return;
        }


        /*
         * Save JWT token
         */

        authToken =
            data.access_token;


        localStorage.setItem(
            "aeriva_token",
            authToken
        );


        /*
         * Get the complete user profile.
         *
         * /me tells us whether the user
         * has completed onboarding.
         */

        const meResponse =
            await fetch(
                `${API}/me`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${authToken}`
                    }
                }
            );


        if (!meResponse.ok) {

            throw new Error(
                "Could not load user profile."
            );

        }


        currentUser =
            await meResponse.json();

        updateTimeGreeting();


        /*
         * FIRST LOGIN
         *
         * User has not created
         * their BioRhythm yet.
         */

        if (
            currentUser.onboarding_completed === false
        ) {

            showFirstLoginRoutine();

            return;
        }


        /*
         * EXISTING USER
         *
         * User already completed
         * BioRhythm setup.
         */

        await loadDashboard();


    } catch (error) {

        console.error(
            "Login error:",
            error
        );


        message.textContent =
            "Could not connect to AERIVA server.";

    }

}


/* =========================================
   LOAD DASHBOARD
========================================= */
/* =========================================
   LOAD DASHBOARD
========================================= */

async function loadDashboard() {

    const response = await fetch(
        `${API}/me`,
        {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        }
    );

    if (!response.ok) {
        throw new Error("Authentication failed");
    }

    currentUser = await response.json();

    const authScreen = document.getElementById("authScreen");
    const scheduleSetupScreen = document.getElementById("scheduleSetupScreen");
    const dashboardScreen = document.getElementById("dashboardScreen");

    if (authScreen) authScreen.classList.add("hidden");
    if (scheduleSetupScreen) scheduleSetupScreen.classList.add("hidden");
    if (dashboardScreen) dashboardScreen.classList.remove("hidden");

    const userName = document.getElementById("userName");
    if (userName) {
        userName.textContent = currentUser.name || "PLAYER";
    }

    await loadFood();
    await loadRoutine();
    updateSuggestion();
}


/* =========================================
   FIRST LOGIN — BIORHYTHM SETUP
========================================= */


function showFirstLoginRoutine() {

    const authScreen =
        document.getElementById(
            "authScreen"
        );

    const scheduleSetupScreen =
        document.getElementById(
            "scheduleSetupScreen"
        );

    const dashboardScreen =
        document.getElementById(
            "dashboardScreen"
        );


    /*
     * Hide login screen
     */

    if (authScreen) {

        authScreen.classList.add(
            "hidden"
        );

    }


    /*
     * Hide dashboard
     */

    if (dashboardScreen) {

        dashboardScreen.classList.add(
            "hidden"
        );

    }


    /*
     * Show BioRhythm setup
     */

    if (scheduleSetupScreen) {

        scheduleSetupScreen.classList.remove(
            "hidden"
        );

    }


    /*
     * Clear previous message
     */

    const message =
        document.getElementById(
            "firstScheduleMessage"
        );


    if (message) {

        message.textContent = "";

    }

}


/* =========================================
   UPDATE DATE + TIME AWARENESS
========================================= */


function getTimeGreeting(date = new Date()) {

    const hour = date.getHours();


    if (hour >= 5 && hour < 12) {

        return {
            text: "Good Morning",
            icon: "🌅"
        };

    }


    if (hour >= 12 && hour < 17) {

        return {
            text: "Good Afternoon",
            icon: "☀️"
        };

    }


    if (hour >= 17 && hour < 21) {

        return {
            text: "Good Evening",
            icon: "🌆"
        };

    }


    return {
        text: "Good Night",
        icon: "🌙"
    };

}


function getCurrentDateText(date = new Date()) {

    return date.toLocaleDateString(
        "en-IN",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );

}


function updateTimeGreeting() {

    const now =
        new Date();


    const greeting =
        getTimeGreeting(now);


    const dateText =
        getCurrentDateText(now);


    const currentDate =
        document.getElementById(
            "currentDate"
        );


    if (currentDate) {

        currentDate.textContent =
            dateText;

    }


    let greetingElement =
        document.getElementById(
            "timeGreeting"
        );


    /*
     * Create the greeting automatically
     * if index.html does not already contain it.
     */

    if (!greetingElement) {

        const dashboardScreen =
            document.getElementById(
                "dashboardScreen"
            );


        if (dashboardScreen) {

            greetingElement =
                document.createElement(
                    "div"
                );


            greetingElement.id =
                "timeGreeting";


            greetingElement.style.marginBottom =
                "16px";


            greetingElement.style.padding =
                "14px 18px";


            greetingElement.style.borderRadius =
                "16px";


            greetingElement.style.background =
                "rgba(255,255,255,0.06)";


            greetingElement.style.border =
                "1px solid rgba(255,255,255,0.10)";


            greetingElement.style.backdropFilter =
                "blur(10px)";


            dashboardScreen.prepend(
                greetingElement
            );

        }

    }


    if (greetingElement) {

        const name =
            currentUser &&
            currentUser.name
                ? `, ${escapeHTML(currentUser.name)}`
                : "";


        greetingElement.innerHTML = `

            <div
                style="
                    font-size:1.25rem;
                    font-weight:700;
                "
            >

                ${greeting.icon}

                ${greeting.text}${name}

            </div>


            <small
                style="
                    opacity:0.75;
                "
            >

                ${dateText}

            </small>

        `;

    }

}


function updateDate() {

    updateTimeGreeting();

}


function startTimeAwareness() {

    updateTimeGreeting();


    if (timeAwarenessInterval) {

        clearInterval(
            timeAwarenessInterval
        );

    }


    timeAwarenessInterval =
        setInterval(
            updateTimeGreeting,
            60 * 1000
        );

}


/* =========================================
   FOOD MODAL
========================================= */


function openFoodModal() {

    document
        .getElementById("foodModal")
        .classList.remove("hidden");


    document.getElementById("foodMessage")
        .textContent = "";

}


function closeFoodModal() {

    document
        .getElementById("foodModal")
        .classList.add("hidden");

}


/* =========================================
   SAVE FOOD
========================================= */


async function saveFood() {

    const mealType =
        document.getElementById("foodMeal").value;

    const foodName =
        document
            .getElementById("foodName")
            .value
            .trim();

    const quantity =
        Number(
            document
                .getElementById("foodQuantity")
                .value
        );

    const message =
        document.getElementById("foodMessage");


    if (!foodName || !quantity || quantity <= 0) {

        message.textContent =
            "Enter food name and quantity.";

        return;

    }


    try {

        message.textContent =
            "Saving food...";


        const response = await fetch(
            `${API}/food/log`,
            {
                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${authToken}`

                },

                body: JSON.stringify({

                    meal_type:
                        mealType,

                    food_name:
                        foodName,

                    quantity:
                        quantity

                })

            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            message.textContent =
                data.detail ||
                "Unable to save food.";

            return;

        }


        addXP(10);


        document.getElementById("foodName").value =
            "";

        document.getElementById("foodQuantity").value =
            "";


        closeFoodModal();


        await loadFood();


        updateSuggestion();


    } catch (error) {

        console.error(error);

        message.textContent =
            "Could not connect to AERIVA server.";

    }

}


/* =========================================
   LOAD TODAY'S FOOD
========================================= */


async function loadFood() {

    try {

        const response = await fetch(
            `${API}/food/log/today`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${authToken}`
                }
            }
        );


        if (!response.ok) {

            return;

        }


        const foods =
            await response.json();


        const list =
            document.getElementById("foodList");


        if (!foods.length) {

            list.innerHTML = `

                <div class="empty-state">

                    No food logged today.

                </div>

            `;


            document.getElementById(
                "calorieStat"
            ).textContent = "0";


            return;

        }


        let totalCalories = 0;


        list.innerHTML = foods.map(food => {

            totalCalories +=
                Number(food.calories) || 0;


            return `

                <div class="food-item">


                    <div class="food-left">


                        <div class="food-icon">

                            ${getMealIcon(food.meal_type)}

                        </div>


                        <div>


                            <div class="food-name">

                                ${escapeHTML(food.food_name)}

                            </div>


                            <div class="food-meal">

                                ${escapeHTML(food.meal_type)}

                                ·

                                ${food.quantity || ""}

                            </div>


                        </div>


                    </div>


                    <div class="food-calories">

                        ${Math.round(food.calories)}

                        kcal

                    </div>


                </div>

            `;

        }).join("");


        document.getElementById(
            "calorieStat"
        ).textContent =
            Math.round(totalCalories);


    } catch (error) {

        console.error(
            "Food loading error:",
            error
        );

    }

}


/* =========================================
   MEAL ICON
========================================= */


function getMealIcon(meal) {

    switch (meal) {

        case "Breakfast":

            return "🍳";


        case "Lunch":

            return "🍛";


        case "Snack":

            return "🍎";


        case "Dinner":

            return "🍽️";


        default:

            return "🍱";

    }

}


/* =========================================
   ROUTINE MODAL
========================================= */


function openRoutineModal() {

    document
        .getElementById("routineModal")
        .classList.remove("hidden");


    document.getElementById(
        "routineMessage"
    ).textContent = "";

}


function closeRoutineModal() {

    document
        .getElementById("routineModal")
        .classList.add("hidden");

}


/* =========================================
   LOAD ROUTINE
========================================= */


async function loadRoutine() {

    try {

        const response = await fetch(
            `${API}/schedule/weekly`,
            {
                headers: {
                    "Authorization":
                        `Bearer ${authToken}`
                }
            }
        );


        if (!response.ok) {

            return;

        }


        const schedules =
            await response.json();


        const today =
            getTodayName();


        let schedule =
            schedules.find(
                item =>
                    item.day_of_week
                        .toLowerCase() ===
                    today.toLowerCase()
            );


        if (!schedule && schedules.length) {

            schedule =
                schedules[0];

        }


        const list =
            document.getElementById(
                "routineList"
            );


        if (!schedule) {

            list.innerHTML = `

                <div class="empty-state">

                    No routine found.

                    Click "Edit Routine" to create one.

                </div>

            `;

            return;

        }


        list.innerHTML = `


            ${routineRow(
                "🌅",
                "Wake Up",
                schedule.wake_up_time
            )}


            ${routineRow(
                "🍳",
                "Breakfast",
                schedule.breakfast_time
            )}


            ${routineRow(
                "🍛",
                "Lunch",
                schedule.lunch_time
            )}


            ${routineRow(
                "🍎",
                "Snack",
                schedule.snack_time
            )}


            ${routineRow(
                "🍽️",
                "Dinner",
                schedule.dinner_time
            )}


            ${routineRow(
                "🏃",
                "Exercise / Work",
                `${schedule.work_start_time} - ${schedule.work_end_time}`
            )}


            ${routineRow(
                "🎮",
                "Free Time",
                `${schedule.free_start_time} - ${schedule.free_end_time}`
            )}


            ${routineRow(
                "🌙",
                "Sleep",
                schedule.sleep_time
            )}


        `;


        fillRoutineForm(schedule);


        updateSleepEstimate(
            schedule.sleep_time,
            schedule.wake_up_time
        );


    } catch (error) {

        console.error(
            "Routine loading error:",
            error
        );

    }

}


/* =========================================
   ROUTINE ROW
========================================= */


function routineRow(icon, label, time) {

    return `

        <div class="routine-item">

            <div>

                <span>

                    ${icon}

                </span>


                <span class="routine-label">

                    ${label}

                </span>

            </div>


            <div class="routine-time">

                ${time || "--"}

            </div>

        </div>

    `;

}


/* =========================================
   GET TODAY
========================================= */


function getTodayName() {

    const days = [

        "Sunday",

        "Monday",

        "Tuesday",

        "Wednesday",

        "Thursday",

        "Friday",

        "Saturday"

    ];


    return days[
        new Date().getDay()
    ];

}


/* =========================================
   FILL ROUTINE FORM
========================================= */


function fillRoutineForm(schedule) {

    document.getElementById(
        "routineWake"
    ).value =
        schedule.wake_up_time || "";


    document.getElementById(
        "routineBreakfast"
    ).value =
        schedule.breakfast_time || "";


    document.getElementById(
        "routineLunch"
    ).value =
        schedule.lunch_time || "";


    document.getElementById(
        "routineSnack"
    ).value =
        schedule.snack_time || "";


    document.getElementById(
        "routineDinner"
    ).value =
        schedule.dinner_time || "";


    document.getElementById(
        "routineWorkStart"
    ).value =
        schedule.work_start_time || "";


    document.getElementById(
        "routineWorkEnd"
    ).value =
        schedule.work_end_time || "";


    document.getElementById(
        "routineFreeStart"
    ).value =
        schedule.free_start_time || "";


    document.getElementById(
        "routineFreeEnd"
    ).value =
        schedule.free_end_time || "";


    document.getElementById(
        "routineSleep"
    ).value =
        schedule.sleep_time || "";

}


/* =========================================
   SAVE ROUTINE
========================================= */


async function saveRoutine() {

    const message =
        document.getElementById(
            "routineMessage"
        );


    const schedule = {

        day_of_week:
            getTodayName(),

        wake_up_time:
            getValue("routineWake"),

        breakfast_time:
            getValue("routineBreakfast"),

        lunch_time:
            getValue("routineLunch"),

        snack_time:
            getValue("routineSnack"),

        dinner_time:
            getValue("routineDinner"),

        work_start_time:
            getValue("routineWorkStart"),

        work_end_time:
            getValue("routineWorkEnd"),

        free_start_time:
            getValue("routineFreeStart"),

        free_end_time:
            getValue("routineFreeEnd"),

        sleep_time:
            getValue("routineSleep")

    };


    const requiredFields = [

        schedule.wake_up_time,

        schedule.breakfast_time,

        schedule.lunch_time,

        schedule.snack_time,

        schedule.dinner_time,

        schedule.work_start_time,

        schedule.work_end_time,

        schedule.free_start_time,

        schedule.free_end_time,

        schedule.sleep_time

    ];


    if (
        requiredFields.some(
            value => !value
        )
    ) {

        message.textContent =
            "Please fill all routine times.";

        return;

    }


    try {

        message.textContent =
            "Saving routine...";


        /*
         * The backend expects exactly
         * 7 daily schedules.
         *
         * We first load the existing
         * weekly schedule.
         */

        const existingResponse =
            await fetch(
                `${API}/schedule/weekly`,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${authToken}`
                    }
                }
            );


        let existingSchedules = [];


        if (existingResponse.ok) {

            existingSchedules =
                await existingResponse.json();

        }


        /*
         * Replace today's schedule.
         */

        const weekly = [];


        const days = [

            "Monday",

            "Tuesday",

            "Wednesday",

            "Thursday",

            "Friday",

            "Saturday",

            "Sunday"

        ];


        for (const day of days) {

            const existing =
                existingSchedules.find(
                    item =>
                        item.day_of_week
                            .toLowerCase() ===
                        day.toLowerCase()
                );


            if (
                day.toLowerCase() ===
                schedule.day_of_week.toLowerCase()
            ) {

                weekly.push(schedule);


            } else if (existing) {

                weekly.push({

                    day_of_week:
                        existing.day_of_week,

                    wake_up_time:
                        existing.wake_up_time,

                    breakfast_time:
                        existing.breakfast_time,

                    lunch_time:
                        existing.lunch_time,

                    snack_time:
                        existing.snack_time,

                    dinner_time:
                        existing.dinner_time,

                    work_start_time:
                        existing.work_start_time,

                    work_end_time:
                        existing.work_end_time,

                    free_start_time:
                        existing.free_start_time,

                    free_end_time:
                        existing.free_end_time,

                    sleep_time:
                        existing.sleep_time

                });


            } else {

                /*
                 * If a day does not exist yet,
                 * use today's routine as a
                 * temporary default.
                 */

                weekly.push({

                    day_of_week: day,

                    wake_up_time:
                        schedule.wake_up_time,

                    breakfast_time:
                        schedule.breakfast_time,

                    lunch_time:
                        schedule.lunch_time,

                    snack_time:
                        schedule.snack_time,

                    dinner_time:
                        schedule.dinner_time,

                    work_start_time:
                        schedule.work_start_time,

                    work_end_time:
                        schedule.work_end_time,

                    free_start_time:
                        schedule.free_start_time,

                    free_end_time:
                        schedule.free_end_time,

                    sleep_time:
                        schedule.sleep_time

                });

            }

        }


        const response =
            await fetch(
                `${API}/schedule/weekly`,
                {
                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${authToken}`

                    },

                    body: JSON.stringify({

                        schedules: weekly

                    })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            message.textContent =
                data.detail ||
                "Unable to save routine.";

            return;

        }


        addXP(25);


        message.textContent =
            "Routine saved successfully!";


        await loadRoutine();


        setTimeout(() => {

            closeRoutineModal();

        }, 700);


        updateSuggestion();


    } catch (error) {

        console.error(error);

        message.textContent =
            "Could not connect to AERIVA server.";

    }

}


/* =========================================
   GET INPUT VALUE
========================================= */


function getValue(id) {

    return document
        .getElementById(id)
        .value;

}


/* =========================================
   SLEEP ESTIMATE
========================================= */


function updateSleepEstimate(
    sleepTime,
    wakeTime
) {

    if (!sleepTime || !wakeTime) {

        return;

    }


    const sleep =
        timeToMinutes(sleepTime);


    const wake =
        timeToMinutes(wakeTime);


    let difference =
        wake - sleep;


    if (difference <= 0) {

        difference += 24 * 60;

    }


    const hours =
        difference / 60;


    document.getElementById(
        "sleepStat"
    ).textContent =
        `${hours.toFixed(1)}h`;

}


/* =========================================
   TIME TO MINUTES
========================================= */


function timeToMinutes(time) {

    const parts =
        time.split(":");


    return (
        Number(parts[0]) * 60 +
        Number(parts[1])
    );

}


/* =========================================
   AI SUGGESTION
========================================= */


function updateSuggestion() {

    const element =
        document.getElementById(
            "aiSuggestion"
        );


    const hour =
        new Date().getHours();


    if (hour < 8) {

        element.textContent =
            "Good morning! Start your day with water and a healthy breakfast.";

    } else if (hour < 12) {

        element.textContent =
            "Keep your energy up. Stay hydrated and avoid skipping lunch.";

    } else if (hour < 17) {

        element.textContent =
            "Take a short movement break and keep working toward your hydration goal.";

    } else if (hour < 21) {

        element.textContent =
            "It's a good time for today's workout. Complete one exercise quest.";

    } else {

        element.textContent =
            "Wind down for the day and prepare for a consistent sleep schedule.";

    }

}


/* =========================================
   EXERCISE
========================================= */


function completeExercise(points) {

    addXP(points);


    const exerciseStat =
        document.getElementById(
            "exerciseStat"
        );


    const current =
        parseInt(
            exerciseStat.textContent
        ) || 0;


    exerciseStat.textContent =
        `${current + 5} min`;


    document.getElementById(
        "aiSuggestion"
    ).textContent =
        "Nice work! Exercise quest completed. Keep your momentum going.";

}


/* =========================================
   WATER
========================================= */


function addWater() {

    waterAmount += 0.25;


    if (waterAmount > 2.5) {

        waterAmount = 2.5;

    }


    const percentage =
        (waterAmount / 2.5) * 100;


    document.getElementById(
        "waterProgress"
    ).style.width =
        `${percentage}%`;


    document.getElementById(
        "waterText"
    ).textContent =
        `${waterAmount.toFixed(2)} L / 2.5 L`;


    document.getElementById(
        "waterStat"
    ).textContent =
        `${waterAmount.toFixed(2)} L`;


    addXP(5);

}


/* =========================================
   XP
========================================= */


function addXP(points) {

    xp += points;


    localStorage.setItem(
        "aeriva_xp",
        xp
    );


    updateXP();

}


function updateXP() {

    const element =
        document.getElementById(
            "xpValue"
        );


    if (element) {

        element.textContent =
            xp;

    }

}


/* =========================================
   LOGOUT
========================================= */


function logoutUser() {

    localStorage.removeItem(
        "aeriva_token"
    );


    authToken = null;

    currentUser = null;


    document
        .getElementById("dashboardScreen")
        .classList.add("hidden");


    document
        .getElementById("authScreen")
        .classList.remove("hidden");


    showLogin();

}


/* =========================================
   HTML SAFETY
========================================= */


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}


/* =========================================
   FIRST LOGIN ONBOARDING SUBMISSION
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const firstScheduleForm = document.getElementById("firstScheduleForm");

    if (firstScheduleForm) {
        firstScheduleForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const message = document.getElementById("firstScheduleMessage");
            if (message) message.textContent = "Synchronizing biorhythm...";

            const wakeUp = document.getElementById("firstWakeUp").value;
            const sleep = document.getElementById("firstSleep").value;
            const breakfast = document.getElementById("firstBreakfast").value;
            const lunch = document.getElementById("firstLunch").value;
            const snack = document.getElementById("firstSnack").value;
            const dinner = document.getElementById("firstDinner").value;
            const workStart = document.getElementById("firstWorkStart").value;
            const workEnd = document.getElementById("firstWorkEnd").value;
            const freeStart = document.getElementById("firstFreeStart").value;
            const freeEnd = document.getElementById("firstFreeEnd").value;

            const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            const weeklySchedules = days.map(day => ({
                day_of_week: day,
                wake_up_time: wakeUp,
                breakfast_time: breakfast,
                lunch_time: lunch,
                snack_time: snack,
                dinner_time: dinner,
                work_start_time: workStart,
                work_end_time: workEnd,
                free_start_time: freeStart,
                free_end_time: freeEnd,
                sleep_time: sleep
            }));

            try {
                const response = await fetch(`${API}/schedule/weekly`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ schedules: weeklySchedules })
                });

                const data = await response.json();

                if (!response.ok) {
                    if (message) message.textContent = data.detail || "Unable to save schedule.";
                    return;
                }

                if (message) message.textContent = "Biorhythm synchronized successfully!";
                addXP(50);

                setTimeout(async () => {
                    await loadDashboard();
                }, 600);

            } catch (err) {
                console.error(err);
                if (message) message.textContent = "Server connection error.";
            }
        });
    }
});

/* =========================================
   CLOSE MODALS WITH BACKGROUND CLICK
========================================= */


document.addEventListener(
    "click",
    function(event) {

        const foodModal =
            document.getElementById(
                "foodModal"
            );


        const routineModal =
            document.getElementById(
                "routineModal"
            );


        if (
            event.target === foodModal
        ) {

            closeFoodModal();

        }


        if (
            event.target === routineModal
        ) {

            closeRoutineModal();

        }

    }
);