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
    loadWaterTracker();
    loadStepTracker();
    loadSmartExerciseRecommender();
    loadNextDaySuggestions();
    updateSuggestion();

    // Auto-prompt food log based on current meal time
    await promptMealOnLogin();

    // Check evening steps prompt
    checkNightStepPrompt();
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


/* =========================================================
   AERIVA AI — MULTI-ITEM FOOD, NUTRITION & HABIT SUITE
========================================================= */

function getCurrentDateKey() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 1. Time-Based Meal Detection
function getCurrentMealType() {
    const hour = new Date().getHours();
    const minutes = new Date().getMinutes();
    const currentTime = hour + minutes / 60;

    if (currentTime >= 5 && currentTime < 11.5) {
        return "Breakfast";
    } else if (currentTime >= 11.5 && currentTime < 16) {
        return "Lunch";
    } else if (currentTime >= 16 && currentTime < 19) {
        return "Snack";
    } else {
        return "Dinner";
    }
}

function updateFoodModalTitle(meal) {
    const title = document.getElementById("foodModalTitle");
    const subtitle = document.getElementById("foodModalSubtitle");
    if (title) {
        title.textContent = `Log Your ${meal}`;
    }
    if (subtitle) {
        subtitle.textContent = `What did you eat for ${meal.toLowerCase()}? Add all items below.`;
    }
}

// Multi-Item Rows in Food Modal with Indian Food Autocomplete Search
let foodItemCounter = 0;
let foodDatabaseCache = [];

async function ensureFoodDatabase() {
    if (foodDatabaseCache && foodDatabaseCache.length > 0) return foodDatabaseCache;
    try {
        const res = await fetch(`${API}/food/database`);
        if (res.ok) {
            const data = await res.json();
            foodDatabaseCache = data.items || [];
        }
    } catch (e) {
        console.warn("Could not preload food database:", e);
    }
    return foodDatabaseCache;
}

// Preload food database in background on start
ensureFoodDatabase();

function addFoodItemRow(foodName = "", quantity = 1) {
    foodItemCounter++;
    const rowId = "foodRow_" + foodItemCounter;
    const container = document.getElementById("multiFoodContainer");
    if (!container) return;

    const row = document.createElement("div");
    row.id = rowId;
    row.style.cssText = "display: flex; gap: 8px; align-items: center; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 10px; position: relative;";

    row.innerHTML = `
        <div class="food-input-wrapper" style="flex: 2; position: relative;">
            <input 
                type="text" 
                class="food-item-name" 
                style="width: 100%; font-size: 13px;" 
                placeholder="Search Indian food (Dosa, Biryani, Roti, Dal...)" 
                value="${escapeHTML(foodName)}"
                autocomplete="off"
                oninput="handleFoodAutocompleteInput(this)"
                onfocus="handleFoodAutocompleteFocus(this)"
                onkeydown="handleFoodAutocompleteKeydown(event, this)"
            >
            <div class="food-autocomplete-dropdown hidden"></div>
        </div>
        <div style="flex: 1; max-width: 85px;">
            <input 
                type="number" 
                class="food-item-qty" 
                style="width: 100%; font-size: 13px;" 
                min="0.1" 
                step="0.5" 
                value="${quantity}"
                oninput="debouncedUpdateLiveCalories()"
            >
        </div>
        <div style="min-width: 65px; text-align: right; font-size: 11px; font-weight: 800; color: #10B981;" class="food-item-cal">
            --
        </div>
        <button 
            type="button" 
            style="background: transparent; border: none; color: #FDA4AF; cursor: pointer; font-size: 16px; padding: 4px 8px;"
            onclick="removeFoodItemRow('${rowId}')"
            title="Remove item"
        >
            ✕
        </button>
    `;

    container.appendChild(row);
    updateLiveCalories();
}

function removeFoodItemRow(rowId) {
    const row = document.getElementById(rowId);
    const container = document.getElementById("multiFoodContainer");
    if (row && container) {
        if (container.children.length > 1) {
            row.remove();
            updateLiveCalories();
        } else {
            const nameInput = row.querySelector(".food-item-name");
            if (nameInput) nameInput.value = "";
            const calBadge = row.querySelector(".food-item-cal");
            if (calBadge) calBadge.textContent = "0 kcal";
            updateLiveCalories();
        }
    }
}

// Autocomplete Search Handlers (Powered by LangGraph & Groq AI)
let foodSearchDebounceTimer = null;
const clientFoodQueryCache = {};

async function handleFoodAutocompleteInput(input) {
    debouncedUpdateLiveCalories();
    const query = input.value.trim();
    const wrapper = input.closest(".food-input-wrapper");
    if (!wrapper) return;
    const dropdown = wrapper.querySelector(".food-autocomplete-dropdown");
    if (!dropdown) return;

    if (!query || query.length < 2) {
        dropdown.classList.add("hidden");
        dropdown.innerHTML = "";
        return;
    }

    const cacheKey = query.toLowerCase();
    if (clientFoodQueryCache[cacheKey]) {
        renderFoodSuggestions(input, dropdown, clientFoodQueryCache[cacheKey], query);
        return;
    }

    clearTimeout(foodSearchDebounceTimer);
    foodSearchDebounceTimer = setTimeout(async () => {
        try {
            dropdown.innerHTML = `
                <div class="suggestion-empty" style="color: #67E8F9;">
                    ✨ AI is guessing matching foods &amp; calories...
                </div>
            `;
            dropdown.classList.remove("hidden");

            const res = await fetch(`${API}/food/search?q=${encodeURIComponent(query)}&limit=6`);
            if (res.ok) {
                const data = await res.json();
                const results = data.results || [];
                clientFoodQueryCache[cacheKey] = results;
                renderFoodSuggestions(input, dropdown, results, query);
            }
        } catch (e) {
            console.warn("AI Food Search error:", e);
        }
    }, 280);
}

function handleFoodAutocompleteFocus(input) {
    const query = input.value.trim();
    if (query && query.length >= 2) {
        handleFoodAutocompleteInput(input);
    }
}


function renderFoodSuggestions(input, dropdown, items, query) {
    if (!items || items.length === 0) {
        dropdown.innerHTML = `
            <div class="suggestion-empty">
                No matching Indian foods found. Custom items will be automatically calculated!
            </div>
        `;
        dropdown.classList.remove("hidden");
        return;
    }

    dropdown.innerHTML = items.map((item, idx) => {
        let displayName = escapeHTML(item.name);
        if (query) {
            const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
            displayName = displayName.replace(regex, '<span style="color: #67E8F9; text-decoration: underline;">$1</span>');
        }

        return `
            <div 
                class="food-suggestion-item" 
                data-idx="${idx}"
                onmousedown="selectFoodSuggestion(this, '${escapeHTML(item.name)}', ${item.calories})">
                <div class="suggestion-info">
                    <div class="suggestion-name">${displayName}</div>
                    <div class="suggestion-portion">
                        ${escapeHTML(item.portion || "1 serving")} • <span class="suggestion-cat">${escapeHTML(item.category || "Indian Dish")}</span>
                    </div>
                </div>
                <div class="suggestion-cal-badge">
                    ${item.calories} kcal
                </div>
            </div>
        `;
    }).join("");

    dropdown.classList.remove("hidden");
}

function selectFoodSuggestion(element, foodName, calories) {
    const wrapper = element.closest(".food-input-wrapper");
    if (!wrapper) return;
    const input = wrapper.querySelector(".food-item-name");
    const dropdown = wrapper.querySelector(".food-autocomplete-dropdown");
    const row = wrapper.closest("[id^='foodRow_']");

    if (input) {
        input.value = foodName;
    }
    if (dropdown) {
        dropdown.classList.add("hidden");
        dropdown.innerHTML = "";
    }

    if (row) {
        const qtyInput = row.querySelector(".food-item-qty");
        const calBadge = row.querySelector(".food-item-cal");
        const qty = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;
        if (calBadge) {
            calBadge.textContent = `${Math.round(calories * qty)} kcal`;
        }
    }

    updateLiveCalories();
}

function handleFoodAutocompleteKeydown(event, input) {
    const wrapper = input.closest(".food-input-wrapper");
    if (!wrapper) return;
    const dropdown = wrapper.querySelector(".food-autocomplete-dropdown");
    if (!dropdown || dropdown.classList.contains("hidden")) return;

    const items = dropdown.querySelectorAll(".food-suggestion-item");
    if (!items.length) return;

    let activeIdx = -1;
    items.forEach((item, idx) => {
        if (item.classList.contains("active")) activeIdx = idx;
    });

    if (event.key === "ArrowDown") {
        event.preventDefault();
        if (activeIdx < items.length - 1) {
            if (activeIdx >= 0) items[activeIdx].classList.remove("active");
            items[activeIdx + 1].classList.add("active");
            items[activeIdx + 1].scrollIntoView({ block: "nearest" });
        }
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (activeIdx > 0) {
            items[activeIdx].classList.remove("active");
            items[activeIdx - 1].classList.add("active");
            items[activeIdx - 1].scrollIntoView({ block: "nearest" });
        }
    } else if (event.key === "Enter") {
        if (activeIdx >= 0 && items[activeIdx]) {
            event.preventDefault();
            items[activeIdx].dispatchEvent(new MouseEvent('mousedown'));
        }
    } else if (event.key === "Escape") {
        dropdown.classList.add("hidden");
    }
}

// Dismiss all dropdowns on outside click
document.addEventListener("click", (e) => {
    if (!e.target.closest(".food-input-wrapper")) {
        document.querySelectorAll(".food-autocomplete-dropdown").forEach(d => {
            d.classList.add("hidden");
        });
    }
});

let liveCalorieTimeout = null;
function debouncedUpdateLiveCalories() {
    clearTimeout(liveCalorieTimeout);
    liveCalorieTimeout = setTimeout(updateLiveCalories, 200);
}

async function updateLiveCalories() {
    const container = document.getElementById("multiFoodContainer");
    const totalDisplay = document.getElementById("modalTotalCalories");
    if (!container || !totalDisplay) return;

    const rows = container.children;
    let totalCals = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nameInput = row.querySelector(".food-item-name");
        const qtyInput = row.querySelector(".food-item-qty");
        const calBadge = row.querySelector(".food-item-cal");

        const name = nameInput ? nameInput.value.trim() : "";
        const qty = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;

        if (name) {
            try {
                const res = await fetch(`${API}/food/estimate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ food_name: name, quantity: qty })
                });
                if (res.ok) {
                    const data = await res.json();
                    const cals = Math.round(data.calories || 0);
                    if (calBadge) calBadge.textContent = `${cals} kcal`;
                    totalCals += cals;
                } else {
                    if (calBadge) calBadge.textContent = "--";
                }
            } catch (e) {
                if (calBadge) calBadge.textContent = "--";
            }
        } else {
            if (calBadge) calBadge.textContent = "--";
        }
    }

    totalDisplay.textContent = `${Math.round(totalCals)} kcal`;
}


// =====================================================
// AI VISION FOOD SCANNER & PORTION RECOGNITION
// =====================================================

function triggerFoodImageUpload(event) {
    if (event) {
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
        if (typeof event.preventDefault === 'function') event.preventDefault();
    }
    const input = document.getElementById("foodImageInput");
    if (input) {
        input.value = ""; // Reset so selecting the same file fires change event every time
        input.click();
    }
}

function initFoodScannerDragDrop() {
    const dropzone = document.getElementById("scannerDropzone");
    if (!dropzone || dropzone.dataset.dragReady) return;
    dropzone.dataset.dragReady = "true";

    ['dragenter', 'dragover'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.style.borderColor = '#06B6D4';
            dropzone.style.background = 'rgba(6, 182, 212, 0.12)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.style.borderColor = '';
            dropzone.style.background = '';
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length) {
            const input = document.getElementById("foodImageInput");
            if (input) {
                input.files = dt.files;
                handleFoodImageSelected(input);
            }
        }
    }, false);
}

function resetFoodImageScannerUI() {
    const resultBox = document.getElementById("scannerResultBox");
    const fileInput = document.getElementById("foodImageInput");
    const scanPulse = document.getElementById("scannerScanningPulse");
    if (resultBox) resultBox.classList.add("hidden");
    if (scanPulse) scanPulse.classList.remove("hidden");
    if (fileInput) fileInput.value = "";
    initFoodScannerDragDrop();
}

async function handleFoodImageSelected(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];

    const resultBox = document.getElementById("scannerResultBox");
    const previewImg = document.getElementById("scannedImagePreview");
    const scanPulse = document.getElementById("scannerScanningPulse");
    const detailsContainer = document.getElementById("scannerDetectedDetails");

    if (resultBox) resultBox.classList.remove("hidden");
    if (scanPulse) scanPulse.classList.remove("hidden");

    // Display image preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        if (previewImg) previewImg.src = e.target.result;
    };
    reader.readAsDataURL(file);

    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <div style="padding: 10px 0;">
                <div style="font-size: 13px; font-weight: 800; color: #67E8F9; margin-bottom: 4px;">
                    ⚡ Analyzing with Groq Vision AI...
                </div>
                <div style="font-size: 11px; color: #94A3B8; line-height: 1.4;">
                    Identifying dish name, detecting visible portion size, and calculating nutritional values.
                </div>
            </div>
        `;
    }

    try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API}/food/scan-image`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Image analysis failed");
        }

        const data = await response.json();

        // Hide scanning radar pulse
        if (scanPulse) scanPulse.classList.add("hidden");

        const foodName = data.food_name || "Identified Dish";
        const quantity = parseFloat(data.quantity) || 1.0;
        const portionDesc = data.portion_description || `${quantity} serving`;
        const calories = Math.round(data.calories || 0);
        const macros = data.macros || { protein: 0, carbs: 0, fat: 0 };
        const explanation = data.explanation || "AI vision detected this food item and estimated the serving size.";

        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="scanner-detected-header">
                    <div>
                        <div style="font-size: 9px; font-weight: 900; letter-spacing: 0.08em; color: #10B981;">✓ DISH RECOGNIZED</div>
                        <h4 class="scanner-dish-name">${escapeHTML(foodName)}</h4>
                    </div>
                    <div class="scanner-cal-tag">
                        ${calories} kcal
                    </div>
                </div>

                <div class="scanner-portion-line">
                    <span>👁️ Visible Portion:</span>
                    <strong style="color: #F8FAFC;">${escapeHTML(portionDesc)}</strong>
                    <span style="color: #64748B;">(Qty: ${quantity})</span>
                </div>

                <div class="scanner-macros-row">
                    <span class="scanner-macro-pill">Protein: <strong>${macros.protein || 0}g</strong></span>
                    <span class="scanner-macro-pill">Carbs: <strong>${macros.carbs || 0}g</strong></span>
                    <span class="scanner-macro-pill">Fat: <strong>${macros.fat || 0}g</strong></span>
                </div>

                <div class="scanner-explanation-text" title="${escapeHTML(explanation)}">
                    "${escapeHTML(explanation)}"
                </div>

                <div class="scanner-success-badge">
                    <span>✓ Added to meal items list below</span>
                    <button type="button" class="scanner-rescan-btn" onclick="triggerFoodImageUpload()">Scan Another Photo</button>
                </div>
            `;
        }

        // Auto-fill or append to meal items
        applyScannedFoodToRows(foodName, quantity, calories);

    } catch (error) {
        console.error("AI Food scan error:", error);
        if (scanPulse) scanPulse.classList.add("hidden");
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <div style="padding: 8px 0;">
                    <div style="font-size: 13px; font-weight: 800; color: #FDA4AF; margin-bottom: 4px;">
                        ⚠️ Recognition Failed
                    </div>
                    <div style="font-size: 11px; color: #94A3B8; margin-bottom: 8px;">
                        ${escapeHTML(error.message || "Could not analyze this image. Please try another clear photo.")}
                    </div>
                    <button type="button" class="mini-button" style="border-color: rgba(6, 182, 212, 0.4); color: #67E8F9;" onclick="triggerFoodImageUpload()">
                        TRY ANOTHER PHOTO
                    </button>
                </div>
            `;
        }
    }
}

function applyScannedFoodToRows(foodName, quantity, calories) {
    const container = document.getElementById("multiFoodContainer");
    if (!container) return;

    let targetRow = null;
    const rows = container.children;

    // Check if the first row is empty
    if (rows.length > 0) {
        const firstRow = rows[0];
        const nameInput = firstRow.querySelector(".food-item-name");
        if (nameInput && !nameInput.value.trim()) {
            targetRow = firstRow;
        }
    }

    if (targetRow) {
        const nameInput = targetRow.querySelector(".food-item-name");
        const qtyInput = targetRow.querySelector(".food-item-qty");
        const calBadge = targetRow.querySelector(".food-item-cal");

        if (nameInput) nameInput.value = foodName;
        if (qtyInput) qtyInput.value = quantity;
        if (calBadge) calBadge.textContent = `${calories} kcal`;
    } else {
        // Append a new row with detected item
        addFoodItemRow(foodName, quantity);
    }

    debouncedUpdateLiveCalories();
}


function openFoodModal(suggestedMeal = null, autoScan = false) {
    const meal = suggestedMeal || getCurrentMealType();
    const mealSelect = document.getElementById("foodMeal");
    if (mealSelect) {
        mealSelect.value = meal;
    }

    updateFoodModalTitle(meal);
    resetFoodImageScannerUI();

    const container = document.getElementById("multiFoodContainer");
    if (container) {
        container.innerHTML = "";
        foodItemCounter = 0;
        addFoodItemRow("", 1);
    }

    const modal = document.getElementById("foodModal");
    if (modal) {
        modal.classList.remove("hidden");
    }

    const message = document.getElementById("foodMessage");
    if (message) {
        message.textContent = "";
    }

    if (autoScan) {
        setTimeout(() => {
            triggerFoodImageUpload();
        }, 300);
    }
}

function closeFoodModal() {
    const modal = document.getElementById("foodModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// Save Multi-Item Meal
async function saveMultiFood() {
    authToken = authToken || localStorage.getItem("aeriva_token");
    const mealType = document.getElementById("foodMeal").value || getCurrentMealType();
    const container = document.getElementById("multiFoodContainer");
    const message = document.getElementById("foodMessage");

    if (!authToken) {
        if (message) message.textContent = "Please log in first.";
        return;
    }

    if (!container) return;
    const rows = container.children;
    const items = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const nameInput = row.querySelector(".food-item-name");
        const qtyInput = row.querySelector(".food-item-qty");
        const name = nameInput ? nameInput.value.trim() : "";
        const qty = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;

        if (name) {
            items.push({ food_name: name, quantity: qty });
        }
    }

    if (items.length === 0) {
        if (message) message.textContent = "Please enter at least one food item.";
        return;
    }

    try {
        if (message) message.textContent = "Calculating & saving meal items...";

        const res = await fetch(`${API}/food/log/batch`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({
                meal_type: mealType,
                items: items
            })
        });

        if (!res.ok) {
            const err = await res.json();
            if (message) message.textContent = err.detail || "Error saving food items.";
            return;
        }

        addXP(15);
        closeFoodModal();
        await loadFood();
        updateSuggestion();

    } catch (error) {
        console.error("Food save error:", error);
        if (message) message.textContent = "Could not connect to AERIVA server.";
    }
}

async function saveFood() {
    await saveMultiFood();
}

// Skip Meal Handler
async function skipMeal() {
    authToken = authToken || localStorage.getItem("aeriva_token");
    const mealType = document.getElementById("foodMeal").value || getCurrentMealType();

    if (!authToken) return;

    closeFoodModal();

    try {
        await fetch(`${API}/food/log`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({
                meal_type: mealType,
                food_name: `Skipped ${mealType}`,
                quantity: 1.0
            })
        });

        addXP(5);
        await loadFood();
        updateSuggestion();
    } catch (error) {
        console.error("Could not record skipped meal:", error);
    }
}

// Prompt on Login
async function promptMealOnLogin() {
    authToken = authToken || localStorage.getItem("aeriva_token");
    if (!authToken) return;

    const currentMeal = getCurrentMealType();
    setTimeout(() => {
        openFoodModal(currentMeal);
    }, 600);
}

// Load Today's Food & Calculate Total Calories & Diet Advisor
async function loadFood() {
    authToken = authToken || localStorage.getItem("aeriva_token");
    if (!authToken) return;

    try {
        const response = await fetch(`${API}/food/log/today`, {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            return;
        }

        const foods = await response.json();
        const list = document.getElementById("foodList");
        const calorieStat = document.getElementById("calorieStat");

        if (!foods.length) {
            if (list) {
                list.innerHTML = `
                    <div class="empty-state">
                        No meals logged yet today.
                    </div>
                `;
            }
            if (calorieStat) calorieStat.textContent = "0";
            updateDietAdvisor([]);
            loadSmartExerciseRecommender(0);
            loadNextDaySuggestions();
            return;
        }

        let totalCalories = 0;

        if (list) {
            list.innerHTML = foods.map(food => {
                const isSkipped = food.food_name && food.food_name.toLowerCase().includes("skip");
                const cals = Math.round(Number(food.calories) || 0);
                totalCalories += cals;

                if (isSkipped) {
                    return `
                        <div class="food-item" style="border-left: 3px solid #FDA4AF; opacity: 0.85;">
                            <div class="food-left">
                                <div class="food-icon" style="background: rgba(244, 63, 94, 0.15); color: #FDA4AF;">
                                    ✕
                                </div>
                                <div>
                                    <div class="food-name" style="color: #FDA4AF; font-weight: 700;">
                                        ${escapeHTML(food.meal_type)} Skipped
                                    </div>
                                    <div class="food-meal" style="color: #94A3B8;">
                                        0 kcal · Recorded
                                    </div>
                                </div>
                            </div>
                            <div class="food-calories" style="color: #94A3B8;">
                                0 kcal
                            </div>
                        </div>
                    `;
                }

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
                                    ${escapeHTML(food.meal_type)} · ${food.quantity || "1"} serving
                                </div>
                            </div>
                        </div>
                        <div class="food-calories" style="color: #10B981; font-weight: 800;">
                            ${cals} kcal
                        </div>
                    </div>
                `;
            }).join("");
        }

        if (calorieStat) {
            calorieStat.textContent = Math.round(totalCalories);
        }

        // Run smart diet advisor
        updateDietAdvisor(foods);

        // Run smart exercise recommender & next-day suggestions
        loadSmartExerciseRecommender(totalCalories);
        loadNextDaySuggestions();

    } catch (error) {
        console.error("Food loading error:", error);
    }
}

// 2. Smart Diet & Junk Food Health Advisor
const JUNK_FOOD_KEYWORDS = [
    "pizza", "burger", "french fries", "fries", "chips", "samosa", "kachori",
    "pakora", "bhajji", "vada pav", "bhature", "chole bhature", "puri", "poori",
    "cold drink", "soda", "coke", "pepsi", "sprite", "thums up", "fanta", "mirinda",
    "maggi", "noodles", "instant noodles", "fried momos", "jalebi", "cake",
    "pastry", "ice cream", "donut", "kurkure"
];

const HEALTHY_SWAPS = {
    "samosa": "Roasted Makhana, Sprout Bhel, or Steamed Dhokla",
    "pakora": "Air-fried Paneer Tikka or Roasted Chana",
    "kachori": "Moong Dal Cheela with Mint Chutney",
    "vada pav": "Paneer Roti Roll or Idli Sambhar",
    "chole bhature": "Phulka with Chole Masala",
    "puri": "Chapati or Phulka with vegetable sabzi",
    "cold drink": "Fresh Mint Buttermilk (Chaas), Tender Coconut, or Lemon Shikanji",
    "soda": "Sparkling water with fresh lemon & mint",
    "coke": "Chilled Tender Coconut Water or Fresh Chaas",
    "pepsi": "Fresh Chaas or Jaljeera",
    "pizza": "Whole Wheat Paneer Wrap or Besan Cheela Pizza",
    "burger": "Paneer Tikka Roll or Sprouted Bean Patty",
    "fries": "Baked Sweet Potato Wedges or Roasted Peanuts",
    "maggi": "Vegetable Oats Upma or Millet Vermicelli",
    "instant noodles": "Vegetable Poha or Brown Rice Noodles",
    "jalebi": "Dates & Nuts Ladoo or Apple with Cinnamon"
};

function updateDietAdvisor(foods) {
    const container = document.getElementById("dietAdvisorContainer");
    if (!container) return;

    if (!foods || foods.length === 0) {
        container.innerHTML = `
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 12px; font-size: 11px; color: #94A3B8; text-align: center;">
                🥗 Log your meals above. AERIVA will analyze nutritional balance and warn of junk foods.
            </div>
        `;
        return;
    }

    const detectedJunk = [];
    const recommendedSwaps = [];

    foods.forEach(f => {
        const name = (f.food_name || "").toLowerCase();
        JUNK_FOOD_KEYWORDS.forEach(kw => {
            if (name.includes(kw) && !detectedJunk.includes(kw)) {
                detectedJunk.push(kw);
                if (HEALTHY_SWAPS[kw] && !recommendedSwaps.includes(HEALTHY_SWAPS[kw])) {
                    recommendedSwaps.push({ item: kw, swap: HEALTHY_SWAPS[kw] });
                }
            }
        });
    });

    if (detectedJunk.length > 0) {
        const formattedJunkList = detectedJunk.map(j => j.toUpperCase()).join(", ");
        const swapItemsHtml = recommendedSwaps.map(s => 
            `<div style="margin-top: 4px; font-size: 11px; color: #E2E8F0;">
                • Instead of <strong style="color: #FDA4AF;">${s.item}</strong>: Try <strong style="color: #6EE7B7;">${s.swap}</strong>
            </div>`
        ).join("");

        container.innerHTML = `
            <div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 14px; padding: 14px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span style="font-size: 16px;">⚠️</span>
                    <strong style="color: #FDA4AF; font-size: 12px; letter-spacing: 0.05em; text-transform: uppercase;">Junk Food Detected (${formattedJunkList})</strong>
                </div>
                <p style="font-size: 11px; color: #FECDD3; margin-bottom: 8px; line-height: 1.4;">
                    High refined oil, simple sugars, or sodium detected. Eating this regularly causes energy crashes and fat accumulation.
                </p>
                <div style="border-top: 1px solid rgba(244, 63, 94, 0.2); padding-top: 8px;">
                    <div style="font-size: 10px; font-weight: 800; color: #67E8F9; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 4px;">RECOMMENDED HEALTHY SWAPS:</div>
                    ${swapItemsHtml}
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 14px; padding: 12px 14px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 14px;">✅</span>
                    <strong style="color: #6EE7B7; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase;">Wholesome Diet Maintained</strong>
                </div>
                <p style="font-size: 11px; color: #A7F3D0; margin: 0; line-height: 1.4;">
                    No junk foods detected in today's meals. You are fueling your body with clean, high-energy nutrition. Keep it up!
                </p>
            </div>
        `;
    }
}

// 3. Accurate Water Tracker
function openWaterModal() {
    loadWaterTracker();
    const modal = document.getElementById("waterModal");
    if (modal) modal.classList.remove("hidden");
}

function closeWaterModal() {
    const modal = document.getElementById("waterModal");
    if (modal) modal.classList.add("hidden");
}

function getWaterStorageKey() {
    const dateKey = getCurrentDateKey();
    const userId = currentUser ? currentUser.id : "guest";
    return `aeriva_water_${userId}_${dateKey}`;
}

function loadWaterTracker() {
    const key = getWaterStorageKey();
    const currentAmount = parseFloat(localStorage.getItem(key)) || 0.0;
    waterAmount = currentAmount;

    const percentage = Math.min(100, (currentAmount / 2.5) * 100);

    const waterStat = document.getElementById("waterStat");
    const waterText = document.getElementById("waterText");
    const waterProgress = document.getElementById("waterProgress");
    const modalDisplay = document.getElementById("modalWaterDisplay");

    if (waterStat) waterStat.textContent = `${currentAmount.toFixed(2)} L`;
    if (waterText) waterText.textContent = `${currentAmount.toFixed(2)} L / 2.5 L`;
    if (waterProgress) waterProgress.style.width = `${percentage}%`;
    if (modalDisplay) modalDisplay.textContent = `${currentAmount.toFixed(2)} L`;
}

function logWaterAmount(litres) {
    const key = getWaterStorageKey();
    let currentAmount = parseFloat(localStorage.getItem(key)) || 0.0;
    currentAmount = Math.round((currentAmount + litres) * 100) / 100;
    localStorage.setItem(key, currentAmount);

    loadWaterTracker();
    addXP(5);
}

function logCustomWater() {
    const input = document.getElementById("customWaterInput");
    if (!input) return;
    const ml = parseFloat(input.value) || 0;
    if (ml > 0) {
        logWaterAmount(ml / 1000);
        input.value = "";
    }
}

function resetWaterToday() {
    const key = getWaterStorageKey();
    localStorage.setItem(key, "0.0");
    loadWaterTracker();
}

function addWater() {
    openWaterModal();
}

// 4. Nighttime Steps Tracker
function getStepStorageKey() {
    const dateKey = getCurrentDateKey();
    const userId = currentUser ? currentUser.id : "guest";
    return `aeriva_steps_${userId}_${dateKey}`;
}

function openStepModal() {
    loadStepTracker();
    const modal = document.getElementById("stepModal");
    if (modal) modal.classList.remove("hidden");
}

function closeStepModal() {
    const modal = document.getElementById("stepModal");
    if (modal) modal.classList.add("hidden");
}

function setStepPreset(num) {
    const input = document.getElementById("stepCountInput");
    if (input) input.value = num;
}

function saveStepsFromModal() {
    const input = document.getElementById("stepCountInput");
    if (!input) return;
    const steps = parseInt(input.value) || 0;
    if (steps >= 0) {
        const key = getStepStorageKey();
        localStorage.setItem(key, steps);
        loadStepTracker();
        loadSmartExerciseRecommender();
        addXP(15);
        closeStepModal();
    }
}

function loadStepTracker() {
    const key = getStepStorageKey();
    const steps = parseInt(localStorage.getItem(key)) || 0;
    const target = 10000;
    const percentage = Math.min(100, Math.round((steps / target) * 100));

    const stepStat = document.getElementById("stepStat");
    const stepProgressBar = document.getElementById("stepProgressBar");
    const stepDistance = document.getElementById("stepDistance");
    const stepCalories = document.getElementById("stepCalories");
    const modalStepDisplay = document.getElementById("modalStepDisplay");

    if (stepStat) stepStat.textContent = steps.toLocaleString();
    if (stepProgressBar) stepProgressBar.style.width = `${percentage}%`;

    const km = (steps * 0.00075).toFixed(1);
    const kcal = Math.round(steps * 0.04);

    if (stepDistance) stepDistance.textContent = `${km} km walked`;
    if (stepCalories) stepCalories.textContent = `~${kcal} kcal burned`;
    if (modalStepDisplay) modalStepDisplay.textContent = `${steps.toLocaleString()} steps`;
}

// Prompt steps automatically at night before sleeping
function checkNightStepPrompt() {
    const hour = new Date().getHours();
    if (hour >= 20 || hour < 4) {
        const key = getStepStorageKey();
        const steps = localStorage.getItem(key);
        if (steps === null) {
            setTimeout(() => {
                openStepModal();
            }, 1200);
        }
    }
}

// 5. Scheduled Workout According to Free Time
const WORKOUT_ROUTINES_BY_DAY = {
    "Sunday": {
        name: "Active Recovery & Mobility Stretch",
        desc: "Gentle full-body stretching and breathing to recharge your nervous system.",
        duration: 20
    },
    "Monday": {
        name: "30 Min Brisk Walking & Cardio Fat-Burn",
        desc: "Cardio endurance walk or jog to jumpstart your metabolic rate for the week.",
        duration: 30
    },
    "Tuesday": {
        name: "25 Min Bodyweight Core & Leg Strength",
        desc: "Squats, lunges, planks and glute bridges for lower-body power.",
        duration: 25
    },
    "Wednesday": {
        name: "30 Min Full-Body Yoga & Flexibility",
        desc: "Sun salutations and deep hip/spine openers to release desk posture stiffness.",
        duration: 30
    },
    "Thursday": {
        name: "30 Min High-Intensity Interval Cardio",
        desc: "Alternating brisk pace and recovery intervals to maximize cardiovascular stamina.",
        duration: 30
    },
    "Friday": {
        name: "25 Min Upper Body & Core Strength",
        desc: "Pushups, tricep dips, side planks and shoulder mobility.",
        duration: 25
    },
    "Saturday": {
        name: "40 Min Outdoor Jog, Cycling or Active Sport",
        desc: "Fun outdoor movement session to boost endurance and mental freshness.",
        duration: 40
    }
};

function getWorkoutStorageKey() {
    const dateKey = getCurrentDateKey();
    const userId = currentUser ? currentUser.id : "guest";
    return `aeriva_workout_${userId}_${dateKey}`;
}

function loadScheduledWorkout() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = days[new Date().getDay()];
    const routine = WORKOUT_ROUTINES_BY_DAY[todayName] || WORKOUT_ROUTINES_BY_DAY["Monday"];

    let freeStart = "17:30";
    let freeEnd = "18:00";

    if (currentUser && currentUser.schedules && currentUser.schedules.length > 0) {
        const scheduleToday = currentUser.schedules.find(s => s.day_of_week && s.day_of_week.toLowerCase() === todayName.toLowerCase());
        if (scheduleToday && scheduleToday.free_start_time) {
            freeStart = scheduleToday.free_start_time;
            try {
                const [h, m] = freeStart.split(":").map(Number);
                const endM = (m + routine.duration);
                const endH = h + Math.floor(endM / 60);
                const remM = endM % 60;
                freeEnd = `${String(endH % 24).padStart(2, '0')}:${String(remM).padStart(2, '0')}`;
            } catch (e) {
                freeEnd = "18:00";
            }
        }
    }

    const timeElem = document.getElementById("scheduledWorkoutTime");
    const routineElem = document.getElementById("scheduledWorkoutRoutine");
    const descElem = document.getElementById("scheduledWorkoutDesc");
    const btnElem = document.getElementById("workoutCompleteBtn");

    if (timeElem) timeElem.textContent = `${freeStart} - ${freeEnd} (Free Time)`;
    if (routineElem) routineElem.textContent = routine.name;
    if (descElem) descElem.textContent = routine.desc;

    const key = getWorkoutStorageKey();
    const isCompleted = localStorage.getItem(key) === "true";
    const exerciseStat = document.getElementById("exerciseStat");

    if (btnElem) {
        if (isCompleted) {
            btnElem.style.background = "rgba(16, 185, 129, 0.15)";
            btnElem.style.borderColor = "#10B981";
            btnElem.style.color = "#6EE7B7";
            btnElem.textContent = `✓ COMPLETED TODAY (+25 XP EARNED)`;
            if (exerciseStat) exerciseStat.textContent = `${routine.duration} min`;
        } else {
            btnElem.style.background = "";
            btnElem.style.borderColor = "";
            btnElem.style.color = "";
            btnElem.textContent = `✓ COMPLETE WORKOUT (+25 XP)`;
            if (exerciseStat && exerciseStat.textContent === "0 min") {
                exerciseStat.textContent = `0 min`;
            }
        }
    }
}

// SMART EXERCISE & FREE-TIME BURN RECOMMENDER
// Calculates exact required burn and minutes based on Food Intake + Steps Walked + Schedule Free Window
let lastRecommendedWorkoutDuration = 30;

async function loadSmartExerciseRecommender(overrideCalories = null) {
    const timeElem = document.getElementById("scheduledWorkoutTime");
    const routineElem = document.getElementById("scheduledWorkoutRoutine");
    const descElem = document.getElementById("scheduledWorkoutDesc");
    const foodVal = document.getElementById("exerciseMetaFood");
    const stepsVal = document.getElementById("exerciseMetaSteps");
    const burnVal = document.getElementById("exerciseMetaBurn");
    const breakdownList = document.getElementById("exerciseBreakdownList");
    const btnElem = document.getElementById("workoutCompleteBtn");
    const exerciseStat = document.getElementById("exerciseStat");

    if (!routineElem) return;

    // Retrieve today's step count
    const stepKey = getStepStorageKey();
    const steps = parseInt(localStorage.getItem(stepKey)) || 0;

    try {
        const authToken = localStorage.getItem("aeriva_token");
        const headers = {
            "Content-Type": "application/json",
            ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {})
        };

        const payload = { steps: steps };
        if (overrideCalories !== null) {
            payload.daily_calories = overrideCalories;
        }

        const res = await fetch(`${API}/exercise/recommend`, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            const data = await res.json();
            lastRecommendedWorkoutDuration = data.recommended_duration_minutes || 30;

            if (timeElem) timeElem.textContent = `${data.free_time_slot} (Window: ${data.full_free_window})`;
            if (foodVal) foodVal.textContent = `${Number(data.daily_calories).toLocaleString()} kcal`;
            if (stepsVal) stepsVal.textContent = `~${data.steps_calories_burned} kcal (${data.steps_walked.toLocaleString()} st)`;
            if (burnVal) burnVal.textContent = `~${data.target_calories_to_burn} kcal`;

            const intensityIcon = data.intensity === "High" ? "🔥" : data.intensity === "Moderate" ? "⚡" : "🌿";
            if (routineElem) {
                routineElem.innerHTML = `<span>${intensityIcon} ${escapeHTML(data.workout_name)}</span> <span style="font-size: 11px; color: #67E8F9; font-weight: 700; margin-left: 6px;">(${data.recommended_duration_minutes} min)</span>`;
            }
            if (descElem) descElem.textContent = data.description;

            // Render tailored exercise breakdown
            if (breakdownList && data.exercises && data.exercises.length > 0) {
                breakdownList.innerHTML = data.exercises.map(ex => `
                    <div class="exercise-step-item">
                        <span class="exercise-step-name">
                            <span style="color: #67E8F9;">▸</span> ${escapeHTML(ex.name)}
                        </span>
                        <span class="exercise-step-timing">${escapeHTML(ex.duration)} · ${escapeHTML(ex.reps)}</span>
                    </div>
                `).join("");
            }

            // Sync completion button
            const key = getWorkoutStorageKey();
            const isCompleted = localStorage.getItem(key) === "true";
            if (btnElem) {
                if (isCompleted) {
                    btnElem.style.background = "rgba(16, 185, 129, 0.15)";
                    btnElem.style.borderColor = "#10B981";
                    btnElem.style.color = "#6EE7B7";
                    btnElem.textContent = `✓ COMPLETED TODAY (+25 XP EARNED)`;
                    if (exerciseStat) exerciseStat.textContent = `${lastRecommendedWorkoutDuration} min`;
                } else {
                    btnElem.style.background = "";
                    btnElem.style.borderColor = "";
                    btnElem.style.color = "";
                    btnElem.textContent = `✓ COMPLETE WORKOUT (+25 XP)`;
                    if (exerciseStat && exerciseStat.textContent === "0 min") {
                        exerciseStat.textContent = `0 min`;
                    }
                }
            }
            return;
        }
    } catch (e) {
        console.warn("Exercise recommendation fallback:", e);
    }

    // Fallback to local routine
    loadScheduledWorkout();
}

function toggleWorkoutComplete() {
    const key = getWorkoutStorageKey();
    const isCompleted = localStorage.getItem(key) === "true";

    if (!isCompleted) {
        localStorage.setItem(key, "true");
        addXP(25);
        loadSmartExerciseRecommender();
        const suggestion = document.getElementById("aiSuggestion");
        if (suggestion) {
            suggestion.textContent = "Awesome workout! Daily exercise during your free time keeps your body active and strong.";
        }
    } else {
        localStorage.setItem(key, "false");
        loadSmartExerciseRecommender();
    }
}

// AI NEXT-DAY MEAL SUGGESTIONS (ACCORDING TO PRESENT & BEFORE DAY)
async function loadNextDaySuggestions() {
    const section = document.getElementById("nextDayMealSection");
    const grid = document.getElementById("nextDayMealGrid");
    const rationale = document.getElementById("nextDayRationale");
    const statusText = document.getElementById("nextDayStatusText");
    const totalDisplay = document.getElementById("nextDayTotalCals");

    if (!section || !grid) return;

    try {
        const authToken = localStorage.getItem("aeriva_token");
        const headers = authToken ? { "Authorization": `Bearer ${authToken}` } : {};

        const res = await fetch(`${API}/food/suggestions/next-day`, { headers });
        if (!res.ok) {
            if (rationale) {
                rationale.textContent = "Log your meals for today and yesterday to generate personalized next-day Indian nutrition advice!";
            }
            return;
        }

        const data = await res.json();
        if (statusText) statusText.textContent = data.status || "BALANCED FUELING";
        if (rationale) rationale.textContent = data.rationale || "";
        if (totalDisplay) totalDisplay.textContent = `~${data.total_recommended_calories || 1850} kcal`;

        const meals = data.meals || [];
        const mealIcons = {
            "Breakfast": "🍳",
            "Lunch": "🍛",
            "Snack": "🍎",
            "Dinner": "🍽️"
        };

        grid.innerHTML = meals.map(m => `
            <div class="next-day-meal-tile">
                <div>
                    <div class="next-day-meal-header">
                        <span class="next-day-meal-tag">${mealIcons[m.meal_type] || "🍱"} ${escapeHTML(m.meal_type)}</span>
                        <span class="next-day-meal-cal">${m.calories} kcal</span>
                    </div>
                    <div class="next-day-meal-title">${escapeHTML(m.food_name)}</div>
                    <div class="next-day-meal-portion">${escapeHTML(m.portion)}</div>
                </div>
                <div class="next-day-meal-reason">
                    💡 ${escapeHTML(m.reason)}
                </div>
            </div>
        `).join("");

    } catch (err) {
        console.warn("Could not load next-day meal suggestions:", err);
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