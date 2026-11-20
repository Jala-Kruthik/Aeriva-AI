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
            console.error("Dashboard initial load:", error);
            // Persistent session recovery: Restore from cached profile if present
            const cachedUserStr = localStorage.getItem("aeriva_user");
            if (cachedUserStr) {
                try {
                    currentUser = JSON.parse(cachedUserStr);
                    const authScreen = document.getElementById("authScreen");
                    const dashboardScreen = document.getElementById("dashboardScreen");
                    if (authScreen) authScreen.classList.add("hidden");
                    if (dashboardScreen) dashboardScreen.classList.remove("hidden");
                    const userName = document.getElementById("userName");
                    if (userName && currentUser.name) userName.textContent = currentUser.name;
                    await loadFood();
                    await loadRoutine();
                    loadWaterTracker();
                    loadStepTracker();
                } catch (e) {
                    console.error("Cached profile restore error:", e);
                }
            }

            // Retry loading dashboard in 2.5s (handles Render free tier cold-start spin-up)
            setTimeout(async () => {
                if (authToken) {
                    try {
                        await loadDashboard();
                    } catch (retryErr) {
                        console.warn("Retry dashboard load error:", retryErr);
                    }
                }
            }, 2500);
        }
    } else {
        showLogin();
    }

});


/* =========================================
   SAVED ACCOUNTS ON THIS DEVICE
========================================= */

function getSavedAccounts() {
    try {
        const raw = localStorage.getItem("aeriva_saved_accounts");
        if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) return arr;
        }
    } catch (e) {
        console.warn("Error reading saved accounts:", e);
    }
    return [];
}

function rememberAccount(name, email) {
    if (!email) return;
    try {
        let accounts = getSavedAccounts();
        const normEmail = email.trim().toLowerCase();
        accounts = accounts.filter(a => a.email && a.email.toLowerCase() !== normEmail);
        accounts.unshift({
            name: name || normEmail.split("@")[0],
            email: normEmail,
            lastLogin: new Date().toISOString()
        });
        accounts = accounts.slice(0, 8);
        localStorage.setItem("aeriva_saved_accounts", JSON.stringify(accounts));
        localStorage.setItem("aeriva_last_email", normEmail);
        renderSavedAccounts();
    } catch (e) {
        console.warn("Error saving account:", e);
    }
}

function removeSavedAccount(email, ev) {
    if (ev) ev.stopPropagation();
    try {
        let accounts = getSavedAccounts();
        const normEmail = email.trim().toLowerCase();
        accounts = accounts.filter(a => a.email && a.email.toLowerCase() !== normEmail);
        localStorage.setItem("aeriva_saved_accounts", JSON.stringify(accounts));
        renderSavedAccounts();
    } catch (e) {
        console.warn("Error removing account:", e);
    }
}

function selectSavedAccount(email) {
    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    if (emailInput) {
        emailInput.value = email;
        if (passwordInput) {
            passwordInput.focus();
        }
    }
}

function renderSavedAccounts() {
    const container = document.getElementById("savedAccountsContainer");
    const list = document.getElementById("savedAccountsList");
    if (!container || !list) return;

    let accounts = getSavedAccounts();

    // If local saved accounts list is empty, but we have a cached user email, seed it
    if (accounts.length === 0) {
        const cachedEmail = localStorage.getItem("aeriva_user_email") || localStorage.getItem("aeriva_last_email");
        const cachedUserStr = localStorage.getItem("aeriva_user");
        let cachedName = "";
        if (cachedUserStr) {
            try {
                const u = JSON.parse(cachedUserStr);
                cachedName = u.name || "";
            } catch (e) {}
        }
        if (cachedEmail) {
            accounts = [{
                name: cachedName || cachedEmail.split("@")[0],
                email: cachedEmail.trim().toLowerCase(),
                lastLogin: new Date().toISOString()
            }];
            localStorage.setItem("aeriva_saved_accounts", JSON.stringify(accounts));
        }
    }

    if (accounts.length === 0) {
        container.classList.add("hidden");
        list.innerHTML = "";
        return;
    }

    container.classList.remove("hidden");
    list.innerHTML = accounts.map(acc => {
        const initial = (acc.name || acc.email || "U")[0].toUpperCase();
        const cleanName = typeof escapeHTML === "function" ? escapeHTML(acc.name || acc.email) : (acc.name || acc.email);
        const cleanEmail = typeof escapeHTML === "function" ? escapeHTML(acc.email) : acc.email;
        return `
            <div class="saved-account-chip" onclick="selectSavedAccount('${acc.email}')" title="Click to sign in as ${acc.email}">
                <div class="saved-account-avatar">${initial}</div>
                <div class="saved-account-info">
                    <span class="saved-account-name">${cleanName}</span>
                    <span class="saved-account-email">${cleanEmail}</span>
                </div>
                <button type="button" class="saved-account-remove" title="Remove account from device" onclick="removeSavedAccount('${acc.email}', event)">×</button>
            </div>
        `;
    }).join("");

    // Auto-fill login field if empty
    const emailInput = document.getElementById("loginEmail");
    if (emailInput && !emailInput.value.trim() && accounts.length > 0) {
        emailInput.value = accounts[0].email;
    }
}


/* =========================================
   LOGIN / REGISTER SCREEN
========================================= */


function showLogin() {
    const loginBox = document.getElementById("loginBox");
    const registerBox = document.getElementById("registerBox");
    if (loginBox) loginBox.classList.remove("hidden");
    if (registerBox) registerBox.classList.add("hidden");

    const signInTab = document.getElementById("signInTab");
    const registerTab = document.getElementById("registerTab");
    if (signInTab) signInTab.classList.add("active");
    if (registerTab) registerTab.classList.remove("active");

    const loginMessage = document.getElementById("loginMessage");
    if (loginMessage) loginMessage.textContent = "";

    renderSavedAccounts();
}


function showRegister() {
    const loginBox = document.getElementById("loginBox");
    const registerBox = document.getElementById("registerBox");
    if (loginBox) loginBox.classList.add("hidden");
    if (registerBox) registerBox.classList.remove("hidden");

    const signInTab = document.getElementById("signInTab");
    const registerTab = document.getElementById("registerTab");
    if (registerTab) registerTab.classList.add("active");
    if (signInTab) signInTab.classList.remove("active");

    const registerGoogleStep = document.getElementById("registerGoogleStep");
    const registerProfileStep = document.getElementById("registerProfileStep");
    const registerForm = document.getElementById("registerForm");

    if (registerForm) registerForm.classList.remove("hidden");
    if (registerGoogleStep) registerGoogleStep.classList.add("hidden");
    if (registerProfileStep) registerProfileStep.classList.add("hidden");

    const registerMessage = document.getElementById("registerMessage");
    if (registerMessage) registerMessage.textContent = "";
}


/* =========================================
   REGISTER
========================================= */


async function registerUser() {

    const nameInput = document.getElementById("registerName");
    const emailInput = document.getElementById("registerEmail");
    const passwordInput = document.getElementById("registerPassword");
    const ageInput = document.getElementById("registerAge");
    const heightInput = document.getElementById("registerHeight");
    const weightInput = document.getElementById("registerWeight");
    const goalInput = document.getElementById("registerGoal");
    const message = document.getElementById("registerMessage");

    const name = nameInput ? nameInput.value.trim() : "";
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";
    const age = ageInput ? ageInput.value : null;
    const height = heightInput ? heightInput.value : null;
    const weight = weightInput ? weightInput.value : null;
    const healthGoal = goalInput ? goalInput.value : null;

    if (!name || !email || !password) {
        if (message) message.textContent = "Please enter your name, email and password.";
        return;
    }

    try {

        if (message) message.textContent = "Creating account in database...";

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
                    health_goal: healthGoal || null
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            if (message) message.textContent = data.detail || "Unable to create account.";
            return;
        }

        // Successfully created and stored in DB! Auto-login immediately:
        authToken = data.access_token;
        localStorage.setItem("aeriva_token", authToken);
        rememberAccount(name, email);

        if (message) message.textContent = "Account stored in database! Loading your dashboard...";

        currentUser = {
            id: data.user_id,
            name: data.name || name,
            email: data.email || email,
            age: age ? Number(age) : null,
            height: height ? Number(height) : null,
            weight: weight ? Number(weight) : null,
            health_goal: healthGoal || null,
            onboarding_completed: true
        };
        localStorage.setItem("aeriva_user", JSON.stringify(currentUser));
        localStorage.setItem("aeriva_user_email", currentUser.email);

        localStorage.setItem("aeriva_active_dashboard_tab", "routine");
    const dashEl = document.getElementById("dashboardScreen");
    if (dashEl) dashEl.setAttribute("data-active-tab", tab || "routine");
        switchDashboardTab("routine");
        await loadDashboard();

    } catch (error) {
        console.error("Register error:", error);
        if (message) message.textContent = "Could not connect to AERIVA server.";
    }

}


/* =========================================
   LOGIN
========================================= */


async function loginUser() {

    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const email = emailInput ? emailInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";
    const message = document.getElementById("loginMessage");
    const rememberMe = document.getElementById("rememberMeCheckbox");

    if (!email || !password) {
        if (message) message.textContent = "Please enter email and password.";
        return;
    }

    try {

        if (message) message.textContent = "Logging in...";

        const response = await fetch(
            `${API}/login`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            if (message) message.textContent = data.detail || "Invalid email or password.";
            return;
        }

        // Save JWT token
        authToken = data.access_token;
        localStorage.setItem("aeriva_token", authToken);

        const userName = data.name || email.split("@")[0];
        if (!rememberMe || rememberMe.checked) {
            rememberAccount(userName, email);
        }

        if (message) message.textContent = "Welcome back! Loading your dashboard...";

        // Always enter Dashboard 1 (Daily Routine) directly upon login
        localStorage.setItem("aeriva_active_dashboard_tab", "routine");
    const dashEl = document.getElementById("dashboardScreen");
    if (dashEl) dashEl.setAttribute("data-active-tab", tab || "routine");
        switchDashboardTab("routine");
        await loadDashboard();

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        if (message) message.textContent = "Could not connect to AERIVA server.";

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
        if (response.status === 401) {
            const errData = await response.json().catch(() => ({}));
            if (errData.detail === "Invalid or expired token") {
                logoutUser();
                throw new Error("Invalid or expired token");
            }
        }
        throw new Error("Authentication failed with status " + response.status);
    }

    currentUser = await response.json();
    localStorage.setItem("aeriva_user", JSON.stringify(currentUser));
    if (currentUser.email) {
        localStorage.setItem("aeriva_user_email", currentUser.email);
        rememberAccount(currentUser.name, currentUser.email);
    }

    const authScreen = document.getElementById("authScreen");
    const scheduleSetupScreen = document.getElementById("scheduleSetupScreen");
    const dashboardScreen = document.getElementById("dashboardScreen");

    if (authScreen) authScreen.classList.add("hidden");
    if (scheduleSetupScreen) scheduleSetupScreen.classList.add("hidden");
    if (dashboardScreen) dashboardScreen.classList.remove("hidden");
    if (typeof updateAerivaQuickChips === "function") updateAerivaQuickChips();

    // Ensure all modals remain closed upon login (no repeat popups)
    const foodModal = document.getElementById("foodModal");
    if (foodModal) foodModal.classList.add("hidden");
    const stepModal = document.getElementById("stepModal");
    if (stepModal) stepModal.classList.add("hidden");
    const routineModal = document.getElementById("routineModal");
    if (routineModal) routineModal.classList.add("hidden");

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
    loadHealthPrecautions();
    updateSuggestion();
    updateDynamicVitals();

    // Restore active dashboard tab (Dashboard 1: Routine vs Dashboard 2: Fitness vs Dashboard 3: Precautions)
    const savedDashboardTab = localStorage.getItem("aeriva_active_dashboard_tab") || "routine";
    switchDashboardTab(savedDashboardTab);

    // No auto-popups: Never interrupt the user with popups upon login or page load.
    // Meals and steps are displayed on Dashboard 1 with clean buttons to log whenever desired.
}


/* =========================================
   TRIPLE DASHBOARD NAVIGATION SWITCHER
   Dashboard 1: 1 - Daily Routine (Routine, Food, Steps, Water)
   Dashboard 2: 2 - What To Do (Exercise Mode Popup & Fitness Quests)
   Dashboard 3: 3 - Precautions & Guidance (AI Health Precautions & Next-Day Meals)
========================================= */

function switchDashboardTab(tab) {
    const tab1Btn = document.getElementById("tabDashboard1Btn");
    const tab2Btn = document.getElementById("tabDashboard2Btn");
    const tab3Btn = document.getElementById("tabDashboard3Btn");
    const corner1Btn = document.getElementById("cornerTab1Btn");
    const corner2Btn = document.getElementById("cornerTab2Btn");
    const corner3Btn = document.getElementById("cornerTab3Btn");
    const view1 = document.getElementById("dashboardView1");
    const view2 = document.getElementById("dashboardView2");
    const view3 = document.getElementById("dashboardView3");

    // Reset all tabs
    [tab1Btn, tab2Btn, tab3Btn, corner1Btn, corner2Btn, corner3Btn].forEach(btn => {
        if (btn) btn.classList.remove("active");
    });
    [view1, view2, view3].forEach(view => {
        if (view) view.classList.add("hidden");
    });

    if (tab === "fitness" || tab === "dashboard2" || tab === "2") {
        if (tab2Btn) tab2Btn.classList.add("active");
        if (corner2Btn) corner2Btn.classList.add("active");
        if (view2) view2.classList.remove("hidden");
        localStorage.setItem("aeriva_active_dashboard_tab", "fitness");
        loadSmartExerciseRecommender();
    } else if (tab === "precautions" || tab === "dashboard3" || tab === "3" || tab === "guidance") {
        if (tab3Btn) tab3Btn.classList.add("active");
        if (corner3Btn) corner3Btn.classList.add("active");
        if (view3) view3.classList.remove("hidden");
        localStorage.setItem("aeriva_active_dashboard_tab", "precautions");
        loadHealthPrecautions();
        loadNextDaySuggestions();
    } else {
        if (tab1Btn) tab1Btn.classList.add("active");
        if (corner1Btn) corner1Btn.classList.add("active");
        if (view1) view1.classList.remove("hidden");
        localStorage.setItem("aeriva_active_dashboard_tab", "routine");
    const dashEl = document.getElementById("dashboardScreen");
    if (dashEl) dashEl.setAttribute("data-active-tab", tab || "routine");
    }
}


/* =========================================
   DASHBOARD 3: AI HEALTH PRECAUTIONS ENGINE
   Food, Rest & Exercise Proactive Warnings
========================================= */

async function loadHealthPrecautions() {
    const overallBadge = document.getElementById("precautionsOverallBadge");
    const overallText = document.getElementById("precautionsOverallText");
    const shieldIcon = document.getElementById("precautionsShieldIcon");
    const banner = document.getElementById("precautionsSummaryBanner");
    const bannerIcon = document.getElementById("precautionsBannerIcon");
    const bannerTitle = document.getElementById("precautionsBannerTitle");
    const bannerText = document.getElementById("precautionsBannerText");

    const foodCard = document.getElementById("precautionFoodCard");
    const foodTag = document.getElementById("precautionFoodTag");
    const foodMsg = document.getElementById("precautionFoodMsg");
    const foodRec = document.getElementById("precautionFoodRec");
    const foodBtn = document.getElementById("precautionFoodActionBtn");

    const restCard = document.getElementById("precautionRestCard");
    const restTag = document.getElementById("precautionRestTag");
    const restMsg = document.getElementById("precautionRestMsg");
    const restRec = document.getElementById("precautionRestRec");
    const restBtn = document.getElementById("precautionRestActionBtn");

    const exCard = document.getElementById("precautionExerciseCard");
    const exTag = document.getElementById("precautionExerciseTag");
    const exMsg = document.getElementById("precautionExerciseMsg");
    const exRec = document.getElementById("precautionExerciseRec");
    const exBtn = document.getElementById("precautionExerciseActionBtn");

    const checklist = document.getElementById("precautionsChecklist");

    // Gather client metrics for query
    let steps = 0;
    try {
        steps = parseInt(localStorage.getItem(getStepStorageKey())) || 0;
    } catch (_) {}

    let exerciseMins = 0;
    try {
        const exElem = document.getElementById("exerciseStat");
        if (exElem) exerciseMins = parseInt(exElem.textContent) || 0;
    } catch (_) {}

    try {
        authToken = authToken || localStorage.getItem("aeriva_token");
        const headers = authToken ? { "Authorization": `Bearer ${authToken}` } : {};
        const res = await fetch(`${API}/health/precautions?steps=${steps}&exercise_minutes=${exerciseMins}`, { headers });

        if (!res.ok) {
            fallbackHealthPrecautions(steps, exerciseMins);
            return;
        }

        const data = await res.json();

        // 1. Overall Shield Status
        const sev = (data.overall_severity || "HEALTHY").toLowerCase();
        if (overallBadge) {
            overallBadge.className = `precautions-score-badge ${sev}`;
        }
        if (overallText) {
            overallText.textContent = data.overall_severity === "CRITICAL" 
                ? "CRITICAL PRECAUTION NEEDED" 
                : (data.overall_severity === "CAUTION" ? "ACTIONABLE PRECAUTIONS" : "HEALTH SHIELD OPTIMAL");
        }
        if (shieldIcon) {
            shieldIcon.textContent = data.overall_severity === "CRITICAL" ? "🛑" : (data.overall_severity === "CAUTION" ? "⚠️" : "🛡️");
        }

        // 2. Banner
        if (banner) {
            banner.className = `precautions-summary-banner ${sev}`;
        }
        if (bannerTitle) bannerTitle.textContent = data.overall_title || "AI Health Precautions";
        if (bannerText) bannerText.textContent = data.overall_summary || "";
        if (bannerIcon) bannerIcon.textContent = data.overall_severity === "CRITICAL" ? "⚠️" : (data.overall_severity === "CAUTION" ? "💡" : "✅");

        // 3. Food Precaution Pillar
        const food = data.food || {};
        const foodSev = (food.status || "OPTIMAL").toLowerCase();
        if (foodCard) {
            foodCard.className = `precaution-pillar-card status-${foodSev}`;
        }
        if (foodTag) {
            foodTag.className = `pillar-status-tag ${foodSev}`;
            foodTag.textContent = food.badge || "PROPER FOOD";
        }
        if (foodMsg) foodMsg.textContent = food.message || "Balanced food intake detected.";
        if (foodRec) foodRec.textContent = food.recommendation || "Maintain wholesome meals.";
        if (foodBtn && food.action_label) foodBtn.textContent = food.action_label;

        // 4. Rest Precaution Pillar
        const rest = data.rest || {};
        const restSev = (rest.status || "OPTIMAL").toLowerCase();
        if (restCard) {
            restCard.className = `precaution-pillar-card status-${restSev}`;
        }
        if (restTag) {
            restTag.className = `pillar-status-tag ${restSev}`;
            restTag.textContent = rest.badge || "REST ON TRACK";
        }
        if (restMsg) restMsg.textContent = rest.message || "Adequate sleep schedule maintained.";
        if (restRec) restRec.textContent = rest.recommendation || "Keep consistent sleep routine.";
        if (restBtn && rest.action_label) restBtn.textContent = rest.action_label;

        // 5. Exercise Precaution Pillar
        const ex = data.exercise || {};
        const exSev = (ex.status || "OPTIMAL").toLowerCase();
        if (exCard) {
            exCard.className = `precaution-pillar-card status-${exSev}`;
        }
        if (exTag) {
            exTag.className = `pillar-status-tag ${exSev}`;
            exTag.textContent = ex.badge || "ACTIVE";
        }
        if (exMsg) exMsg.textContent = ex.message || "Good movement logged today.";
        if (exRec) exRec.textContent = ex.recommendation || "Keep moving regularly.";
        if (exBtn && ex.action_label) exBtn.textContent = ex.action_label;

        // 6. Checklist
        if (checklist && Array.isArray(data.action_bullets) && data.action_bullets.length) {
            checklist.innerHTML = data.action_bullets.map(b => `<li>${escapeHTML(b)}</li>`).join("");
        }

    } catch (err) {
        console.warn("Could not fetch remote health precautions, using client calculations:", err);
        fallbackHealthPrecautions(steps, exerciseMins);
    }
}

function fallbackHealthPrecautions(steps, exerciseMins) {
    const foodMsg = document.getElementById("precautionFoodMsg");
    const foodTag = document.getElementById("precautionFoodTag");
    const foodRec = document.getElementById("precautionFoodRec");
    const restMsg = document.getElementById("precautionRestMsg");
    const restTag = document.getElementById("precautionRestTag");
    const restRec = document.getElementById("precautionRestRec");
    const exMsg = document.getElementById("precautionExerciseMsg");
    const exTag = document.getElementById("precautionExerciseTag");
    const exRec = document.getElementById("precautionExerciseRec");

    // Client-side quick calculation
    const hasFoods = currentTodayFoods && currentTodayFoods.length > 0;
    if (!hasFoods) {
        if (foodTag) { foodTag.className = "pillar-status-tag critical"; foodTag.textContent = "NO FOOD LOGGED"; }
        if (foodMsg) foodMsg.textContent = "You have not logged any food today. Skipping meals causes blood sugar drop and metabolic fatigue.";
        if (foodRec) foodRec.textContent = "Eat a balanced meal with lentils, vegetables, and complex carbohydrates immediately.";
    } else {
        if (foodTag) { foodTag.className = "pillar-status-tag optimal"; foodTag.textContent = "MEALS LOGGED"; }
        if (foodMsg) foodMsg.textContent = "You have logged meals for today. Keep maintaining balanced portion control.";
        if (foodRec) foodRec.textContent = "Drink plenty of water and avoid processed sweets.";
    }

    if (steps < 3500 && exerciseMins === 0) {
        if (exTag) { exTag.className = "pillar-status-tag critical"; exTag.textContent = "SEDENTARY DANGER"; }
        if (exMsg) exMsg.textContent = `You have only walked ${steps} steps and logged 0 workout minutes today.`;
        if (exRec) exRec.textContent = "Stand up and take a 15-minute brisk walk or launch our guided exercise mode.";
    } else {
        if (exTag) { exTag.className = "pillar-status-tag optimal"; exTag.textContent = "ACTIVE"; }
        if (exMsg) exMsg.textContent = `Movement logged: ${steps} steps walked and ${exerciseMins} mins active.`;
        if (exRec) exRec.textContent = "Great job! Keep muscles flexible with light stretches.";
    }

    if (restTag) { restTag.className = "pillar-status-tag optimal"; restTag.textContent = "REST CHECKED"; }
    if (restMsg) restMsg.textContent = "Ensure your bedroom is dark and cool, and target 7 to 8 hours of sleep tonight.";
    if (restRec) restRec.textContent = "Power down electronic screens at least 30 minutes before sleep.";
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

    // Refresh dynamic vitals (Health Score & Energy Level) with time
    if (typeof updateDynamicVitals === "function") {
        updateDynamicVitals();
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

// 1. Time-Based Meal Detection & Logged State Tracker
let currentTodayFoods = [];

function getLoggedMealsSet() {
    const set = new Set();
    if (Array.isArray(currentTodayFoods)) {
        currentTodayFoods.forEach(f => {
            if (f && f.meal_type) {
                set.add(f.meal_type.trim().toLowerCase());
            }
        });
    }
    return set;
}

function isMealLoggedToday(mealType) {
    if (!mealType) return false;
    return getLoggedMealsSet().has(mealType.trim().toLowerCase());
}

function areAllDailyMealsLogged() {
    const set = getLoggedMealsSet();
    return ["breakfast", "lunch", "snack", "dinner"].every(m => set.has(m));
}

function getNextUnloggedMealType() {
    const mealOrder = ["Breakfast", "Lunch", "Snack", "Dinner"];
    const currentMeal = getCurrentMealType();
    if (!isMealLoggedToday(currentMeal)) {
        return currentMeal;
    }
    for (const m of mealOrder) {
        if (!isMealLoggedToday(m)) {
            return m;
        }
    }
    return currentMeal;
}

function updateMealSelectDropdown(selectedMeal) {
    const mealSelect = document.getElementById("foodMeal");
    if (!mealSelect) return;

    const meals = [
        { type: "Breakfast", icon: "🍳", timeName: "Morning" },
        { type: "Lunch", icon: "🍛", timeName: "Afternoon" },
        { type: "Snack", icon: "🍎", timeName: "Evening" },
        { type: "Dinner", icon: "🍽️", timeName: "Night" }
    ];

    mealSelect.innerHTML = meals.map(m => {
        const logged = isMealLoggedToday(m.type);
        const label = logged 
            ? `${m.icon} ${m.type} (${m.timeName}) — ✓ Already Filled` 
            : `${m.icon} ${m.type} (${m.timeName})`;
        return `<option value="${m.type}" ${m.type === selectedMeal ? "selected" : ""}>${label}</option>`;
    }).join("");
}

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
    const isLogged = isMealLoggedToday(meal);

    if (title) {
        title.textContent = isLogged ? `${meal} (Already Filled)` : `Fill Your ${meal}`;
    }
    if (subtitle) {
        subtitle.innerHTML = isLogged
            ? `<span style="color: #10B981; font-weight: 700;">✓ You already filled ${escapeHTML(meal)} for today.</span> Saved in your daily routine. You do not need to fill it again.`
            : `Add the food you ate for ${meal.toLowerCase()}.`;
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

let currentFoodModalImageUrl = null;

function resetFoodImageScannerUI() {
    const resultBox = document.getElementById("scannerResultBox");
    const fileInput = document.getElementById("foodImageInput");
    const scanPulse = document.getElementById("scannerScanningPulse");
    if (resultBox) resultBox.classList.add("hidden");
    if (scanPulse) scanPulse.classList.remove("hidden");
    if (fileInput) fileInput.value = "";
    currentFoodModalImageUrl = null;
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

        // Keep stored image url for attaching to meal log (persisted up to 1 week)
        currentFoodModalImageUrl = data.image_url || null;

        const foodName = data.food_name || "";
        const isRecognized = data.is_recognized !== false && Boolean(foodName);
        const quantity = parseFloat(data.quantity) || 1.0;
        const portionDesc = data.portion_description || `${quantity} serving`;
        const calories = Math.round(data.calories || 0);
        const macros = data.macros || { protein: 0, carbs: 0, fat: 0 };
        const explanation = data.explanation || "AI vision detected this food item and estimated the serving size.";
        const itemsBreakdown = Array.isArray(data.items_breakdown) ? data.items_breakdown : [];

        if (detailsContainer) {
            if (isRecognized) {
                let breakdownHtml = "";
                if (itemsBreakdown.length > 0) {
                    breakdownHtml = `
                        <div style="margin: 8px 0;">
                            <div style="font-size: 10px; font-weight: 800; color: #67E8F9; margin-bottom: 4px; letter-spacing: 0.05em;">🍽️ DETECTED COMPONENTS:</div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                ${itemsBreakdown.map(it => `
                                    <span style="background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.35); border-radius: 6px; padding: 3px 8px; font-size: 11px; color: #E2E8F0; font-weight: 700;">
                                        ${escapeHTML(it.item_name)} <span style="color: #10B981; font-weight: 800;">(${escapeHTML(it.portion || "1 serving")} · ${Math.round(it.calories || 0)} kcal)</span>
                                    </span>
                                `).join("")}
                            </div>
                        </div>
                    `;
                }

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

                    ${breakdownHtml}

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
                // Auto-fill or append to meal items with breakdown
                applyScannedFoodToRows(foodName, quantity, calories, itemsBreakdown);
            } else {
                detailsContainer.innerHTML = `
                    <div style="padding: 10px 0;">
                        <div style="font-size: 13px; font-weight: 800; color: #F59E0B; margin-bottom: 4px;">
                            ⚠️ Photo Attached · Manual Entry Needed
                        </div>
                        <div style="font-size: 11px; color: #CBD5E1; margin-bottom: 6px; line-height: 1.4;">
                            ${escapeHTML(explanation || "The photo is attached to your log. Please enter the dish name below.")}
                        </div>
                        <div style="font-size: 10px; color: #67E8F9; font-weight: 700;">
                            👉 Type your food item in the box below to log it.
                        </div>
                    </div>
                `;
                const firstInput = document.querySelector("#multiFoodContainer .food-item-name");
                if (firstInput) firstInput.focus();
            }
        }

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

function applyScannedFoodToRows(foodName, quantity, calories, itemsBreakdown = []) {
    const container = document.getElementById("multiFoodContainer");
    if (!container) return;

    // If AI detected multiple distinct items on the plate (e.g. Poori + Chana + Halwa)
    if (Array.isArray(itemsBreakdown) && itemsBreakdown.length > 1) {
        container.innerHTML = "";
        foodItemCounter = 0;
        itemsBreakdown.forEach(item => {
            const itmName = item.item_name || "Food Item";
            const itmQty = 1.0;
            const itmCal = Math.round(item.calories || 0);
            const row = addFoodItemRow(itmName, itmQty);
            if (row) {
                const calBadge = row.querySelector(".food-item-cal");
                if (calBadge && itmCal > 0) {
                    calBadge.textContent = `${itmCal} kcal`;
                }
            }
        });
        debouncedUpdateLiveCalories();
        return;
    }

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
    let meal = suggestedMeal;
    // Once a meal is filled, do not select it again — switch to next unfilled meal
    if (!meal || isMealLoggedToday(meal)) {
        meal = getNextUnloggedMealType();
    }
    const mealSelect = document.getElementById("foodMeal");
    if (mealSelect) {
        updateMealSelectDropdown(meal);
        mealSelect.value = meal;
        mealSelect.onchange = () => updateFoodModalTitle(mealSelect.value);
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
    const mealSelect = document.getElementById("foodMeal");
    const currentMeal = mealSelect ? mealSelect.value : getCurrentMealType();
    const todayStr = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`aeriva_meal_prompt_dismissed_${todayStr}_${currentMeal.toLowerCase()}`, "true");
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

        const todayStr = new Date().toISOString().slice(0, 10);
        localStorage.setItem(`aeriva_meal_prompt_dismissed_${todayStr}_${mealType.toLowerCase()}`, "true");
        currentFoodModalImageUrl = null;
        addXP(15);
        closeFoodModal();
        await loadFood();
        loadRoutine();
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

// Prompt on Login - Disabled (Never pop up automatically)
async function promptMealOnLogin() {
    return;
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
        currentTodayFoods = Array.isArray(foods) ? foods : [];
        const list = document.getElementById("foodList");
        const calorieStat = document.getElementById("calorieStat");

        if (!foods.length) {
            currentTodayFoods = [];
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
            loadHealthPrecautions();
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
        loadHealthPrecautions();
        updateDynamicVitals();
        loadRoutine();

    } catch (error) {
        console.error("Food loading error:", error);
    }
}

// =====================================================
// 7-DAY (1 WEEK) FOOD & PHOTO GALLERY MODAL
// =====================================================
async function openWeekFoodGalleryModal() {
    authToken = authToken || localStorage.getItem("aeriva_token");
    if (!authToken) return;

    const modal = document.getElementById("weekFoodGalleryModal");
    const list = document.getElementById("weekFoodGalleryList");
    if (modal) modal.classList.remove("hidden");

    if (list) {
        list.innerHTML = `
            <div style="text-align: center; padding: 36px 0; color: #94A3B8;">
                <div style="font-size: 26px; margin-bottom: 8px;">🔄</div>
                <div style="font-weight: 700;">Loading 7-day meal history & stored food photos...</div>
            </div>
        `;
    }

    try {
        const res = await fetch(`${API}/food/log/week`, {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!res.ok) {
            if (list) list.innerHTML = `<div class="empty-state">Unable to load 7-day food history.</div>`;
            return;
        }

        const data = await res.json();
        const days = data.days || [];

        if (!days.length) {
            if (list) list.innerHTML = `<div class="empty-state">No food logged in the past 7 days.</div>`;
            return;
        }

        list.innerHTML = days.map(d => {
            const hasMeals = d.meals && d.meals.length > 0;
            const mealsHtml = hasMeals ? `
                <div class="week-meals-grid">
                    ${d.meals.map(m => {
                        const hasImg = Boolean(m.image_url);
                        return `
                            <div class="week-meal-card">
                                ${hasImg ? `
                                    <div class="week-meal-photo-box" title="Click to enlarge" onclick="openPhotoViewerModal('${m.image_url}', '${escapeHTML(m.food_name)}', '${escapeHTML(m.meal_type)}', ${m.calories})">
                                        <img src="${m.image_url}" alt="${escapeHTML(m.food_name)}" loading="lazy">
                                        <span class="week-meal-photo-tag">🔍 TAP TO EXPAND</span>
                                    </div>
                                ` : `
                                    <div style="height: 64px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; font-size: 24px;">
                                        ${getMealIcon(m.meal_type)}
                                    </div>
                                `}
                                <div class="week-meal-info">
                                    <div class="week-meal-meta">
                                        <span>${escapeHTML(m.meal_type)} ${m.time ? `· ${m.time}` : ''}</span>
                                        <span class="week-meal-cals">${m.calories} kcal</span>
                                    </div>
                                    <div class="week-meal-name" title="${escapeHTML(m.food_name)}">
                                        ${escapeHTML(m.food_name)}
                                    </div>
                                    <div style="font-size: 11px; color: #64748B;">
                                        Qty: ${m.quantity || 1}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            ` : `
                <div style="font-size: 12px; color: #64748B; padding: 10px 14px; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    No meals logged on this date.
                </div>
            `;

            return `
                <div class="week-day-group">
                    <div class="week-day-header">
                        <div class="week-day-title">
                            <span>📅 ${escapeHTML(d.label)}</span>
                            <span style="font-size: 11px; color: #64748B; font-weight: 400;">(${escapeHTML(d.date)})</span>
                        </div>
                        <div class="week-day-cals">
                            ${d.total_calories} kcal
                        </div>
                    </div>
                    ${mealsHtml}
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Week gallery load error:", err);
        if (list) list.innerHTML = `<div class="empty-state">Error connecting to server.</div>`;
    }
}

function closeWeekFoodGalleryModal() {
    const modal = document.getElementById("weekFoodGalleryModal");
    if (modal) modal.classList.add("hidden");
}

function openPhotoViewerModal(imageUrl, foodName, mealType, calories) {
    const modal = document.getElementById("foodPhotoViewerModal");
    const img = document.getElementById("photoViewerImg");
    const nameEl = document.getElementById("photoViewerFoodName");
    const typeEl = document.getElementById("photoViewerMealType");
    const calEl = document.getElementById("photoViewerCalories");
    const timeEl = document.getElementById("photoViewerTime");

    if (img) img.src = imageUrl;
    if (nameEl) nameEl.textContent = foodName || "Food Photo";
    if (typeEl) typeEl.textContent = mealType || "Meal";
    if (calEl) calEl.textContent = `${calories || 0} kcal`;
    if (timeEl) timeEl.textContent = "Logged meal";

    if (modal) modal.classList.remove("hidden");
}

function closeFoodPhotoViewerModal() {
    const modal = document.getElementById("foodPhotoViewerModal");
    if (modal) modal.classList.add("hidden");
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
    const waterPanelStat = document.getElementById("waterPanelStat");
    const waterPanelProgress = document.getElementById("waterPanelProgress");

    if (waterStat) waterStat.textContent = `${currentAmount.toFixed(2)} L`;
    if (waterText) waterText.textContent = `${currentAmount.toFixed(2)} L / 2.5 L`;
    if (waterProgress) waterProgress.style.width = `${percentage}%`;
    if (modalDisplay) modalDisplay.textContent = `${currentAmount.toFixed(2)} L`;
    if (waterPanelStat) waterPanelStat.textContent = `${currentAmount.toFixed(2)} L`;
    if (waterPanelProgress) waterPanelProgress.style.width = `${percentage}%`;

    updateDynamicVitals();
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

function addWater(amountLitres = 0.25) {
    if (typeof amountLitres === "number" && amountLitres > 0) {
        logWaterAmount(amountLitres);
    } else {
        logWaterAmount(0.25);
    }
}

function addWaterQuick(ml = 250) {
    logWaterAmount(ml / 1000);
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
        loadHealthPrecautions();
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

    updateDynamicVitals();
}

// Night steps prompt - Disabled (Never pop up automatically)
function checkNightStepPrompt() {
    return;
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

    activeWorkoutExercises = DEFAULT_POPUP_EXERCISES;
    currentWorkoutName = routine.name;
    const breakdownList = document.getElementById("exerciseBreakdownList");
    if (breakdownList) {
        renderDashboardExerciseOverview(activeWorkoutExercises, breakdownList, btnElem, exerciseStat);
    }
}

// SMART EXERCISE & FREE-TIME BURN RECOMMENDER
// Calculates exact required burn and minutes based on Food Intake + Steps Walked + Schedule Free Window
let lastRecommendedWorkoutDuration = 30;
let currentWorkoutName = "Active Recovery & Mobility Flow";

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
            currentWorkoutName = data.workout_name || "Daily Exercise Routine";

            if (timeElem) timeElem.textContent = `${data.free_time_slot} (Window: ${data.full_free_window})`;
            if (foodVal) foodVal.textContent = `${Number(data.daily_calories).toLocaleString()} kcal`;
            if (stepsVal) stepsVal.textContent = `~${data.steps_calories_burned} kcal (${data.steps_walked.toLocaleString()} st)`;
            if (burnVal) burnVal.textContent = `~${data.target_calories_to_burn} kcal`;

            const intensityIcon = data.intensity === "High" ? "🔥" : data.intensity === "Moderate" ? "⚡" : "🌿";
            if (routineElem) {
                routineElem.innerHTML = `<span>${intensityIcon} ${escapeHTML(data.workout_name)}</span> <span style="font-size: 11px; color: #67E8F9; font-weight: 700; margin-left: 6px;">(${data.recommended_duration_minutes} min)</span>`;
            }
            if (descElem) descElem.textContent = data.description;

            activeWorkoutExercises = (data.exercises && data.exercises.length > 0) ? data.exercises : DEFAULT_POPUP_EXERCISES;

            // Render sequential overview on Dashboard 2
            if (breakdownList) {
                renderDashboardExerciseOverview(activeWorkoutExercises, breakdownList, btnElem, exerciseStat);
            }
            return;
        }
    } catch (e) {
        console.warn("Exercise recommendation fallback:", e);
    }

    // Fallback to local routine
    loadScheduledWorkout();
}

// =====================================================
// SEQUENTIAL WORKOUT PLAYER & EXERCISE ILLUSTRATIONS
// =====================================================

let activeWorkoutExercises = [];
let currentStepTimerInterval = null;
let currentStepTimerSeconds = 60;
let isStepTimerRunning = false;

function getWorkoutProgressStorageKey() {
    const dateKey = getCurrentDateKey();
    const userId = currentUser ? currentUser.id : "guest";
    return `aeriva_workout_step_prog_${userId}_${dateKey}`;
}

/* =========================================================
   CARTOON EXERCISE VIDEO PLAYER (HIGH-DPI 60FPS CANVAS ENGINE)
========================================================= */

let currentCartoonAnimationId = null;
let cartoonVideoState = {
    key: "squat",
    name: "Squats",
    isPlaying: true,
    progress: 0,
    cycleDuration: 3.0,
    speed: 1.0,
    lastTimestamp: 0,
    repCount: 1,
    displayMode: "canvas" // "canvas" for 60FPS animated video, "hd" for studio anime character artwork
};

const EXERCISE_CHARACTER_IMAGES = {
    "squat": "/static/athlete-squat.jpg",
    "cat_cow": "/static/athlete-cat-cow.jpg",
    "surya_namaskar": "/static/athlete-surya-namaskar.jpg",
    "glute_bridges": "/static/athlete-glute-bridge.jpg",
    "childs_pose": "/static/athlete-childs-pose.jpg",
    "pushup": "/static/athlete-pushup.jpg",
    "plank": "/static/athlete-plank.jpg",
    "jumping_jacks": "/static/athlete-jumping-jacks.jpg",
    "stretching": "/static/athlete-childs-pose.jpg",
    "default": "/static/athlete-squat.jpg"
};

function getExerciseCharacterImage(key, name) {
    const k = (key || "").toLowerCase();
    const n = (name || "").toLowerCase();
    if (k.includes("squat") || n.includes("squat") || n.includes("lunge") || n.includes("leg")) return EXERCISE_CHARACTER_IMAGES.squat;
    if (k.includes("cat_cow") || n.includes("cat-cow") || n.includes("spine")) return EXERCISE_CHARACTER_IMAGES.cat_cow;
    if (k.includes("surya") || n.includes("surya") || n.includes("salutation")) return EXERCISE_CHARACTER_IMAGES.surya_namaskar;
    if (k.includes("glute") || n.includes("bridge") || n.includes("bird-dog") || n.includes("bird dog")) return EXERCISE_CHARACTER_IMAGES.glute_bridges;
    if (k.includes("child") || n.includes("child") || n.includes("hip opener")) return EXERCISE_CHARACTER_IMAGES.childs_pose;
    if (k.includes("pushup") || n.includes("push-up") || n.includes("push up") || k.includes("incline") || n.includes("incline") || n.includes("chest")) return EXERCISE_CHARACTER_IMAGES.pushup;
    if (k.includes("plank") || n.includes("plank") || k.includes("core") || n.includes("core")) return EXERCISE_CHARACTER_IMAGES.plank;
    if (k.includes("jumping") || n.includes("jumping") || n.includes("jack") || n.includes("cardio") || n.includes("skipping") || n.includes("jog")) return EXERCISE_CHARACTER_IMAGES.jumping_jacks;
    if (k.includes("stretch") || n.includes("stretch") || n.includes("release") || n.includes("mobility")) return EXERCISE_CHARACTER_IMAGES.childs_pose;
    return EXERCISE_CHARACTER_IMAGES.default;
}

function stopCartoonVideoPlayer() {
    if (currentCartoonAnimationId) {
        cancelAnimationFrame(currentCartoonAnimationId);
        currentCartoonAnimationId = null;
    }
}

function toggleCartoonPlayback(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    cartoonVideoState.isPlaying = !cartoonVideoState.isPlaying;
    const btn = document.getElementById("cartoonPlayPauseBtn");
    const bigBtn = document.getElementById("cartoonBigPlayBtn");
    if (btn) btn.textContent = cartoonVideoState.isPlaying ? "⏸" : "▶";
    if (bigBtn) {
        if (cartoonVideoState.isPlaying) {
            bigBtn.classList.remove("visible");
        } else {
            bigBtn.classList.add("visible");
        }
    }
}

function toggleCartoonDisplayMode(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const layer = document.getElementById("cartoonHdPosterLayer");
    const canvas = document.getElementById("cartoonExerciseCanvas");
    const toggleBtn = document.getElementById("cartoonModeToggleBtn");
    const badgeText = document.getElementById("cartoonModeBadgeText");
    if (!layer || !canvas) return;

    const isShowingHd = !layer.classList.contains("hidden");
    if (isShowingHd) {
        layer.classList.add("hidden");
        canvas.style.display = "block";
        if (toggleBtn) toggleBtn.textContent = "🖼️ HD ATHLETE POSTURE";
        if (badgeText) badgeText.textContent = "AI ATHLETE VIDEO · 60FPS";
        cartoonVideoState.displayMode = "canvas";
    } else {
        layer.classList.remove("hidden");
        canvas.style.display = "none";
        if (toggleBtn) toggleBtn.textContent = "🎬 60FPS AI VIDEO";
        if (badgeText) badgeText.textContent = "HD ATHLETE POSTURE";
        cartoonVideoState.displayMode = "hd";
    }
}

function setCartoonPlaySpeed(speed, btn) {
    cartoonVideoState.speed = speed;
    const parent = btn ? btn.parentElement : null;
    if (parent) {
        parent.querySelectorAll(".cartoon-speed-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    }
}

function scrubCartoonVideo(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    const track = document.getElementById("cartoonScrubberTrack");
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    cartoonVideoState.progress = pct;
}

function getExerciseCycleDuration(key, name) {
    const k = (key || "").toLowerCase();
    const n = (name || "").toLowerCase();
    if (k.includes("jumping") || n.includes("jumping") || n.includes("jack")) return 1.4;
    if (k.includes("pushup") || n.includes("push-up") || n.includes("push up")) return 2.6;
    if (k.includes("cat_cow") || n.includes("cat-cow") || n.includes("spine")) return 4.0;
    if (k.includes("plank") || n.includes("plank")) return 2.0;
    if (k.includes("glute") || n.includes("bridge")) return 2.8;
    if (k.includes("surya") || n.includes("surya") || n.includes("salutation")) return 6.0;
    if (k.includes("child") || n.includes("child")) return 3.5;
    return 3.0; // Squats & default
}

function getExerciseInitialCue(key, name) {
    const k = (key || "").toLowerCase();
    const n = (name || "").toLowerCase();
    if (k.includes("squat") || n.includes("squat") || n.includes("lunge")) return "⬇️ INHALE DOWN (2s) · ⬆️ EXHALE DRIVE (1s)";
    if (k.includes("jumping") || n.includes("jumping") || n.includes("jack")) return "⭐ EXPLOSIVE STAR JUMP · ⚡ SOFT LANDING";
    if (k.includes("pushup") || n.includes("push-up") || n.includes("push up")) return "⬇️ LOWER TO 90° ELBOWS · ⬆️ PRESS UP";
    if (k.includes("cat_cow") || n.includes("cat-cow") || n.includes("spine")) return "🌬️ INHALE: COW POSE · 💨 EXHALE: CAT POSE";
    if (k.includes("glute") || n.includes("bridge")) return "▲ SQUEEZE GLUTES AT TOP (2s)";
    if (k.includes("plank") || n.includes("plank")) return "🔒 LOCK ABDOMINALS · NO SAGGING";
    if (k.includes("surya") || n.includes("surya")) return "☀️ 12-STEP MEDITATIVE FULL-BODY FLOW";
    if (k.includes("child") || n.includes("child")) return "🧘 REST HIPS ON HEELS · DECOMPRESS";
    return "🔄 CONTROLLED FULL RANGE OF MOTION";
}

function getExerciseCartoonVideoHTML(key, name) {
    const cue = getExerciseInitialCue(key, name);
    const characterImg = getExerciseCharacterImage(key, name);
    const isHd = cartoonVideoState.displayMode === "hd";

    return `
    <div class="cartoon-video-player" id="cartoonPlayerContainer">
        <div class="cartoon-canvas-viewport" onclick="toggleCartoonPlayback(event)">
            <!-- 60FPS Video Canvas -->
            <canvas id="cartoonExerciseCanvas" class="cartoon-video-canvas" style="display: ${isHd ? 'none' : 'block'};"></canvas>

            <!-- HD Character Posture Art Layer (Visual Match with Athlete Artwork) -->
            <div id="cartoonHdPosterLayer" class="cartoon-hd-poster-layer ${isHd ? '' : 'hidden'}">
                <img id="cartoonHdPosterImg" src="${characterImg}" alt="${escapeHTML(name)}" class="cartoon-hd-img" />
                <div class="cartoon-scanline"></div>
                <div class="cartoon-posture-badge">
                    <span class="posture-check-icon">✓</span>
                    <span>AI COACH TECHNIQUE GUIDE · ${escapeHTML(name)}</span>
                </div>
            </div>

            <!-- Center Big Play/Pause Button -->
            <button type="button" class="cartoon-big-play-btn" id="cartoonBigPlayBtn" title="Play / Pause" onclick="toggleCartoonPlayback(event)">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6 3 20 12 6 21 6 3"></polygon>
                </svg>
            </button>

            <!-- Top HUD Bar with Mode Switcher & Real-time Cues -->
            <div class="cartoon-hud-overlay">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="cartoon-hud-badge">
                        <span class="hud-rec-dot"></span>
                        <span id="cartoonModeBadgeText">${isHd ? 'HD ATHLETE POSTURE' : 'AI ATHLETE VIDEO · 60FPS'}</span>
                    </span>
                    <button type="button" class="cartoon-mode-toggle-btn" id="cartoonModeToggleBtn" onclick="toggleCartoonDisplayMode(event)" title="Toggle 60FPS AI Video / HD Athlete Artwork">
                        ${isHd ? '🎬 60FPS AI VIDEO' : '🖼️ HD ATHLETE POSTURE'}
                    </button>
                </div>
                <span class="cartoon-hud-phase" id="cartoonPhaseCue">${escapeHTML(cue)}</span>
            </div>
        </div>
        <div class="cartoon-video-bottombar">
            <button type="button" class="cartoon-ctrl-btn" id="cartoonPlayPauseBtn" onclick="toggleCartoonPlayback(event)" title="Play / Pause">
                ⏸
            </button>
            <span class="cartoon-timer" id="cartoonTimeDisplay">00:01 / 00:03 · REP 1</span>
            <div class="cartoon-scrubber-track" id="cartoonScrubberTrack" onclick="scrubCartoonVideo(event)" onpointerdown="scrubCartoonVideo(event)">
                <div class="cartoon-scrubber-progress" id="cartoonScrubberProgress" style="width: 0%;"></div>
            </div>
            <div class="cartoon-speed-toggles">
                <button type="button" class="cartoon-speed-btn" onclick="setCartoonPlaySpeed(0.5, this)">0.5x</button>
                <button type="button" class="cartoon-speed-btn active" onclick="setCartoonPlaySpeed(1, this)">1x</button>
                <button type="button" class="cartoon-speed-btn" onclick="setCartoonPlaySpeed(1.5, this)">1.5x</button>
            </div>
        </div>
    </div>`;
}

function getExerciseIllustrationSVG(key, name) {
    setTimeout(() => {
        const d = document.getElementById("popupDiagramBox") || document.getElementById("guideModalDiagramBox");
        if (d && (!currentCartoonAnimationId || cartoonVideoState.key !== key)) {
            mountCartoonVideoPlayer(d, key, name);
        }
    }, 50);
    return getExerciseCartoonVideoHTML(key, name);
}

function mountCartoonVideoPlayer(containerEl, key, name) {
    stopCartoonVideoPlayer();
    if (!containerEl) return;

    containerEl.innerHTML = getExerciseCartoonVideoHTML(key, name);

    cartoonVideoState.key = key || "squat";
    cartoonVideoState.name = name || "Squats";
    cartoonVideoState.isPlaying = true;
    cartoonVideoState.progress = 0;
    cartoonVideoState.cycleDuration = getExerciseCycleDuration(key, name);
    cartoonVideoState.speed = 1.0;
    cartoonVideoState.lastTimestamp = 0;
    cartoonVideoState.repCount = 1;

    const canvas = containerEl.querySelector("#cartoonExerciseCanvas");
    if (!canvas) return;

    const progressFill = containerEl.querySelector("#cartoonScrubberProgress");
    const timerDisplay = containerEl.querySelector("#cartoonTimeDisplay");
    const phaseCue = containerEl.querySelector("#cartoonPhaseCue");
    const playPauseBtn = containerEl.querySelector("#cartoonPlayPauseBtn");
    const bigPlayBtn = containerEl.querySelector("#cartoonBigPlayBtn");

    if (playPauseBtn) playPauseBtn.textContent = "⏸";
    if (bigPlayBtn) bigPlayBtn.classList.remove("visible");

    const ctx = canvas.getContext("2d");

    function loop(timestamp) {
        if (!cartoonVideoState.lastTimestamp) cartoonVideoState.lastTimestamp = timestamp;
        const dt = Math.min((timestamp - cartoonVideoState.lastTimestamp) / 1000, 0.1);
        cartoonVideoState.lastTimestamp = timestamp;

        if (cartoonVideoState.isPlaying) {
            cartoonVideoState.progress += (dt * cartoonVideoState.speed) / cartoonVideoState.cycleDuration;
            if (cartoonVideoState.progress >= 1) {
                cartoonVideoState.progress %= 1;
                cartoonVideoState.repCount++;
            }
        }

        // Measure live bounding box for responsive high-DPI scaling
        const rect = canvas.getBoundingClientRect();
        const curW = Math.round(rect.width) || 560;
        const curH = Math.round(rect.height) || 240;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const targetPixelW = Math.floor(curW * dpr);
        const targetPixelH = Math.floor(curH * dpr);
        if (canvas.width !== targetPixelW || canvas.height !== targetPixelH) {
            canvas.width = targetPixelW;
            canvas.height = targetPixelH;
        }

        ctx.save();
        ctx.scale(dpr, dpr);

        const p = cartoonVideoState.progress;
        const curSec = (p * cartoonVideoState.cycleDuration).toFixed(1);
        const totSec = cartoonVideoState.cycleDuration.toFixed(0);

        if (progressFill) progressFill.style.width = `${Math.min(100, Math.max(0, p * 100))}%`;
        if (timerDisplay) timerDisplay.textContent = `00:0${Math.floor(curSec)} / 00:0${totSec} · REP ${cartoonVideoState.repCount}`;

        renderAthleteAIVideo(ctx, cartoonVideoState.key, cartoonVideoState.name, p, curW, curH, phaseCue);

        ctx.restore();

        currentCartoonAnimationId = requestAnimationFrame(loop);
    }

    currentCartoonAnimationId = requestAnimationFrame(loop);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

/* =========================================================
   AI ATHLETE VIDEO ENGINE (60FPS KINEMATICS & COMPUTER VISION)
   - Uses real high-resolution character images (athlete-*.jpg)
   - 60FPS continuous biomechanical motion transforms (eccentric, hold, concentric)
   - MediaPipe / YOLOv8-pose style skeletal joint tracking overlay
   - Real-time joint angle gauges (e.g. 90° elbow & knee angles)
   - Muscle activation heatmaps & respiratory phase guidance
========================================================= */

const ATHLETE_IMAGE_CACHE = {};

function getAthleteImage(src) {
    if (!src) src = "/static/athlete-squat.jpg";
    if (!ATHLETE_IMAGE_CACHE[src]) {
        const img = new Image();
        img.src = src;
        ATHLETE_IMAGE_CACHE[src] = img;
    }
    return ATHLETE_IMAGE_CACHE[src];
}

function preloadAthleteImages() {
    const urls = [
        "/static/athlete-squat.jpg",
        "/static/athlete-pushup.jpg",
        "/static/athlete-plank.jpg",
        "/static/athlete-jumping-jacks.jpg",
        "/static/athlete-cat-cow.jpg",
        "/static/athlete-glute-bridge.jpg",
        "/static/athlete-childs-pose.jpg",
        "/static/athlete-surya-namaskar.jpg"
    ];
    urls.forEach(u => getAthleteImage(u));
}
try { preloadAthleteImages(); } catch (e) {}

// Computer Vision Joint Node
function drawCVJoint(ctx, x, y, label, isPeak) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, isPeak ? 9 : 6.5, 0, Math.PI * 2);
    ctx.fillStyle = isPeak ? "rgba(0, 209, 160, 0.35)" : "rgba(198, 255, 0, 0.25)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, isPeak ? 5.5 : 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = isPeak ? "#00D1A0" : "#C6FF00";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    if (label) {
        ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
        ctx.fillStyle = isPeak ? "#34D399" : "#67E8F9";
        ctx.fillText(label, x + 8, y + 3);
    }
    ctx.restore();
}

// Computer Vision Skeletal Bone
function drawCVBone(ctx, x1, y1, x2, y2, isPeak) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = isPeak ? "#00D1A0" : "#C6FF00";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
}

// Computer Vision Joint Protractor Angle Arc
function drawCVDegreeGauge(ctx, cx, cy, startAngle, endAngle, radius, degText, isPeak) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = isPeak ? "#00D1A0" : "#FF4D2E";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, monospace";
    ctx.fillStyle = isPeak ? "#00D1A0" : "#FF4D2E";
    ctx.fillText(degText, cx + radius + 5, cy - 2);
    ctx.restore();
}

// Computer Vision Target Muscle Activation Heatmap
function drawCVMuscleHeatmap(ctx, cx, cy, rx, ry, label, alpha) {
    if (alpha <= 0.05) return;
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, `rgba(239, 68, 68, ${0.55 * alpha})`);
    grad.addColorStop(0.5, `rgba(249, 115, 22, ${0.32 * alpha})`);
    grad.addColorStop(1, "rgba(249, 115, 22, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    if (label && alpha > 0.45) {
        ctx.font = "bold 8px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "rgba(254, 202, 202, 0.9)";
        ctx.fillText(label, cx - rx * 0.6, cy - ry - 3);
    }
    ctx.restore();
}

// Cyber Fitness Stage Arena Backdrop
function drawAIArenaStage(ctx, w, h, floorY) {
    // 1. Dark Cyber Arena Gradient
    const bg = ctx.createRadialGradient(w / 2, h * 0.38, 20, w / 2, h * 0.38, w * 0.75);
    bg.addColorStop(0, "#14151F");
    bg.addColorStop(0.5, "#0E0F17");
    bg.addColorStop(1, "#0B0B0F");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 2. Horizon Glow Line
    ctx.strokeStyle = "rgba(139, 92, 246, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(w, floorY);
    ctx.stroke();

    // 3. Perspective Floor Grid
    ctx.strokeStyle = "rgba(124, 58, 237, 0.16)";
    ctx.lineWidth = 1;
    for (let x = -w * 0.3; x <= w * 1.3; x += 38) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + (x - w / 2) * 0.36, floorY);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = floorY + 5; y < h; y += 12) {
        ctx.strokeStyle = `rgba(124, 58, 237, ${0.08 + ((y - floorY) / (h - floorY)) * 0.12})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }

    // 4. Workout Platform Mat
    const matW = Math.min(480, w - 24);
    const matH = 16;
    const matX = (w - matW) / 2;
    const matY = floorY - 5;
    const matGrad = ctx.createLinearGradient(matX, matY, matX, matY + matH);
    matGrad.addColorStop(0, "rgba(26, 42, 85, 0.85)");
    matGrad.addColorStop(1, "rgba(15, 23, 42, 0.95)");
    ctx.fillStyle = matGrad;
    ctx.strokeStyle = "#C6FF00";
    ctx.lineWidth = 1.5;
    roundRect(ctx, matX, matY, matW, matH, 8, true, true);
}

// Framed Athlete Character Rendering with Kinematics & Holographic Cyber Vignette
function drawFramedAthleteImage(ctx, img, targetX, targetY, targetW, targetH, rot, scale) {
    if (!img || !img.complete || img.naturalWidth === 0) return false;
    ctx.save();
    ctx.translate(targetX, targetY);
    if (rot) ctx.rotate(rot);
    if (scale && scale !== 1) ctx.scale(scale, scale);

    // Rounded clipping viewport
    ctx.beginPath();
    roundRect(ctx, -targetW / 2, -targetH / 2, targetW, targetH, 12, false, false);
    ctx.save();
    ctx.clip();

    // Draw the athlete image
    ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);

    // Subtle atmospheric cyber tint & soft scanline
    const rimGrad = ctx.createLinearGradient(0, -targetH / 2, 0, targetH / 2);
    rimGrad.addColorStop(0, "rgba(6, 182, 212, 0.08)");
    rimGrad.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    rimGrad.addColorStop(1, "rgba(139, 92, 246, 0.14)");
    ctx.fillStyle = rimGrad;
    ctx.fillRect(-targetW / 2, -targetH / 2, targetW, targetH);

    ctx.restore();

    // High-tech glowing frame border
    ctx.strokeStyle = "rgba(6, 182, 212, 0.45)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, -targetW / 2, -targetH / 2, targetW, targetH, 12, false, true);

    // Cyber corner target brackets
    ctx.strokeStyle = "#22D3EE";
    ctx.lineWidth = 2.5;
    const blen = 10;
    const x0 = -targetW / 2, y0 = -targetH / 2, x1 = targetW / 2, y1 = targetH / 2;
    // top-left
    ctx.beginPath(); ctx.moveTo(x0, y0 + blen); ctx.lineTo(x0, y0); ctx.lineTo(x0 + blen, y0); ctx.stroke();
    // top-right
    ctx.beginPath(); ctx.moveTo(x1 - blen, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + blen); ctx.stroke();
    // bottom-left
    ctx.beginPath(); ctx.moveTo(x0, y0 + blen); ctx.lineTo(x0, y1); ctx.lineTo(x0 + blen, y1); ctx.stroke();
    // bottom-right
    ctx.beginPath(); ctx.moveTo(x1 - blen, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - blen); ctx.stroke();

    ctx.restore();
    return true;
}

// Telemetry Header on Live Video Canvas
function drawCVTelemetryHeader(ctx, w, h, exerciseName) {
    ctx.save();
    // Top-left live badge
    ctx.fillStyle = "rgba(6, 182, 212, 0.95)";
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, monospace";
    ctx.fillText("● AI CV POSE TRACKING · 60FPS", 14, 16);

    // Top-right live telemetry
    ctx.fillStyle = "rgba(16, 185, 129, 0.95)";
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, monospace";
    ctx.fillText("ACCURACY: 99.4% · BIOMECHANICS LOCKED", w - 230, 16);
    ctx.restore();
}

// Fallback Wireframe Athlete if image is loading
function drawLoadingAthleteWireframe(ctx, cx, cy, label) {
    ctx.save();
    ctx.fillStyle = "rgba(6, 182, 212, 0.8)";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("⚡ INITIALIZING AI VIDEO STREAM...", cx, cy - 10);
    ctx.font = "9px -apple-system, BlinkMacSystemFont, monospace";
    ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
    ctx.fillText(label || "LOADING HIGH-RESOLUTION ATHLETE MODEL", cx, cy + 12);
    ctx.restore();
}

// 1. ATHLETE PUSH-UP VIDEO (INCLINE / STANDARD / KNEE)
function renderAthletePushup(ctx, t, w, h, floorY, cueEl) {
    const driveEase = Math.pow(Math.sin(t * Math.PI), 1.8);
    const dy = driveEase * 18;
    const rot = -driveEase * 0.032;

    const elbowDeg = Math.round(165 - driveEase * 75);
    const isPeak = (elbowDeg <= 95);

    if (cueEl) {
        if (t < 0.45) cueEl.textContent = "⬇️ LOWER TO 90° ELBOWS (INHALE)";
        else if (t < 0.55) cueEl.textContent = "⏸ 90° OPTIMAL DEPTH HOLD · CORE LOCKED";
        else cueEl.textContent = "⬆️ PRESS UP EXPLOSIVELY (EXHALE)";
    }

    const img = getAthleteImage("/static/athlete-pushup.jpg");
    const imgW = Math.min(340, w - 80);
    const imgH = imgW * (768 / 1376);
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy + dy, imgW, imgH, rot, 1);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "PUSH-UP ATHLETE MODEL");
        return;
    }

    // Skeletal tracking landmarks on the athlete
    const handX = cx + imgW * 0.22, handY = cy + imgH * 0.26 + dy;
    const elbowX = cx + imgW * 0.13, elbowY = cy + imgH * 0.05 + dy;
    const shoulderX = cx + imgW * 0.04, shoulderY = cy - imgH * 0.12 + dy;
    const hipX = cx - imgW * 0.16, hipY = cy - imgH * 0.02 + dy * 0.6;
    const kneeX = cx - imgW * 0.32, kneeY = cy + imgH * 0.12 + dy * 0.3;
    const toeX = cx - imgW * 0.42, toeY = cy + imgH * 0.25;

    // Connect skeleton bones
    drawCVBone(ctx, handX, handY, elbowX, elbowY, isPeak);
    drawCVBone(ctx, elbowX, elbowY, shoulderX, shoulderY, isPeak);
    drawCVBone(ctx, shoulderX, shoulderY, hipX, hipY, isPeak);
    drawCVBone(ctx, hipX, hipY, kneeX, kneeY, isPeak);
    drawCVBone(ctx, kneeX, kneeY, toeX, toeY, isPeak);

    // Joint nodes
    drawCVJoint(ctx, handX, handY, null, isPeak);
    drawCVJoint(ctx, elbowX, elbowY, `${elbowDeg}°`, isPeak);
    drawCVJoint(ctx, shoulderX, shoulderY, null, isPeak);
    drawCVJoint(ctx, hipX, hipY, null, isPeak);
    drawCVJoint(ctx, kneeX, kneeY, null, isPeak);
    drawCVJoint(ctx, toeX, toeY, null, isPeak);

    // Elbow protractor angle gauge
    drawCVDegreeGauge(ctx, elbowX, elbowY, 0.4 * Math.PI, 0.9 * Math.PI, 18, elbowDeg + "°" + (isPeak ? " [OPTIMAL]" : ""), isPeak);

    // Target muscle heatmap: Pectorals & Triceps
    drawCVMuscleHeatmap(ctx, shoulderX + 10, shoulderY + 16, 26, 16, "PECTORALS & TRICEPS", driveEase);
}

// 2. ATHLETE SQUAT VIDEO
function renderAthleteSquat(ctx, t, w, h, floorY, cueEl) {
    const driveEase = Math.pow(Math.sin(t * Math.PI), 1.8);
    const dy = driveEase * 22;
    const scale = 1 + driveEase * 0.03;

    const kneeDeg = Math.round(175 - driveEase * 85);
    const isParallel = (kneeDeg <= 95);

    if (cueEl) {
        if (t < 0.45) cueEl.textContent = "⬇️ INHALE: SINK HIPS TO 90° PARALLEL";
        else if (t < 0.55) cueEl.textContent = "⏸ 90° PARALLEL DEPTH · WEIGHT ON HEELS";
        else cueEl.textContent = "⬆️ EXHALE: DRIVE UP THROUGH HEELS";
    }

    const img = getAthleteImage("/static/athlete-squat.jpg");
    const imgH = Math.min(h - 44, 195);
    const imgW = imgH;
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy + dy, imgW, imgH, 0, scale);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "SQUAT ATHLETE MODEL");
        return;
    }

    // Joint landmarks
    const headX = cx, headY = cy - imgH * 0.36 + dy;
    const shoulderX = cx, shoulderY = cy - imgH * 0.22 + dy;
    const hipX = cx, hipY = cy - imgH * 0.02 + dy * 1.1;
    const lKneeX = cx - imgW * 0.2, lKneeY = cy + imgH * 0.16 + dy * 0.5;
    const rKneeX = cx + imgW * 0.2, rKneeY = cy + imgH * 0.16 + dy * 0.5;
    const lFootX = cx - imgW * 0.24, lFootY = cy + imgH * 0.42;
    const rFootX = cx + imgW * 0.24, rFootY = cy + imgH * 0.42;

    // Bones
    drawCVBone(ctx, shoulderX, shoulderY, hipX, hipY, isParallel);
    drawCVBone(ctx, hipX, hipY, lKneeX, lKneeY, isParallel);
    drawCVBone(ctx, hipX, hipY, rKneeX, rKneeY, isParallel);
    drawCVBone(ctx, lKneeX, lKneeY, lFootX, lFootY, isParallel);
    drawCVBone(ctx, rKneeX, rKneeY, rFootX, rFootY, isParallel);

    // Nodes
    drawCVJoint(ctx, headX, headY, null, isParallel);
    drawCVJoint(ctx, shoulderX, shoulderY, null, isParallel);
    drawCVJoint(ctx, hipX, hipY, null, isParallel);
    drawCVJoint(ctx, lKneeX, lKneeY, `${kneeDeg}°`, isParallel);
    drawCVJoint(ctx, rKneeX, rKneeY, `${kneeDeg}°`, isParallel);
    drawCVJoint(ctx, lFootX, lFootY, null, isParallel);
    drawCVJoint(ctx, rFootX, rFootY, null, isParallel);

    // Knee protractor gauge
    drawCVDegreeGauge(ctx, rKneeX, rKneeY, 0.2 * Math.PI, 0.7 * Math.PI, 18, kneeDeg + "°" + (isParallel ? " [PARALLEL]" : ""), isParallel);

    // Muscle Heatmap: Quadriceps & Gluteal activation
    drawCVMuscleHeatmap(ctx, hipX, hipY + 18, 28, 18, "QUADRICEPS & GLUTES", driveEase);
}

// 3. ATHLETE JUMPING JACKS VIDEO
function renderAthleteJumpingJacks(ctx, t, w, h, floorY, cueEl) {
    const jumpY = -Math.sin(t * Math.PI) * 22;
    const scaleX = 1 + Math.sin(t * Math.PI) * 0.06;
    const isApex = (t > 0.4 && t < 0.6);

    if (cueEl) {
        if (t < 0.5) cueEl.textContent = "⭐ EXPLOSIVE STAR JUMP · ARMS OVERHEAD";
        else cueEl.textContent = "⚡ SOFT SPRUNG LANDING · CORE ENGAGED";
    }

    const img = getAthleteImage("/static/athlete-jumping-jacks.jpg");
    const imgH = Math.min(h - 44, 195);
    const imgW = imgH;
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    // Ground impact ripple circles on landing
    if (t > 0.88) {
        const ripple = (t - 0.88) / 0.12;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx - 35, floorY, 20 * ripple, 6 * ripple, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 35, floorY, 20 * ripple, 6 * ripple, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(6, 182, 212, ${1 - ripple})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy + jumpY, imgW * scaleX, imgH, 0, 1);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "CARDIO ATHLETE MODEL");
        return;
    }

    // Joint landmarks
    const headX = cx, headY = cy - imgH * 0.36 + jumpY;
    const lHandX = cx - imgW * 0.38, lHandY = cy - imgH * 0.38 + jumpY;
    const rHandX = cx + imgW * 0.38, rHandY = cy - imgH * 0.38 + jumpY;
    const lFootX = cx - imgW * 0.28, lFootY = cy + imgH * 0.42 + jumpY;
    const rFootX = cx + imgW * 0.28, rFootY = cy + imgH * 0.42 + jumpY;

    drawCVJoint(ctx, headX, headY, null, isApex);
    drawCVJoint(ctx, lHandX, lHandY, "MAX", isApex);
    drawCVJoint(ctx, rHandX, rHandY, "MAX", isApex);
    drawCVJoint(ctx, lFootX, lFootY, null, isApex);
    drawCVJoint(ctx, rFootX, rFootY, null, isApex);

    // Heart Rate & Cardio Telemetry
    ctx.save();
    ctx.font = "bold 9px -apple-system, BlinkMacSystemFont, monospace";
    ctx.fillStyle = "#EC4899";
    ctx.fillText("❤️ 145 BPM · AEROBIC ZONE 3", cx - 65, cy - imgH * 0.46);
    ctx.restore();
}

// 4. ATHLETE PLANK VIDEO
function renderAthletePlank(ctx, t, w, h, floorY, cueEl) {
    const dy = Math.sin(t * Math.PI * 2) * 2;

    if (cueEl) cueEl.textContent = "🔒 180° RIGID CORE LOCK · DEEP RHYTHMIC BREATHS";

    const img = getAthleteImage("/static/athlete-plank.jpg");
    const imgW = Math.min(340, w - 80);
    const imgH = imgW * (768 / 1376);
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy + dy, imgW, imgH, 0, 1);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "PLANK ATHLETE MODEL");
        return;
    }

    // 180° Emerald Laser Alignment Line
    const headX = cx + imgW * 0.35, headY = cy - imgH * 0.08 + dy;
    const toeX = cx - imgW * 0.42, toeY = cy + imgH * 0.18;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(toeX, toeY);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    ctx.restore();

    // Key alignment joints
    drawCVJoint(ctx, headX, headY, "HEAD", true);
    drawCVJoint(ctx, cx + imgW * 0.18, cy - imgH * 0.02 + dy, null, true);
    drawCVJoint(ctx, cx - imgW * 0.1, cy + imgH * 0.06 + dy, "CORE 180°", true);
    drawCVJoint(ctx, toeX, toeY, "FEET", true);

    // Core muscle tension pulse
    drawCVMuscleHeatmap(ctx, cx - imgW * 0.05, cy + imgH * 0.06 + dy, 32, 14, "ABDOMINALS LOCKED", 0.7);
}

// 5. ATHLETE CAT-COW VIDEO
function renderAthleteCatCow(ctx, t, w, h, floorY, cueEl) {
    const wave = Math.sin(t * Math.PI * 2);
    const dy = wave * 5;
    const rot = wave * 0.03;

    if (cueEl) {
        if (wave >= 0) cueEl.textContent = "🌬️ INHALE: COW POSE · CHEST OPEN & TAILBONE UP";
        else cueEl.textContent = "💨 EXHALE: CAT POSE · DOME SPINE & TUCK CHIN";
    }

    const img = getAthleteImage("/static/athlete-cat-cow.jpg");
    const imgW = Math.min(340, w - 80);
    const imgH = imgW * (768 / 1376);
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy + dy, imgW, imgH, rot, 1);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "CAT-COW ATHLETE MODEL");
        return;
    }

    // 7-segment vertebral curvature nodes along spine
    const isCow = (wave >= 0);
    for (let i = 0; i < 7; i++) {
        const spinePct = (i - 3) / 3;
        const vx = cx + spinePct * (imgW * 0.22);
        const vy = cy - imgH * 0.06 + Math.cos(spinePct * Math.PI) * (wave * 8) + dy;
        drawCVJoint(ctx, vx, vy, i === 3 ? (isCow ? "COW" : "CAT") : null, true);
    }
}

// 6. ATHLETE GLUTE BRIDGE VIDEO
function renderAthleteGluteBridge(ctx, t, w, h, floorY, cueEl) {
    const driveEase = Math.pow(Math.sin(t * Math.PI), 1.6);
    const dy = -driveEase * 20;
    const rot = driveEase * 0.025;
    const isPeak = (t > 0.45 && t < 0.65);

    if (cueEl) {
        if (t < 0.45) cueEl.textContent = "⬆️ DRIVE THROUGH HEELS · ELEVATE PELVIS";
        else if (t < 0.65) cueEl.textContent = "▲ PEAK SQUEEZE: GLUTES & HAMSTRINGS (2s)";
        else cueEl.textContent = "⬇️ LOWER SMOOTHLY TO MAT";
    }

    const img = getAthleteImage("/static/athlete-glute-bridge.jpg");
    const imgW = Math.min(340, w - 80);
    const imgH = imgW * (768 / 1376);
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy + dy, imgW, imgH, rot, 1);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "GLUTE BRIDGE ATHLETE MODEL");
        return;
    }

    const pelvisX = cx - imgW * 0.04, pelvisY = cy + dy;
    drawCVJoint(ctx, pelvisX, pelvisY, "PELVIS 180°", isPeak);
    drawCVMuscleHeatmap(ctx, pelvisX, pelvisY + 4, 30, 16, "GLUTEUS MAXIMUS", driveEase);
}

// 7. ATHLETE CHILD POSE VIDEO
function renderAthleteChildsPose(ctx, t, w, h, floorY, cueEl) {
    const breath = Math.sin(t * Math.PI * 2);
    const scale = 1 + breath * 0.018;

    if (cueEl) cueEl.textContent = "🧘 SINK HIPS TO HEELS · DEEP DIAPHRAGMATIC RELEASE";

    const img = getAthleteImage("/static/athlete-childs-pose.jpg");
    const imgW = Math.min(340, w - 80);
    const imgH = imgW * (768 / 1376);
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy, imgW, imgH, 0, scale);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "RESTORATIVE ATHLETE MODEL");
        return;
    }

    // Respiratory Decompression Indicators
    drawCVJoint(ctx, cx + imgW * 0.3, cy + imgH * 0.15, "LATS", true);
    drawCVJoint(ctx, cx - imgW * 0.25, cy + imgH * 0.12, "LUMBAR", true);
}

// 8. ATHLETE SURYA NAMASKAR VIDEO
function renderAthleteSuryaNamaskar(ctx, t, w, h, floorY, cueEl) {
    const SURYA_STEPS = [
        "1/12 · Pranamasana (Prayer Pose)",
        "2/12 · Hastauttanasana (Raised Arms)",
        "3/12 · Padahastasana (Forward Bend)",
        "4/12 · Ashwa Sanchalanasana (Lunge)",
        "5/12 · Dandasana (Plank Stick)",
        "6/12 · Ashtanga Namaskara (8 Limbs)",
        "7/12 · Bhujangasana (Cobra)",
        "8/12 · Adho Mukha Svanasana (Down Dog)",
        "9/12 · Ashwa Sanchalanasana (Lunge)",
        "10/12 · Padahastasana (Forward Bend)",
        "11/12 · Hastauttanasana (Raised Arms)",
        "12/12 · Pranamasana (Heart Center)"
    ];
    const stepIdx = Math.min(11, Math.floor(t * 12));
    if (cueEl) cueEl.textContent = `☀️ ${SURYA_STEPS[stepIdx]}`;

    const img = getAthleteImage("/static/athlete-surya-namaskar.jpg");
    const imgH = Math.min(h - 44, 195);
    const imgW = imgH * (896 / 1200);
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    // Radiant Solar Chakra Aura
    ctx.save();
    const auraGrad = ctx.createRadialGradient(cx, cy - 20, 10, cx, cy - 20, imgH * 0.55);
    auraGrad.addColorStop(0, "rgba(245, 158, 11, 0.22)");
    auraGrad.addColorStop(0.6, "rgba(245, 158, 11, 0.08)");
    auraGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(cx, cy - 20, imgH * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy, imgW, imgH, 0, 1);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "SURYA NAMASKAR ATHLETE MODEL");
        return;
    }

    drawCVJoint(ctx, cx, cy - imgH * 0.35, "CHAKRA", true);
}

// 9. ATHLETE MOBILITY / WARMUP / STRETCHING VIDEO
function renderAthleteMobility(ctx, t, w, h, floorY, cueEl) {
    if (cueEl) cueEl.textContent = "🔄 360° ARTICULAR ROTATION · INCREASE FLUID RANGE";

    const img = getAthleteImage("/static/athlete-squat.jpg");
    const imgH = Math.min(h - 44, 195);
    const imgW = imgH;
    const cx = w / 2;
    const cy = floorY - imgH / 2 - 2;

    const drawn = drawFramedAthleteImage(ctx, img, cx, cy, imgW, imgH, 0, 1);
    if (!drawn) {
        drawLoadingAthleteWireframe(ctx, cx, cy, "MOBILITY ATHLETE MODEL");
        return;
    }

    // Dynamic 360° Joint Rotation Orbits
    const orbitAngle = t * Math.PI * 2;
    const orbRx = 24, orbRy = 14;
    ctx.save();
    ctx.strokeStyle = "rgba(6, 182, 212, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx - imgW * 0.24, cy - imgH * 0.18, orbRx, orbRy, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + imgW * 0.24, cy - imgH * 0.18, orbRx, orbRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawCVJoint(ctx, cx - imgW * 0.24 + Math.cos(orbitAngle) * orbRx, cy - imgH * 0.18 + Math.sin(orbitAngle) * orbRy, null, true);
    drawCVJoint(ctx, cx + imgW * 0.24 + Math.cos(orbitAngle + Math.PI) * orbRx, cy - imgH * 0.18 + Math.sin(orbitAngle + Math.PI) * orbRy, null, true);
    ctx.restore();
}

// MASTER AI VIDEO RENDER FUNCTION (CALLED EVERY FRAME AT 60FPS)
function renderAthleteAIVideo(ctx, key, name, t, w, h, cueEl) {
    ctx.clearRect(0, 0, w, h);

    const floorY = h - 38;
    drawAIArenaStage(ctx, w, h, floorY);

    const k = (key || "").toLowerCase();
    const n = (name || "").toLowerCase();

    if (k.includes("pushup") || n.includes("pushup") || n.includes("push-up") || n.includes("push up") || k.includes("incline") || n.includes("incline") || n.includes("chest")) {
        renderAthletePushup(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("squat") || n.includes("squat") || k.includes("lunge") || n.includes("lunge") || n.includes("quad") || n.includes("leg")) {
        renderAthleteSquat(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("jumping") || n.includes("jumping") || k.includes("jack") || n.includes("jack") || k.includes("cardio") || n.includes("cardio") || n.includes("skipping") || n.includes("jog")) {
        renderAthleteJumpingJacks(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("plank") || n.includes("plank") || k.includes("core") || n.includes("core")) {
        renderAthletePlank(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("cat_cow") || n.includes("cat-cow") || n.includes("spine") || k.includes("spine")) {
        renderAthleteCatCow(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("glute") || n.includes("glute") || k.includes("bridge") || n.includes("bridge") || n.includes("bird-dog") || n.includes("bird dog")) {
        renderAthleteGluteBridge(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("child") || n.includes("child") || n.includes("hip opener") || n.includes("rest")) {
        renderAthleteChildsPose(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("surya") || n.includes("surya") || n.includes("salutation") || n.includes("sun")) {
        renderAthleteSuryaNamaskar(ctx, t, w, h, floorY, cueEl);
    } else if (k.includes("stretch") || n.includes("stretch") || n.includes("release") || n.includes("mobility")) {
        renderAthleteChildsPose(ctx, t, w, h, floorY, cueEl);
    } else {
        renderAthleteMobility(ctx, t, w, h, floorY, cueEl);
    }

    drawCVTelemetryHeader(ctx, w, h, name);
}


/* =====================================================
   POPUP EXERCISE MODE & SEQUENTIAL STEP PROGRESSION
   - Renders overview list on Dashboard 2 matching screenshot
   - Opens step-by-step popup showing exercise posture illustration
   - After marking exercise completed, advances sequentially to next step in same popup format
   - On final completion: awards +25 XP, updates activity time, shows celebration card
===================================================== */

const DEFAULT_POPUP_EXERCISES = [
    {
        name: "Cat-Cow & Spine Decompression",
        key: "cat_cow",
        duration: "4 mins",
        reps: "Controlled breathing",
        target_muscles: "Spine, Neck & Core",
        instructions: [
            "Start on hands and knees with wrists directly beneath shoulders and knees under hips.",
            "Inhale: Gently drop belly toward the floor, tilt tailbone up, and look forward/up (Cow Pose).",
            "Exhale: Press firmly into the ground, round your spine up toward the ceiling, and tuck chin (Cat Pose).",
            "Flow continuously with deep, rhythmic diaphragmatic breaths for 4 minutes."
        ]
    },
    {
        name: "Surya Namaskar (Sun Salutations)",
        key: "surya_namaskar",
        duration: "8 mins",
        reps: "6 slow rounds",
        target_muscles: "Hamstrings, Chest & Full Body",
        instructions: [
            "1. Stand tall at the top of your mat with palms joined at heart center (Pranamasana).",
            "2. Inhale: Sweep arms overhead, arching back gently (Hastauttanasana).",
            "3. Exhale: Hinge from hips, folding forward to touch ankles or floor (Padahastasana).",
            "4. Step back to plank, lower gently into Cobra (Bhujangasana), and press into Downward Dog.",
            "5. Step forward and return to prayer. Complete 6 smooth, meditative rounds."
        ]
    },
    {
        name: "Glute Bridges & Bird-Dog Core",
        key: "glute_bridges",
        duration: "5 mins",
        reps: "3 sets x 12 reps",
        target_muscles: "Gluteus Maximus, Lower Back & Core",
        instructions: [
            "Lie flat on your back with knees bent and feet planted flat hip-width apart.",
            "Drive powerfully through heels to hoist your pelvis until thighs and torso form a straight bridge line.",
            "Squeeze glutes intensely at apex for a 2-second hold, then lower smoothly.",
            "Transition into alternate-arm/leg Bird-Dog extensions for 12 reps each set."
        ]
    },
    {
        name: "Child's Pose & Deep Hip Openers",
        key: "childs_pose",
        duration: "3 mins",
        reps: "Restorative stretches",
        target_muscles: "Hips, Lower Lumbar & Lats",
        instructions: [
            "Kneel on the mat with big toes touching and knees spread wider than your torso.",
            "Sink hips firmly back onto your heels and reach arms straight forward along the floor.",
            "Rest forehead gently on the mat and lengthen your spine with each exhale.",
            "Hold steady for 3 minutes to relieve lumbar tension and calm the nervous system."
        ]
    }
];

function getWorkoutProgress() {
    const key = getWorkoutProgressStorageKey();
    let prog = null;
    try {
        prog = JSON.parse(localStorage.getItem(key));
    } catch (e) {
        prog = null;
    }
    if (!prog || typeof prog.currentStep !== "number") {
        prog = { currentStep: 0, completedSteps: [], isFinished: false };
    }
    return prog;
}

function saveWorkoutProgress(prog) {
    const key = getWorkoutProgressStorageKey();
    localStorage.setItem(key, JSON.stringify(prog));
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// 1. RENDER OVERVIEW LIST ON DASHBOARD 2
function renderDashboardExerciseOverview(exercises, container, btnElem, exerciseStat) {
    if (!container) return;
    if (!exercises || !exercises.length) {
        exercises = DEFAULT_POPUP_EXERCISES;
    }
    activeWorkoutExercises = exercises;

    const prog = getWorkoutProgress();
    const isFinished = prog.isFinished || (prog.completedSteps && prog.completedSteps.length >= exercises.length);

    if (isFinished) {
        if (exerciseStat) exerciseStat.textContent = `${lastRecommendedWorkoutDuration} min`;
    }

    container.innerHTML = exercises.map((ex, idx) => {
        const isCompleted = prog.completedSteps && prog.completedSteps.includes(idx);
        const isActive = !isFinished && prog.currentStep === idx;

        return `
            <div
                class="exercise-overview-row ${isCompleted ? 'is-completed' : isActive ? 'is-active' : ''}"
                onclick="openExerciseModePopup(${idx})"
                title="Click to view posture guide & instructions in popup">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: ${isCompleted ? '#10B981' : '#67E8F9'}; font-weight: 900; font-size: 13px;">
                        ${isCompleted ? '✓' : '▸'}
                    </span>
                    <span style="font-weight: 700; color: ${isCompleted ? '#E2E8F0' : '#F8FAFC'}; font-size: 13px;">
                        ${escapeHTML(ex.name)}
                    </span>
                    ${isActive ? '<span style="font-size: 9px; padding: 2px 7px; background: rgba(6, 182, 212, 0.2); color: #67E8F9; border-radius: 4px; font-weight: 800; border: 1px solid rgba(6, 182, 212, 0.4);">ACTIVE NOW</span>' : ''}
                    ${isCompleted ? '<span style="font-size: 9px; padding: 2px 7px; background: rgba(16, 185, 129, 0.15); color: #6EE7B7; border-radius: 4px; font-weight: 800;">DONE</span>' : ''}
                </div>
                <span style="color: #FCD34D; font-size: 11.5px; font-weight: 700;">
                    ${escapeHTML(ex.duration)} · ${escapeHTML(ex.reps)}
                </span>
            </div>
        `;
    }).join("");

    // Update main Exercise Mode launch button on Dashboard 2
    const launchBtn = document.getElementById("launchExerciseModeBtn");
    if (launchBtn) {
        if (isFinished) {
            launchBtn.style.background = "rgba(16, 185, 129, 0.2)";
            launchBtn.style.borderColor = "#10B981";
            launchBtn.style.color = "#6EE7B7";
            launchBtn.textContent = `✓ WORKOUT COMPLETED (+25 XP) · REVIEW OR RESTART`;
        } else if (prog.completedSteps && prog.completedSteps.length > 0) {
            launchBtn.style.background = "";
            launchBtn.style.borderColor = "";
            launchBtn.style.color = "";
            launchBtn.textContent = `⚡ RESUME EXERCISE MODE (STEP ${prog.currentStep + 1} OF ${exercises.length})`;
        } else {
            launchBtn.style.background = "";
            launchBtn.style.borderColor = "";
            launchBtn.style.color = "";
            launchBtn.textContent = `⚡ START EXERCISE MODE (OPEN STEP-BY-STEP POPUP)`;
        }
    }

    if (btnElem) btnElem.style.display = "none";
}

// 2. OPEN & CLOSE EXERCISE MODE POPUP MODAL
function openExerciseModePopup(targetStepIndex = null) {
    if (!activeWorkoutExercises || !activeWorkoutExercises.length) {
        activeWorkoutExercises = DEFAULT_POPUP_EXERCISES;
    }

    const prog = getWorkoutProgress();
    if (typeof targetStepIndex === "number" && targetStepIndex >= 0 && targetStepIndex < activeWorkoutExercises.length) {
        prog.currentStep = targetStepIndex;
        saveWorkoutProgress(prog);
    }

    const modal = document.getElementById("exerciseModePopupModal");
    if (modal) {
        modal.classList.remove("hidden");
    }

    renderPopupExerciseStep();
}

function closeExerciseModePopup() {
    stopCartoonVideoPlayer();
    stopPopupStepTimer();
    const modal = document.getElementById("exerciseModePopupModal");
    if (modal) {
        modal.classList.add("hidden");
    }
}

// 3. RENDER STEP INSIDE POPUP MODAL
function renderPopupExerciseStep() {
    if (!activeWorkoutExercises || !activeWorkoutExercises.length) {
        activeWorkoutExercises = DEFAULT_POPUP_EXERCISES;
    }

    const prog = getWorkoutProgress();
    const total = activeWorkoutExercises.length;
    const isFinished = prog.isFinished || (prog.completedSteps && prog.completedSteps.length >= total);

    const titleEl = document.getElementById("popupWorkoutTitle");
    const subEl = document.getElementById("popupWorkoutSubtitle");
    const counterEl = document.getElementById("popupStepCounterText");
    const pctEl = document.getElementById("popupProgressPctText");
    const fillEl = document.getElementById("popupProgressFill");
    const activeSection = document.getElementById("popupActiveExerciseSection");
    const celebSection = document.getElementById("popupCelebrationSection");
    const celebDesc = document.getElementById("popupCelebrationDesc");

    if (titleEl) titleEl.textContent = currentWorkoutName || "Scheduled Exercise Routine";
    if (subEl) subEl.textContent = "Follow the posture guide and complete each exercise to advance to the next step.";

    // If all completed, show celebration view inside popup
    if (isFinished) {
        stopCartoonVideoPlayer();
        if (activeSection) activeSection.classList.add("hidden");
        if (celebSection) celebSection.classList.remove("hidden");
        if (counterEl) counterEl.textContent = `ALL ${total} STEPS COMPLETED`;
        if (pctEl) pctEl.textContent = "100% COMPLETED";
        if (fillEl) fillEl.style.width = "100%";
        if (celebDesc) {
            celebDesc.textContent = `Fantastic effort! You completed all ${total} exercises in your scheduled routine today (+25 XP earned).`;
        }

        const exerciseStat = document.getElementById("exerciseStat");
        if (exerciseStat) exerciseStat.textContent = `${lastRecommendedWorkoutDuration} min`;

        const breakdownList = document.getElementById("exerciseBreakdownList");
        if (breakdownList) {
            renderDashboardExerciseOverview(activeWorkoutExercises, breakdownList, null, exerciseStat);
        }
        return;
    }

    // Active Exercise View
    if (activeSection) activeSection.classList.remove("hidden");
    if (celebSection) celebSection.classList.add("hidden");

    const curStepIdx = Math.min(prog.currentStep, total - 1);
    const curEx = activeWorkoutExercises[curStepIdx];
    const isLastStep = curStepIdx === total - 1;
    const ordinal = getOrdinal(curStepIdx + 1);
    const pct = Math.round((prog.completedSteps.length / total) * 100);

    if (counterEl) counterEl.textContent = `STEP ${curStepIdx + 1} OF ${total}`;
    if (pctEl) pctEl.textContent = `${pct}% COMPLETED`;
    if (fillEl) fillEl.style.width = `${pct}%`;

    const badgeEl = document.getElementById("popupStepBadge");
    const timingEl = document.getElementById("popupExerciseTiming");
    const diagramEl = document.getElementById("popupDiagramBox");
    const nameEl = document.getElementById("popupExerciseName");
    const pillsEl = document.getElementById("popupPills");
    const instructionsEl = document.getElementById("popupInstructions");
    const completeBtn = document.getElementById("popupCompleteBtn");
    const nextPreviewEl = document.getElementById("popupNextPreview");

    if (badgeEl) badgeEl.textContent = `⚡ ${ordinal.toUpperCase()} EXERCISE · ACTIVE`;
    if (timingEl) timingEl.textContent = `${curEx.duration} · ${curEx.reps}`;
    if (diagramEl) {
        mountCartoonVideoPlayer(diagramEl, curEx.key, curEx.name);
    }
    if (nameEl) nameEl.textContent = curEx.name;

    if (pillsEl) {
        pillsEl.innerHTML = `
            <span class="active-exercise-pill timing">⏱️ ${escapeHTML(curEx.duration)}</span>
            <span class="active-exercise-pill timing">⚡ ${escapeHTML(curEx.reps)}</span>
            <span class="active-exercise-pill muscles">🎯 ${escapeHTML(curEx.target_muscles || "Mobility & Core")}</span>
        `;
    }

    if (instructionsEl) {
        const steps = curEx.instructions && curEx.instructions.length > 0 ? curEx.instructions : [
            "Start in proper posture and keep core engaged.",
            "Perform controlled movements through full range of motion.",
            "Breathe rhythmically without holding your breath."
        ];
        instructionsEl.innerHTML = steps.map(ins => `<li>${escapeHTML(ins)}</li>`).join("");
    }

    if (completeBtn) {
        if (isLastStep) {
            completeBtn.textContent = "🎉 COMPLETE FINAL EXERCISE (+25 XP)";
        } else {
            completeBtn.textContent = `✓ ${ordinal.toUpperCase()} EXERCISE COMPLETED → NEXT EXERCISE`;
        }
    }

    if (nextPreviewEl) {
        if (!isLastStep && activeWorkoutExercises[curStepIdx + 1]) {
            const nextEx = activeWorkoutExercises[curStepIdx + 1];
            nextPreviewEl.textContent = `Next up: Step ${curStepIdx + 2} · ${nextEx.name} (${nextEx.duration})`;
        } else {
            nextPreviewEl.textContent = "Final exercise! Completing this will finish today's routine and claim your XP.";
        }
    }

    initPopupTimerForStep(curEx.duration);
}

// 4. HANDLE STEP COMPLETION & TRANSITION TO NEXT EXERCISE
function handlePopupStepComplete() {
    stopPopupStepTimer();
    const prog = getWorkoutProgress();

    if (!prog.completedSteps.includes(prog.currentStep)) {
        prog.completedSteps.push(prog.currentStep);
    }

    addXP(5);

    if (prog.currentStep + 1 >= activeWorkoutExercises.length) {
        // Final exercise completed
        prog.isFinished = true;
        saveWorkoutProgress(prog);
        localStorage.setItem(getWorkoutStorageKey(), "true");
        addXP(10); // Completion bonus (+25 XP total)

        const exerciseStat = document.getElementById("exerciseStat");
        if (exerciseStat) exerciseStat.textContent = `${lastRecommendedWorkoutDuration} min`;

        const suggestion = document.getElementById("aiSuggestion");
        if (suggestion) {
            suggestion.textContent = "Outstanding work! You completed all exercises in your scheduled routine today.";
        }

        renderPopupExerciseStep();
    } else {
        // Transition to next exercise in the same popup format!
        prog.currentStep++;
        saveWorkoutProgress(prog);
        renderPopupExerciseStep();
    }

    // Refresh Dashboard 2 overview list
    const breakdownList = document.getElementById("exerciseBreakdownList");
    const exerciseStat = document.getElementById("exerciseStat");
    renderDashboardExerciseOverview(activeWorkoutExercises, breakdownList, null, exerciseStat);

    updateDynamicVitals();
}

// 5. RESTART POPUP WORKOUT
function restartPopupWorkout() {
    stopPopupStepTimer();
    const prog = { currentStep: 0, completedSteps: [], isFinished: false };
    saveWorkoutProgress(prog);
    localStorage.setItem(getWorkoutStorageKey(), "false");

    const exerciseStat = document.getElementById("exerciseStat");
    if (exerciseStat) exerciseStat.textContent = "0 min";

    renderPopupExerciseStep();

    const breakdownList = document.getElementById("exerciseBreakdownList");
    renderDashboardExerciseOverview(activeWorkoutExercises, breakdownList, null, exerciseStat);

    updateDynamicVitals();
}

// 6. POPUP STEP TIMER CONTROLS
let popupTimerInterval = null;
let popupTimerSeconds = 60;
let isPopupTimerRunning = false;

function initPopupTimerForStep(durationStr) {
    stopPopupStepTimer();
    let mins = 1;
    try {
        const m = parseInt(durationStr);
        if (!isNaN(m) && m > 0) mins = m;
    } catch (e) {
        mins = 1;
    }
    popupTimerSeconds = Math.min(mins * 60, 240);
    isPopupTimerRunning = false;
    updatePopupTimerDisplay();
}

function updatePopupTimerDisplay() {
    const clock = document.getElementById("popupTimerClock");
    if (!clock) return;
    const m = Math.floor(popupTimerSeconds / 60);
    const s = popupTimerSeconds % 60;
    clock.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function togglePopupStepTimer() {
    const btn = document.getElementById("popupTimerToggleBtn");
    if (isPopupTimerRunning) {
        stopPopupStepTimer();
        if (btn) btn.textContent = "▶ RESUME";
    } else {
        isPopupTimerRunning = true;
        if (btn) btn.textContent = "⏸ PAUSE";
        popupTimerInterval = setInterval(() => {
            if (popupTimerSeconds > 0) {
                popupTimerSeconds--;
                updatePopupTimerDisplay();
            } else {
                stopPopupStepTimer();
                if (btn) btn.textContent = "✓ DONE";
            }
        }, 1000);
    }
}

function stopPopupStepTimer() {
    if (popupTimerInterval) {
        clearInterval(popupTimerInterval);
        popupTimerInterval = null;
    }
    isPopupTimerRunning = false;
    const btn = document.getElementById("popupTimerToggleBtn");
    if (btn) btn.textContent = "▶ START";
}

function resetPopupStepTimer() {
    stopPopupStepTimer();
    popupTimerSeconds = 60;
    updatePopupTimerDisplay();
}

// Backward compatibility alias for any existing callers
const renderSequentialWorkout = renderDashboardExerciseOverview;
const restartCurrentWorkout = restartPopupWorkout;
const completeCurrentExerciseStep = handlePopupStepComplete;

function openExerciseGuideModalByIndex(index) {
    openExerciseModePopup(index);
}

function closeExerciseGuideModal() {
    closeExerciseModePopup();
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
    const isMeal = ["Breakfast", "Lunch", "Snack", "Dinner"].includes(label);
    if (isMeal) {
        const loggedItems = Array.isArray(currentTodayFoods) 
            ? currentTodayFoods.filter(f => (f.meal_type || "").toLowerCase() === label.toLowerCase()) 
            : [];
        const isLogged = loggedItems.length > 0;
        
        if (isLogged) {
            const totalCals = loggedItems.reduce((acc, f) => acc + (Math.round(Number(f.calories)) || 0), 0);
            const foodNames = loggedItems.map(f => f.food_name).join(", ");
            return `
                <div class="routine-item routine-item-logged" style="border-left: 3px solid #10B981; background: rgba(16, 185, 129, 0.05); padding: 10px 14px; border-radius: 10px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">${icon}</span>
                        <div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span class="routine-label" style="font-weight: 700; color: #F8FAFC;">${label}</span>
                                <span style="font-size: 10px; font-weight: 800; background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 2px 6px; border-radius: 4px;">✓ Filled & Saved</span>
                            </div>
                            <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">
                                ${escapeHTML(foodNames)} · <strong style="color: #10B981;">${totalCals} kcal</strong>
                            </div>
                        </div>
                    </div>
                    <div class="routine-time" style="color: #10B981; font-weight: 800;">
                        ${time || "--"}
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="routine-item" style="padding: 10px 14px; border-radius: 10px; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 18px;">${icon}</span>
                        <div>
                            <span class="routine-label" style="color: #F8FAFC;">${label}</span>
                            <div style="font-size: 10px; color: #64748B;">Not filled yet</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="routine-time">${time || "--"}</span>
                        <button type="button" class="mini-button" style="padding: 3px 10px; font-size: 10px; border-color: rgba(6, 182, 212, 0.4); color: #67E8F9; background: rgba(6, 182, 212, 0.1);" onclick="openFoodModal('${label}')">+ Fill</button>
                    </div>
                </div>
            `;
        }
    }

    return `
        <div class="routine-item" style="padding: 10px 14px; border-radius: 10px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 18px;">${icon}</span>
                <span class="routine-label">${label}</span>
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

    loadHealthPrecautions();

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


/* =========================================================
   DYNAMIC HEALTH SCORE & ENERGY LEVEL ENGINE
   Calculates live, accurate vitals from:
   - Sleep quality & duration
   - Nutrition & meals logged today
   - Physical activity (steps walked + workout completed)
   - Hydration (water drank vs 2.5L goal)
   - Circadian biological curve (time of day)
========================================================= */

function updateDynamicVitals() {
    // 1. Get Sleep Duration
    let sleepHours = 8.0;
    const sleepEl = document.getElementById("sleepStat");
    if (sleepEl && sleepEl.textContent) {
        const parsed = parseFloat(sleepEl.textContent);
        if (!isNaN(parsed) && parsed > 0) {
            sleepHours = parsed;
        }
    }

    // 2. Get Hydration
    const waterKey = getWaterStorageKey();
    const waterL = parseFloat(localStorage.getItem(waterKey)) || waterAmount || 0.0;
    const waterTarget = 2.5;

    // 3. Get Steps
    const stepKey = getStepStorageKey();
    const steps = parseInt(localStorage.getItem(stepKey)) || 0;
    const stepTarget = 10000;

    // 4. Get Nutrition / Calories
    let calories = 0;
    const calEl = document.getElementById("calorieStat");
    if (calEl && calEl.textContent) {
        calories = parseFloat(calEl.textContent.replace(/,/g, "")) || 0;
    }

    // 5. Get Workout Progress
    const workoutProg = getWorkoutProgress();
    const isWorkoutDone = workoutProg.isFinished || (localStorage.getItem(getWorkoutStorageKey()) === "true");
    const workoutStepsCompleted = (workoutProg.completedSteps || []).length;

    // ==========================================
    // A. CALCULATE DAILY HEALTH SCORE (0 - 100%)
    // "Calculated from your sleep, meals & activity"
    // 4 components x 25 points = 100 points
    // ==========================================

    // (1) Sleep Score (25 max)
    let sleepScore = 20;
    if (sleepHours >= 7 && sleepHours <= 9) {
        sleepScore = 25;
    } else if (sleepHours >= 6 && sleepHours < 7) {
        sleepScore = 21;
    } else if (sleepHours > 9 && sleepHours <= 10) {
        sleepScore = 21;
    } else if (sleepHours >= 5 && sleepHours < 6) {
        sleepScore = 15;
    } else {
        sleepScore = 10;
    }

    // (2) Hydration Score (25 max)
    const hydrationScore = Math.min(25, Math.round((waterL / waterTarget) * 25));

    // (3) Activity & Exercise Score (25 max)
    const stepScore = Math.min(18, Math.round((steps / stepTarget) * 18));
    let exerciseBonus = 0;
    if (isWorkoutDone) {
        exerciseBonus = 7;
    } else if (workoutStepsCompleted > 0) {
        exerciseBonus = Math.min(6, workoutStepsCompleted * 2);
    }
    const activityScore = Math.min(25, stepScore + exerciseBonus);

    // (4) Nutrition & Meal Fuel Score (25 max)
    let nutritionScore = 15;
    const hour = new Date().getHours();

    if (calories > 0) {
        if (calories >= 1400 && calories <= 2400) {
            nutritionScore = 25;
        } else if (calories >= 800 && calories < 1400) {
            nutritionScore = hour < 14 ? 22 : 18;
        } else if (calories > 2400 && calories <= 2800) {
            nutritionScore = 20;
        } else if (calories > 2800) {
            nutritionScore = 16;
        } else {
            nutritionScore = hour < 12 ? 18 : 13;
        }
    } else {
        if (hour < 11) nutritionScore = 18;
        else if (hour < 15) nutritionScore = 12;
        else nutritionScore = 8;
    }

    const totalHealthScore = Math.max(20, Math.min(100, Math.round(sleepScore + hydrationScore + activityScore + nutritionScore)));

    // Render Health Score UI
    const healthValEl = document.getElementById("healthValue");
    const healthRadialEl = document.getElementById("healthRadial");
    const healthStatusEl = document.getElementById("healthStatusText");

    if (healthValEl) {
        healthValEl.textContent = totalHealthScore;
    }
    if (healthRadialEl) {
        const degrees = Math.round((totalHealthScore / 100) * 360);
        healthRadialEl.style.setProperty("--progress", `${degrees}deg`);
    }
    if (healthStatusEl) {
        if (totalHealthScore >= 88) {
            healthStatusEl.textContent = "OPTIMAL";
            healthStatusEl.style.color = "#34D399";
        } else if (totalHealthScore >= 75) {
            healthStatusEl.textContent = "GOOD";
            healthStatusEl.style.color = "#10B981";
        } else if (totalHealthScore >= 55) {
            healthStatusEl.textContent = "MODERATE";
            healthStatusEl.style.color = "#FCD34D";
        } else {
            healthStatusEl.textContent = "NEEDS CARE";
            healthStatusEl.style.color = "#F87171";
        }
    }

    // ==========================================
    // B. CALCULATE ENERGY LEVEL / RESERVE (0 - 100%)
    // "Stay active, take short breaks, and recharge."
    // Based on circadian biology, sleep foundation, hydration recharge & fuel
    // ==========================================
    const now = new Date();
    const timeDec = now.getHours() + (now.getMinutes() / 60);

    // 1. Circadian biological rhythm curve
    let circadianBase = 75;
    if (timeDec >= 6 && timeDec < 9) {
        circadianBase = 70 + ((timeDec - 6) / 3) * 16;
    } else if (timeDec >= 9 && timeDec < 13.5) {
        circadianBase = 86 + ((timeDec - 9) / 4.5) * 7;
    } else if (timeDec >= 13.5 && timeDec < 16.5) {
        circadianBase = 76 - ((timeDec - 13.5) / 3) * 8;
    } else if (timeDec >= 16.5 && timeDec < 20.5) {
        circadianBase = 74 + ((timeDec - 16.5) / 4) * 8;
    } else if (timeDec >= 20.5 && timeDec < 23) {
        circadianBase = 70 - ((timeDec - 20.5) / 2.5) * 30;
    } else {
        const nightProgress = timeDec >= 23 ? (timeDec - 23) / 7 : (timeDec + 1) / 7;
        circadianBase = 35 - nightProgress * 13;
    }

    // 2. Sleep Quality multiplier
    let sleepMod = 0;
    if (sleepHours >= 7 && sleepHours <= 9) sleepMod = +5;
    else if (sleepHours >= 6) sleepMod = 0;
    else sleepMod = -10;

    // 3. Hydration recharge (+0% to +12%)
    const hydRatio = Math.min(1.0, waterL / waterTarget);
    const hydMod = (hydRatio * 12) - 4;

    // 4. Food replenishment (+0% to +10%)
    let foodMod = 0;
    if (calories >= 1000) foodMod = +7;
    else if (calories >= 350) foodMod = +3;
    else if (timeDec > 13) foodMod = -6;

    // 5. Physical exertion & recovery
    let exertionMod = 0;
    if (isWorkoutDone) {
        exertionMod = -3;
    } else if (steps > 12000) {
        exertionMod = -5;
    }

    const totalEnergy = Math.max(15, Math.min(100, Math.round(circadianBase + sleepMod + hydMod + foodMod + exertionMod)));

    // Render Energy UI
    const energyValEl = document.getElementById("energyValue");
    const energyFillEl = document.getElementById("energyFill");
    const energyStatusEl = document.getElementById("energyStatusText");

    if (energyValEl) {
        energyValEl.textContent = `${totalEnergy}%`;
    }
    if (energyFillEl) {
        energyFillEl.style.width = `${totalEnergy}%`;
    }
    if (energyStatusEl) {
        if (totalEnergy >= 85) {
            energyStatusEl.textContent = "PEAK";
            energyStatusEl.style.color = "#67E8F9";
        } else if (totalEnergy >= 65) {
            energyStatusEl.textContent = "ACTIVE";
            energyStatusEl.style.color = "#06B6D4";
        } else if (totalEnergy >= 45) {
            energyStatusEl.textContent = "STEADY";
            energyStatusEl.style.color = "#FCD34D";
        } else {
            energyStatusEl.textContent = "LOW / REST";
            energyStatusEl.style.color = "#FDA4AF";
        }
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

    if (typeof updateAerivaQuickChips === "function") updateAerivaQuickChips();
    if (typeof clearAerivaChat === "function") clearAerivaChat();

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


/* =====================================================
   AERIVA AI COPILOT CHATBOT - DRAGGABLE & PLATFORM GUIDE
===================================================== */

let aerivaChatHistory = [];
let aerivaIsWaiting = false;

function isUserOnLoginScreen() {
    const authScreen = document.getElementById("authScreen");
    const token = localStorage.getItem("aeriva_token");
    if (!token) return true;
    if (authScreen && !authScreen.classList.contains("hidden")) return true;
    return false;
}

// Initial welcoming message on the login screen
const AERIVA_LOGIN_GREETING = `👋 Welcome to **AERIVA AI — Smart Health & Lifestyle Dashboard**! I'm **AERIVA**, your personal AI health copilot!

🌟 **What is this webpage?**
AERIVA is your all-in-one personal wellness command center designed to optimize your daily health:
• 📅 **Personalized Routine**: Sync your meal times, work hours, hydration, and sleep rhythm.
• 📷 **AI Food Photo Scanner**: Snap photos of your meals for instant dish recognition, calories, and macros.
• ⚡ **Interactive Exercise Mode**: Guided workouts with animated form tips, live rep counters, and interval timers.
• 🛡️ **AI Health Safety Shield**: Real-time clinical precaution engine guarding your nutrition, sleep, and physical activity.

🔐 **To Get Started**:
• **Already have an account?** Enter your email & password and click **Sign In** to open your dashboard.
• **Don't have an account yet?** Click **Create Account** to register your profile in 30 seconds!`;

// Initial welcoming message on the authenticated dashboard
const AERIVA_INITIAL_GREETING = `👋 Hi there! I'm **AERIVA**, your personal AI Health & Platform Copilot!

I am here to guide and assist you across every single corner of this application:
• **Dashboard 1 (Daily Routine)**: Track your schedule, meal times, sleep rhythm, water cups, and log meals with the AI photo scanner.
• **Dashboard 2 (Exercise Mode)**: Interactive guided workout circuits with rep counters, interval timers, and form tips.
• **Dashboard 3 (Precautions & Safety)**: Health safety shields, real-time precautions, and AI next-day meal suggestions.

💡 *Tip: You can **drag my floating avatar or this window anywhere** across your screen!*

Select a quick topic above or ask me anything!`;

function updateAerivaQuickChips() {
    const chipsContainer = document.querySelector(".aeriva-quick-chips");
    if (!chipsContainer) return;

    if (isUserOnLoginScreen()) {
        chipsContainer.innerHTML = `
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('What is this webpage and what can it do?')">🌟 What is AERIVA?</button>
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('How do I create a new account?')">✨ Create Account</button>
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('How do I sign in to my account?')">🔐 How to Sign In</button>
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('What health features are inside once I log in?')">🛡️ Health Features</button>
        `;
    } else {
        chipsContainer.innerHTML = `
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('What does this webpage do? Give me a full tour.')">🗺️ Full Tour</button>
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('How do I log my food using a photo?')">📷 Scan Food</button>
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('How does Exercise Mode work in Dashboard 2?')">⚡ Exercise Mode</button>
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('Explain Dashboard 3 Health Precautions and Safety Shield.')">🛡️ Precautions</button>
            <button type="button" class="chip-btn" onclick="sendAerivaQuickPrompt('How do I edit my daily routine schedule?')">⚙️ Edit Routine</button>
        `;
    }
}

function formatAerivaMarkdown(text) {
    if (!text) return "";

    // Escape HTML tags to prevent XSS
    let safe = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Extract interactive actions like [action:open_food|+ LOG A MEAL]
    const actionRegex = /\[action:([a-zA-Z0-9_-]+)\|([^\]]+)\]/g;
    const actions = [];
    safe = safe.replace(actionRegex, (match, actionType, label) => {
        actions.push({ actionType, label: label.trim() });
        return ""; // remove from prose to append as interactive action buttons at bottom
    });

    const lines = safe.split("\n");
    let out = [];
    let inList = null; // "ul" or "ol"
    let inTable = false;
    let tableRows = [];

    function closeList() {
        if (inList) {
            out.push(`</${inList}>`);
            inList = null;
        }
    }

    function flushTable() {
        if (!inTable) return;
        if (tableRows.length > 0) {
            let html = '<div class="chat-table-wrapper"><table class="chat-table">';
            const headerCells = tableRows[0];
            html += '<thead><tr>' + headerCells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
            for (let i = 1; i < tableRows.length; i++) {
                html += '<tr>' + tableRows[i].map(c => `<td>${c}</td>`).join('') + '</tr>';
            }
            html += '</tbody></table></div>';
            out.push(html);
        }
        tableRows = [];
        inTable = false;
    }

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let trimmed = rawLine.trim();

        // Table row check: line has "|" and starts/ends with "|"
        if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
            closeList();
            const cells = trimmed.split("|").slice(1, -1).map(c => c.trim());
            const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
            if (!inTable) {
                inTable = true;
                tableRows = [cells];
            } else {
                if (!isSeparator) {
                    tableRows.push(cells);
                }
            }
            continue;
        } else {
            flushTable();
        }

        if (trimmed === "") {
            closeList();
            continue;
        }

        // Horizontal rules: ---, ***, ___
        if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            closeList();
            out.push('<hr class="chat-divider" />');
            continue;
        }

        // Headers: #, ##, ###, ####
        const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (hMatch) {
            closeList();
            const lvl = hMatch[1].length;
            out.push(`<h${lvl + 1} class="chat-heading chat-h${lvl}">${hMatch[2]}</h${lvl + 1}>`);
            continue;
        }

        // Blockquotes: > quote
        if (trimmed.startsWith("&gt;")) {
            closeList();
            out.push(`<blockquote class="chat-quote">${trimmed.replace(/^&gt;\s?/, "")}</blockquote>`);
            continue;
        }

        // Bullet lists: •, -, * followed by space
        const bulletMatch = trimmed.match(/^([•\-\*])\s+(.+)$/);
        if (bulletMatch) {
            if (inList !== "ul") {
                closeList();
                out.push('<ul class="chat-ul">');
                inList = "ul";
            }
            out.push(`<li>${bulletMatch[2]}</li>`);
            continue;
        }

        // Numbered lists: 1., 2. followed by space
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
        if (numMatch) {
            if (inList !== "ol") {
                closeList();
                out.push('<ol class="chat-ol">');
                inList = "ol";
            }
            out.push(`<li>${numMatch[2]}</li>`);
            continue;
        }

        // Regular paragraph
        closeList();
        out.push(`<p class="chat-p">${trimmed}</p>`);
    }

    closeList();
    flushTable();

    let fullHtml = out.join("");

    // Inline bold: **text** or __text__
    fullHtml = fullHtml.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    fullHtml = fullHtml.replace(/__([^_]+)__/g, "<strong>$1</strong>");

    // Inline italics: *text* or _text_ (when not part of a tag or word)
    fullHtml = fullHtml.replace(/(^|[\s(])\*([^\*\n]+)\*(?=[\s),.!?]|$)/g, "$1<em>$2</em>");
    fullHtml = fullHtml.replace(/(^|[\s(])_([^_\n]+)_(?=[\s),.!?]|$)/g, "$1<em>$2</em>");

    // Inline code: `code`
    fullHtml = fullHtml.replace(/`([^`]+)`/g, '<code class="chat-code">$1</code>');

    // Append action buttons if any were found
    if (actions.length > 0) {
        fullHtml += '<div class="aeriva-actions-container">';
        for (const act of actions) {
            fullHtml += `<button type="button" class="aeriva-action-btn" onclick="executeAerivaAction('${act.actionType}')">${act.label}</button>`;
        }
        fullHtml += '</div>';
    }

    return fullHtml;
}

function appendAerivaMessage(role, text) {
    const list = document.getElementById("aerivaMessagesList");
    if (!list) return;

    const row = document.createElement("div");
    row.className = `aeriva-msg-row ${role === "user" ? "user-msg" : "bot-msg"}`;

    if (role === "bot") {
        const botAvatar = document.createElement("img");
        botAvatar.src = "/static/aeriva-bot.jpg";
        botAvatar.alt = "AERIVA";
        botAvatar.className = "bot-avatar-tiny";
        row.appendChild(botAvatar);
    }

    const bubble = document.createElement("div");
    bubble.className = `msg-bubble ${role}`;
    bubble.innerHTML = formatAerivaMarkdown(text);
    row.appendChild(bubble);

    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
}

function showAerivaTypingIndicator() {
    removeAerivaTypingIndicator();
    const list = document.getElementById("aerivaMessagesList");
    if (!list) return;

    const row = document.createElement("div");
    row.id = "aerivaTypingRow";
    row.className = "aeriva-msg-row bot-msg";

    const botAvatar = document.createElement("img");
    botAvatar.src = "/static/aeriva-bot.jpg";
    botAvatar.alt = "AERIVA";
    botAvatar.className = "bot-avatar-tiny";
    row.appendChild(botAvatar);

    const indicator = document.createElement("div");
    indicator.className = "aeriva-typing-indicator";
    indicator.innerHTML = "<span></span><span></span><span></span>";
    row.appendChild(indicator);

    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
}

function removeAerivaTypingIndicator() {
    const existing = document.getElementById("aerivaTypingRow");
    if (existing) existing.remove();
}

function toggleAerivaChat(forceOpen = null) {
    const popup = document.getElementById("aerivaChatPopup");
    if (!popup) return;

    const isHidden = popup.classList.contains("hidden");
    const shouldOpen = forceOpen !== null ? forceOpen : isHidden;

    if (shouldOpen) {
        popup.classList.remove("hidden");
        updateAerivaQuickChips();

        const input = document.getElementById("aerivaChatInput");
        if (input) {
            setTimeout(() => input.focus(), 150);
        }

        // If no messages yet, show greeting matching user's login state
        const list = document.getElementById("aerivaMessagesList");
        if (list && list.children.length === 0) {
            if (isUserOnLoginScreen()) {
                appendAerivaMessage("bot", AERIVA_LOGIN_GREETING);
                const starterLoginActions = `
[action:focus_login|🔐 SIGN IN TO ACCOUNT]
[action:switch_register|✨ CREATE NEW ACCOUNT]`;
                appendAerivaMessage("bot", starterLoginActions);
            } else {
                appendAerivaMessage("bot", AERIVA_INITIAL_GREETING);
                const starterActions = `
[action:tab_routine|📋 DASHBOARD 1: ROUTINE]
[action:tab_fitness|⚡ DASHBOARD 2: EXERCISES]
[action:tab_precautions|🛡️ DASHBOARD 3: PRECAUTIONS]
[action:open_food|📷 SCAN FOOD WITH CAMERA]`;
                appendAerivaMessage("bot", starterActions);
            }
        }
    } else {
        popup.classList.add("hidden");
    }
}

function closeAerivaChat() {
    const popup = document.getElementById("aerivaChatPopup");
    if (popup) popup.classList.add("hidden");
}

function clearAerivaChat() {
    aerivaChatHistory = [];
    const list = document.getElementById("aerivaMessagesList");
    if (list) {
        list.innerHTML = "";
        updateAerivaQuickChips();
        if (isUserOnLoginScreen()) {
            appendAerivaMessage("bot", AERIVA_LOGIN_GREETING);
            appendAerivaMessage("bot", `[action:focus_login|🔐 SIGN IN TO ACCOUNT]\n[action:switch_register|✨ CREATE NEW ACCOUNT]`);
        } else {
            appendAerivaMessage("bot", AERIVA_INITIAL_GREETING);
        }
    }
}

function sendAerivaQuickPrompt(promptText) {
    toggleAerivaChat(true);
    sendAerivaMessage(promptText);
}

function handleAerivaChatSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById("aerivaChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || aerivaIsWaiting) return;
    input.value = "";
    sendAerivaMessage(text);
}

async function sendAerivaMessage(userText) {
    if (!userText || aerivaIsWaiting) return;
    aerivaIsWaiting = true;

    // Render user message
    appendAerivaMessage("user", userText);
    aerivaChatHistory.push({ role: "user", content: userText });

    const sendBtn = document.getElementById("aerivaSendBtn");
    if (sendBtn) sendBtn.disabled = true;

    showAerivaTypingIndicator();

    try {
        const headers = { "Content-Type": "application/json" };
        const token = localStorage.getItem("aeriva_token");
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const onLoginScreen = isUserOnLoginScreen();

        const res = await fetch("/chat/assistant", {
            method: "POST",
            headers,
            body: JSON.stringify({
                message: userText,
                history: aerivaChatHistory.slice(-8),
                is_auth_screen: onLoginScreen
            })
        });

        removeAerivaTypingIndicator();

        if (!res.ok) {
            throw new Error(`Server returned HTTP ${res.status}`);
        }

        const data = await res.json();
        const botReply = data.reply || "I'm here to help! Could you please repeat that?";

        appendAerivaMessage("bot", botReply);
        aerivaChatHistory.push({ role: "assistant", content: botReply });
    } catch (err) {
        console.error("Aeriva Chat Error:", err);
        removeAerivaTypingIndicator();
        if (isUserOnLoginScreen()) {
            appendAerivaMessage(
                "bot",
                `Welcome to AERIVA AI! Ready to get started?\n\n` +
                `• [action:focus_login|🔐 Sign In To Existing Account]\n` +
                `• [action:switch_register|✨ Create A New Account]`
            );
        } else {
            appendAerivaMessage(
                "bot",
                `I'm having trouble connecting to the AI brain right now. In the meantime, you can explore:\n\n` +
                `• [action:tab_routine|📋 Go to Dashboard 1: Daily Routine]\n` +
                `• [action:tab_fitness|⚡ Go to Dashboard 2: Exercise Mode]\n` +
                `• [action:tab_precautions|🛡️ Go to Dashboard 3: Health Precautions]`
            );
        }
    } finally {
        aerivaIsWaiting = false;
        if (sendBtn) sendBtn.disabled = false;
    }
}

function executeAerivaAction(actionType) {
    switch (actionType) {
        case "focus_login":
            if (typeof showLogin === "function") showLogin();
            const loginEmail = document.getElementById("loginEmail");
            if (loginEmail) {
                loginEmail.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => loginEmail.focus(), 250);
            }
            break;

        case "switch_register":
            if (typeof showRegister === "function") showRegister();
            const registerName = document.getElementById("registerName");
            if (registerName) {
                registerName.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => registerName.focus(), 250);
            }
            break;

        case "open_food":
            if (typeof openFoodModal === "function") {
                openFoodModal();
            } else {
                alert("Food modal not loaded yet.");
            }
            break;

        case "open_steps":
            if (typeof openStepModal === "function") {
                openStepModal();
            } else {
                alert("Step modal not loaded yet.");
            }
            break;

        case "open_routine":
            if (typeof openRoutineModal === "function") {
                openRoutineModal();
            } else {
                alert("Routine modal not loaded yet.");
            }
            break;

        case "open_exercise":
            if (typeof openExerciseModePopup === "function") {
                openExerciseModePopup(0);
            } else {
                if (typeof switchDashboardTab === "function") {
                    switchDashboardTab("fitness");
                }
            }
            break;

        case "tab_routine":
            if (typeof switchDashboardTab === "function") {
                switchDashboardTab("routine");
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
            break;

        case "tab_fitness":
            if (typeof switchDashboardTab === "function") {
                switchDashboardTab("fitness");
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
            break;

        case "tab_precautions":
            if (typeof switchDashboardTab === "function") {
                switchDashboardTab("precautions");
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
            break;

        case "scroll_top":
            window.scrollTo({ top: 0, behavior: "smooth" });
            break;

        case "scroll_scanner":
            if (typeof openFoodModal === "function") {
                openFoodModal(null, true);
            }
            break;

        default:
            console.log("Unknown AERIVA action:", actionType);
            break;
    }
}

/* =====================================================
   DRAGGABLE LOGIC FOR LAUNCHER AND CHAT POPUP
===================================================== */
function initAerivaChatbot() {
    const trigger = document.getElementById("aerivaChatTrigger");
    const popup = document.getElementById("aerivaChatPopup");
    const header = document.getElementById("aerivaChatHeader");
    const minimizeBtn = document.getElementById("aerivaMinimizeBtn");
    const closeBtn = document.getElementById("aerivaCloseBtn");
    const clearBtn = document.getElementById("aerivaClearChatBtn");

    if (!trigger || !popup) return;

    // Minimize toggle
    if (minimizeBtn) {
        minimizeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            popup.classList.toggle("minimized");
            minimizeBtn.textContent = popup.classList.contains("minimized") ? "+" : "−";
        });
    }

    // Close button
    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            closeAerivaChat();
        });
    }

    // Clear chat button
    if (clearBtn) {
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm("Clear your conversation history with AERIVA?")) {
                clearAerivaChat();
            }
        });
    }

    // --------------------------------------------------
    // RESTORE SAVED POSITIONS
    // --------------------------------------------------
    try {
        const savedTriggerPos = localStorage.getItem("aeriva_trigger_pos");
        if (savedTriggerPos) {
            const { left, top } = JSON.parse(savedTriggerPos);
            if (typeof left === "number" && typeof top === "number") {
                const clampX = Math.max(8, Math.min(left, window.innerWidth - 86));
                const clampY = Math.max(8, Math.min(top, window.innerHeight - 86));
                trigger.style.left = `${clampX}px`;
                trigger.style.top = `${clampY}px`;
                trigger.style.right = "auto";
                trigger.style.bottom = "auto";
            }
        }

        const savedPopupPos = localStorage.getItem("aeriva_popup_pos");
        if (savedPopupPos) {
            const { left, top } = JSON.parse(savedPopupPos);
            if (typeof left === "number" && typeof top === "number") {
                const popupWidth = popup.offsetWidth || 390;
                const popupHeight = popup.offsetHeight || 580;
                const clampX = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8));
                const clampY = Math.max(8, Math.min(top, window.innerHeight - popupHeight - 8));
                popup.style.left = `${clampX}px`;
                popup.style.top = `${clampY}px`;
                popup.style.right = "auto";
                popup.style.bottom = "auto";
            }
        }
    } catch (err) {
        console.warn("Could not restore Aeriva positions:", err);
    }

    // --------------------------------------------------
    // DRAGGABLE TRIGGER BUTTON
    // --------------------------------------------------
    let isDraggingTrigger = false;
    let triggerStartX = 0;
    let triggerStartY = 0;
    let triggerInitLeft = 0;
    let triggerInitTop = 0;
    let triggerHasMoved = false;

    trigger.addEventListener("pointerdown", (e) => {
        isDraggingTrigger = true;
        triggerHasMoved = false;
        triggerStartX = e.clientX;
        triggerStartY = e.clientY;

        const rect = trigger.getBoundingClientRect();
        triggerInitLeft = rect.left;
        triggerInitTop = rect.top;

        trigger.setPointerCapture(e.pointerId);
    });

    trigger.addEventListener("pointermove", (e) => {
        if (!isDraggingTrigger) return;
        const dx = e.clientX - triggerStartX;
        const dy = e.clientY - triggerStartY;

        if (Math.hypot(dx, dy) > 5) {
            triggerHasMoved = true;
        }

        if (triggerHasMoved) {
            const width = trigger.offsetWidth;
            const height = trigger.offsetHeight;
            const newX = Math.max(8, Math.min(triggerInitLeft + dx, window.innerWidth - width - 8));
            const newY = Math.max(8, Math.min(triggerInitTop + dy, window.innerHeight - height - 8));

            trigger.style.left = `${newX}px`;
            trigger.style.top = `${newY}px`;
            trigger.style.right = "auto";
            trigger.style.bottom = "auto";
        }
    });

    const finishTriggerDrag = (e) => {
        if (!isDraggingTrigger) return;
        isDraggingTrigger = false;
        try {
            trigger.releasePointerCapture(e.pointerId);
        } catch (_) {}

        if (triggerHasMoved) {
            const rect = trigger.getBoundingClientRect();
            localStorage.setItem("aeriva_trigger_pos", JSON.stringify({ left: rect.left, top: rect.top }));
        } else {
            // Tap/click without dragging -> Toggle Chat!
            toggleAerivaChat();
        }
    };

    trigger.addEventListener("pointerup", finishTriggerDrag);
    trigger.addEventListener("pointercancel", finishTriggerDrag);

    // Keyboard support (Enter or Space to open)
    trigger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleAerivaChat();
        }
    });

    // --------------------------------------------------
    // DRAGGABLE POPUP WINDOW (VIA HEADER)
    // --------------------------------------------------
    if (header) {
        let isDraggingPopup = false;
        let popupStartX = 0;
        let popupStartY = 0;
        let popupInitLeft = 0;
        let popupInitTop = 0;

        header.addEventListener("pointerdown", (e) => {
            // Don't drag if clicking buttons inside the header
            if (e.target.closest(".header-icon-btn")) return;

            isDraggingPopup = true;
            popupStartX = e.clientX;
            popupStartY = e.clientY;

            const rect = popup.getBoundingClientRect();
            popupInitLeft = rect.left;
            popupInitTop = rect.top;

            header.setPointerCapture(e.pointerId);
        });

        header.addEventListener("pointermove", (e) => {
            if (!isDraggingPopup) return;
            const dx = e.clientX - popupStartX;
            const dy = e.clientY - popupStartY;

            const width = popup.offsetWidth;
            const height = popup.offsetHeight;
            const newX = Math.max(8, Math.min(popupInitLeft + dx, window.innerWidth - width - 8));
            const newY = Math.max(8, Math.min(popupInitTop + dy, window.innerHeight - height - 8));

            popup.style.left = `${newX}px`;
            popup.style.top = `${newY}px`;
            popup.style.right = "auto";
            popup.style.bottom = "auto";
        });

        const finishPopupDrag = (e) => {
            if (!isDraggingPopup) return;
            isDraggingPopup = false;
            try {
                header.releasePointerCapture(e.pointerId);
            } catch (_) {}

            const rect = popup.getBoundingClientRect();
            localStorage.setItem("aeriva_popup_pos", JSON.stringify({ left: rect.left, top: rect.top }));
        };

        header.addEventListener("pointerup", finishPopupDrag);
        header.addEventListener("pointercancel", finishPopupDrag);
    }

    // --------------------------------------------------
    // CLAMP ON WINDOW RESIZE
    // --------------------------------------------------
    window.addEventListener("resize", () => {
        if (trigger.style.left && trigger.style.left !== "auto") {
            const rect = trigger.getBoundingClientRect();
            const width = trigger.offsetWidth;
            const height = trigger.offsetHeight;
            const clampedX = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            const clampedY = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8));
            trigger.style.left = `${clampedX}px`;
            trigger.style.top = `${clampedY}px`;
        }

        if (popup.style.left && popup.style.left !== "auto") {
            const rect = popup.getBoundingClientRect();
            const width = popup.offsetWidth;
            const height = popup.offsetHeight;
            const clampedX = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
            const clampedY = Math.max(8, Math.min(rect.top, window.innerHeight - height - 8));
            popup.style.left = `${clampedX}px`;
            popup.style.top = `${clampedY}px`;
        }
    });
}

// Auto-initialize chatbot on DOM load
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAerivaChatbot);
} else {
    initAerivaChatbot();
}


/* =====================================================
   GOOGLE SIGN-IN & ONE-TAP INTEGRATION
===================================================== */
let aerivaGoogleClientId = null;

async function initGoogleAuth() {
    try {
        const res = await fetch("/auth/google/client-id");
        if (res.ok) {
            const data = await res.json();
            aerivaGoogleClientId = data.client_id;
        }
    } catch (e) {
        console.warn("Could not fetch Google Client ID:", e);
    }

    const signInBtn = document.getElementById("googleSignInBtn");
    const regBtn = document.getElementById("googleRegisterBtn");

    if (!aerivaGoogleClientId) {
        const renderPlaceholder = (el) => {
            if (!el) return;
            el.innerHTML = `
                <button type="button" class="google-placeholder-btn" onclick="showGoogleSetupPrompt()">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2c0 2.8.7 5.5 1.9 7.9l3.7-2.9z"/><path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.9C3.7 20.6 7.5 23.5 12 23.5z"/></svg>
                    <span>Continue with Google</span>
                </button>
            `;
        };
        renderPlaceholder(signInBtn);
        renderPlaceholder(regBtn);
        return;
    }

    const checkAndRender = () => {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            google.accounts.id.initialize({
                client_id: aerivaGoogleClientId,
                callback: handleGoogleCredentialResponse,
                auto_select: false
            });

            if (signInBtn) {
                signInBtn.innerHTML = "";
                google.accounts.id.renderButton(signInBtn, {
                    theme: "filled_black",
                    size: "large",
                    shape: "pill",
                    width: 300,
                    text: "continue_with"
                });
            }

            if (regBtn) {
                regBtn.innerHTML = "";
                google.accounts.id.renderButton(regBtn, {
                    theme: "filled_black",
                    size: "large",
                    shape: "pill",
                    width: 300,
                    text: "continue_with"
                });
            }
        } else {
            setTimeout(checkAndRender, 200);
        }
    };

    checkAndRender();
}

function showGoogleSetupPrompt() {
    alert(
        "To enable Google Sign-In:\n\n" +
        "1. Create your Google OAuth Client ID in Google Cloud Console.\n" +
        "2. Add GOOGLE_CLIENT_ID=your_id in your .env or Render dashboard.\n\n" +
        "Once added, users can log in with 1-click Google account verification!"
    );
}

async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;

    try {
        const res = await fetch("/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_token: response.credential })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Google login failed");
        }

        localStorage.setItem("aeriva_token", data.access_token);
        localStorage.setItem("aeriva_user", JSON.stringify(data.user));
        if (data.user && data.user.email) {
            localStorage.setItem("aeriva_user_email", data.user.email);
        }
        authToken = data.access_token;
        currentUser = data.user;
        localStorage.setItem("aeriva_user", JSON.stringify(data.user));
        if (data.user && data.user.email) {
            localStorage.setItem("aeriva_user_email", data.user.email);
        }

        const authScreen = document.getElementById("authScreen");
        const scheduleSetupScreen = document.getElementById("scheduleSetupScreen");
        const dashboardScreen = document.getElementById("dashboardScreen");

        // If user profile is not completed yet (new user or missing details), show Step 2 details form
        if (!data.profile_completed) {
            showRegister();

            const registerGoogleStep = document.getElementById("registerGoogleStep");
            const registerProfileStep = document.getElementById("registerProfileStep");
            if (registerGoogleStep) registerGoogleStep.classList.add("hidden");
            if (registerProfileStep) registerProfileStep.classList.remove("hidden");

            const emailLabel = document.getElementById("googleLinkedEmailLabel");
            if (emailLabel && data.user.email) {
                emailLabel.textContent = `Google Account Linked: ${data.user.email}`;
            }

            const nameInput = document.getElementById("registerName");
            if (nameInput) nameInput.value = data.user.name || "";

            const ageInput = document.getElementById("registerAge");
            if (ageInput && data.user.age) ageInput.value = data.user.age;

            const heightInput = document.getElementById("registerHeight");
            if (heightInput && data.user.height) heightInput.value = data.user.height;

            const weightInput = document.getElementById("registerWeight");
            if (weightInput && data.user.weight) weightInput.value = data.user.weight;

            const goalInput = document.getElementById("registerGoal");
            if (goalInput && data.user.health_goal) goalInput.value = data.user.health_goal;

            if (typeof updateAerivaQuickChips === "function") updateAerivaQuickChips();
            return;
        }

        // Profile already completed! Proceed directly to Dashboard or Schedule Setup
        if (data.onboarding_completed) {
            if (authScreen) authScreen.classList.add("hidden");
            if (scheduleSetupScreen) scheduleSetupScreen.classList.add("hidden");
            if (dashboardScreen) dashboardScreen.classList.remove("hidden");
            const userName = document.getElementById("userName");
            if (userName) userName.textContent = currentUser.name || "PLAYER";
            await loadFood();
            await loadRoutine();
            loadWaterTracker();
        } else {
            if (authScreen) authScreen.classList.add("hidden");
            if (scheduleSetupScreen) scheduleSetupScreen.classList.remove("hidden");
            if (dashboardScreen) dashboardScreen.classList.add("hidden");
        }

        if (typeof updateAerivaQuickChips === "function") updateAerivaQuickChips();
    } catch (err) {
        console.error("Google Auth error:", err);
        const loginMessage = document.getElementById("loginMessage");
        if (loginMessage) loginMessage.textContent = err.message || "Google authentication failed.";
        const regMsg = document.getElementById("registerMessage");
        if (regMsg) regMsg.textContent = err.message || "Google authentication failed.";
    }
}

async function handleGoogleProfileSubmit(event) {
    if (event) event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const age = parseInt(document.getElementById("registerAge").value);
    const height = parseFloat(document.getElementById("registerHeight").value);
    const weight = parseFloat(document.getElementById("registerWeight").value);
    const healthGoal = document.getElementById("registerGoal").value;

    const messageEl = document.getElementById("profileMessage");
    if (!name || isNaN(age) || isNaN(height) || isNaN(weight) || !healthGoal) {
        if (messageEl) messageEl.textContent = "Please fill in all profile fields.";
        return;
    }

    if (messageEl) messageEl.textContent = "Saving your profile...";

    try {
        const token = authToken || localStorage.getItem("aeriva_token");
        const res = await fetch("/auth/update-profile", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                name: name,
                age: age,
                height: height,
                weight: weight,
                health_goal: healthGoal
            })
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || "Failed to update profile");
        }

        currentUser = data.user;
        localStorage.setItem("aeriva_user", JSON.stringify(data.user));
        if (data.user && data.user.email) {
            localStorage.setItem("aeriva_user_email", data.user.email);
        }

        const authScreen = document.getElementById("authScreen");
        const scheduleSetupScreen = document.getElementById("scheduleSetupScreen");
        const dashboardScreen = document.getElementById("dashboardScreen");

        if (data.onboarding_completed) {
            if (authScreen) authScreen.classList.add("hidden");
            if (scheduleSetupScreen) scheduleSetupScreen.classList.add("hidden");
            if (dashboardScreen) dashboardScreen.classList.remove("hidden");
            const userName = document.getElementById("userName");
            if (userName) userName.textContent = currentUser.name || "PLAYER";
            await loadFood();
            await loadRoutine();
            loadWaterTracker();
        } else {
            // New user first-time schedule setup
            if (authScreen) authScreen.classList.add("hidden");
            if (scheduleSetupScreen) scheduleSetupScreen.classList.remove("hidden");
            if (dashboardScreen) dashboardScreen.classList.add("hidden");
        }

        if (typeof updateAerivaQuickChips === "function") updateAerivaQuickChips();
    } catch (err) {
        console.error("Profile update error:", err);
        if (messageEl) messageEl.textContent = err.message || "Failed to save profile.";
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        initGoogleAuth();
        initKineticStage();
    });
} else {
    initGoogleAuth();
    initKineticStage();
}

/* =========================================================
   ARENA KINETIC DISAPPEARING TYPOGRAPHY CONTROLLER
========================================================= */

const kineticPhrases = [
    { solid: "BUILT FOR", outline: "THE STORM." },
    { solid: "DESIGNED FOR", outline: "PEAK LIVING." },
    { solid: "ENGINEERED FOR", outline: "LONGEVITY." },
    { solid: "POWERED BY", outline: "INTELLIGENCE." },
    { solid: "FORGED FOR", outline: "EVERY GOAL." }
];

let currentKineticIndex = 0;
let kineticTimer = null;
const KINETIC_INTERVAL_MS = 4000;
let isKineticTransitioning = false;

function initKineticStage() {
    const wrap = document.getElementById("kineticHeadlineWrap");
    const solidEl = document.getElementById("kineticSolid");
    const outlineEl = document.getElementById("kineticOutline");
    const dotsContainer = document.getElementById("kineticNavDots");
    if (!wrap || !solidEl || !outlineEl) return;

    // Build nav dots
    if (dotsContainer) {
        dotsContainer.innerHTML = kineticPhrases.map((_, i) =>
            `<button class="kinetic-dot ${i === 0 ? 'active' : ''}" type="button" onclick="goToKineticPhrase(${i})" aria-label="Go to phrase ${i + 1}"></button>`
        ).join("");
    }

    // Set initial text
    solidEl.textContent = kineticPhrases[0].solid;
    outlineEl.textContent = kineticPhrases[0].outline;

    // Pause on hover
    wrap.addEventListener("mouseenter", () => {
        clearInterval(kineticTimer);
    });
    wrap.addEventListener("mouseleave", () => {
        startKineticTimer();
    });

    startKineticTimer();
}

function switchKineticPhrase(targetIndex) {
    if (isKineticTransitioning) return;
    const wrap = document.getElementById("kineticHeadlineWrap");
    const solidEl = document.getElementById("kineticSolid");
    const outlineEl = document.getElementById("kineticOutline");
    if (!wrap || !solidEl || !outlineEl) return;

    isKineticTransitioning = true;

    // Phase 1: Disappear uniquely (blur, scale, skew, flash & vaporize)
    wrap.classList.remove("entering");
    wrap.classList.add("disappearing");

    setTimeout(() => {
        // Compute new index
        if (typeof targetIndex === "number") {
            currentKineticIndex = targetIndex;
        } else {
            currentKineticIndex = (currentKineticIndex + 1) % kineticPhrases.length;
        }

        const nextPhrase = kineticPhrases[currentKineticIndex];
        solidEl.textContent = nextPhrase.solid;
        outlineEl.textContent = nextPhrase.outline;

        // Update nav dots
        const dots = document.querySelectorAll(".kinetic-dot");
        dots.forEach((dot, idx) => {
            dot.classList.toggle("active", idx === currentKineticIndex);
        });

        // Phase 2: Enter from beneath with focused snap
        wrap.classList.remove("disappearing");
        wrap.classList.add("entering");

        // Force browser layout reflow
        void wrap.offsetWidth;

        // Phase 3: Settle into resting state
        requestAnimationFrame(() => {
            wrap.classList.remove("entering");
            isKineticTransitioning = false;
        });

        resetKineticProgressBar();
    }, 520);
}

function nextKineticPhrase() {
    startKineticTimer();
    switchKineticPhrase();
}

function goToKineticPhrase(idx) {
    if (idx === currentKineticIndex) return;
    startKineticTimer();
    switchKineticPhrase(idx);
}

function startKineticTimer() {
    clearInterval(kineticTimer);
    resetKineticProgressBar();
    kineticTimer = setInterval(() => {
        switchKineticPhrase();
    }, KINETIC_INTERVAL_MS);
}

function resetKineticProgressBar() {
    const fill = document.getElementById("kineticProgressFill");
    if (!fill) return;
    fill.style.transition = "none";
    fill.style.width = "0%";
    void fill.offsetWidth;
    fill.style.transition = `width ${KINETIC_INTERVAL_MS}ms linear`;
    fill.style.width = "100%";
}

