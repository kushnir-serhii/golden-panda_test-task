// =============================================
//  SUPABASE CONFIG
// =============================================
const SUPABASE_URL = "https://qpykntwppcdkttkbedgs.supabase.co";
const SUPABASE_KEY = "sb_publishable_LRkPXFhsBbgfiKcGtRCtWA_KW2sT41O";
const VISITS_TABLE = "page_visits"; // all visitors
const QUIZ_TABLE = "quiz_submissions"; // completed quizzes only

// =============================================
//  SUPABASE HELPERS
// =============================================
function supabaseHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

// prefer='representation' returns the inserted row (needed when we need the id back)
// prefer='minimal' returns nothing — use for fire-and-forget inserts
async function dbInsert(table, data, prefer = "minimal") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: `return=${prefer}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Insert ${table} ${res.status}`);
  if (prefer === "representation") {
    const rows = await res.json();
    return rows[0];
  }
  return null;
}

function dbPatch(table, id, data, keepalive = false) {
  // Fire-and-forget PATCH — safe to call on page unload
  fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(data),
    keepalive, // survives page close when true
  }).catch(() => {});
}

// =============================================
//  SESSION — page_visits row
// =============================================
const SESSION_ID_KEY = "gp_session_id";
const VISIT_ROW_KEY = "gp_visit_row_id";
const TIME_KEY = "gp_start_time";

let visitRowId = null;

function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

async function initSession() {
  // Reuse existing row if user refreshed
  const existingRowId = localStorage.getItem(VISIT_ROW_KEY);
  if (existingRowId) {
    visitRowId = existingRowId;
    return;
  }

  try {
    const row = await dbInsert(VISITS_TABLE, {
      session_id: getOrCreateSessionId(),
    }, "representation");
    visitRowId = row.id;
    localStorage.setItem(VISIT_ROW_KEY, visitRowId);
  } catch (err) {
    console.warn("[Session] Could not create visit row:", err);
  }
}

function patchVisit(data, keepalive = false) {
  if (!visitRowId) return;
  dbPatch(VISITS_TABLE, visitRowId, data, keepalive);
}

// =============================================
//  TIME TRACKING
// =============================================
function getTimeSpentSeconds() {
  try {
    const start = parseInt(localStorage.getItem(TIME_KEY), 10);
    if (start && !isNaN(start)) return Math.floor((Date.now() - start) / 1000);
  } catch (_) {}
  return 0;
}

function initTimeTracking() {
  try {
    if (!localStorage.getItem(TIME_KEY)) {
      localStorage.setItem(TIME_KEY, Date.now().toString());
    }
  } catch (_) {}

  // Heartbeat — update time every 30s while user is active
  setInterval(() => {
    patchVisit({
      time_spent_sec: getTimeSpentSeconds(),
      quiz_step_reached: quizState.currentStep,
    });
  }, 30_000);

  // On tab hide or close — use keepalive:true so request survives unload
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      patchVisit({ time_spent_sec: getTimeSpentSeconds() }, true);
    }
  });

  window.addEventListener("beforeunload", () => {
    patchVisit({ time_spent_sec: getTimeSpentSeconds() }, true);
  });
}

function clearSession() {
  try {
    localStorage.removeItem(TIME_KEY);
    localStorage.removeItem(VISIT_ROW_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem("gp_quiz_step");
    localStorage.removeItem("gp_quiz_answers");
  } catch (_) {}
}

// =============================================
//  QUIZ STATE
// =============================================
const TOTAL_STEPS = 6;

const quizState = {
  currentStep: 1,
  answers: {
    ageRange: null,
    currentWeight: null,
    targetWeight: null,
    activityLevel: null,
    mainGoal: null,
    email: null,
  },
};

// =============================================
//  DOM HELPERS
// =============================================
function getStep(n) {
  return document.querySelector(`.quiz-step[data-step="${n}"]`);
}

function showStep(n) {
  document
    .querySelectorAll(".quiz-step")
    .forEach((el) => el.classList.remove("active"));
  const step = getStep(n);
  if (step) step.classList.add("active");

  const progressEl = document.getElementById("quizProgress");
  const labelEl = document.getElementById("quizStepLabel");
  if (n <= TOTAL_STEPS) {
    const pct = (n / TOTAL_STEPS) * 100;
    if (progressEl) progressEl.style.width = `${pct}%`;
    if (labelEl) labelEl.textContent = `Step ${n} of ${TOTAL_STEPS}`;
    const bar = document.querySelector(".quiz-progress-bar");
    if (bar) bar.setAttribute("aria-valuenow", n);
  } else {
    if (progressEl) progressEl.style.width = "100%";
    if (labelEl) labelEl.style.display = "none";
  }

  quizState.currentStep = n;

  // Persist step + patch visit with current progress
  try {
    localStorage.setItem("gp_quiz_step", n);
    localStorage.setItem("gp_quiz_answers", JSON.stringify(quizState.answers));
  } catch (_) {}

  patchVisit({
    quiz_step_reached: n,
    time_spent_sec: getTimeSpentSeconds(),
    age_range: quizState.answers.ageRange,
    current_weight: quizState.answers.currentWeight,
    target_weight: quizState.answers.targetWeight,
    activity_level: quizState.answers.activityLevel,
    main_goal: quizState.answers.mainGoal,
    email: quizState.answers.email,
  });
}

// =============================================
//  VALIDATION
// =============================================
function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = "";
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function validateStep(step) {
  if (step === 2) {
    const val = parseInt(document.getElementById("currentWeight").value, 10);
    clearError("currentWeightError");
    document.getElementById("currentWeight").classList.remove("error");
    if (!val || val < 20 || val > 300) {
      showError(
        "currentWeightError",
        "Please enter a valid weight between 20 and 300 kg.",
      );
      document.getElementById("currentWeight").classList.add("error");
      return false;
    }
    quizState.answers.currentWeight = val;
    return true;
  }

  if (step === 3) {
    const cw = quizState.answers.currentWeight;
    const val = parseInt(document.getElementById("targetWeight").value, 10);
    clearError("targetWeightError");
    document.getElementById("targetWeight").classList.remove("error");
    if (!val || val < 20 || val > 300) {
      showError(
        "targetWeightError",
        "Please enter a valid weight between 20 and 300 kg.",
      );
      document.getElementById("targetWeight").classList.add("error");
      return false;
    }
    if (val >= cw) {
      showError(
        "targetWeightError",
        `Target weight must be less than your current weight (${cw} kg).`,
      );
      document.getElementById("targetWeight").classList.add("error");
      return false;
    }
    quizState.answers.targetWeight = val;
    return true;
  }

  if (step === 6) {
    const val = document.getElementById("userEmail").value.trim();
    clearError("emailError");
    document.getElementById("userEmail").classList.remove("error");
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      showError("emailError", "Please enter a valid email address.");
      document.getElementById("userEmail").classList.add("error");
      return false;
    }
    quizState.answers.email = val;
    return true;
  }

  return true;
}

// =============================================
//  OPTION BUTTON SELECTION (steps 1, 4, 5)
// =============================================
function initOptionButtons() {
  document.querySelectorAll(".quiz-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.closest(".quiz-step").dataset.step, 10);

      btn
        .closest(".quiz-options")
        .querySelectorAll(".quiz-option-btn")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      const value = btn.dataset.value;
      if (step === 1) quizState.answers.ageRange = value;
      if (step === 4) quizState.answers.activityLevel = value;
      if (step === 5) quizState.answers.mainGoal = value;

      setTimeout(() => {
        if (step < TOTAL_STEPS) showStep(step + 1);
        else handleSubmit();
      }, 250);
    });
  });
}

// =============================================
//  NEXT / BACK NAVIGATION
// =============================================
function initNavButtons() {
  document.querySelectorAll('[data-action="next"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.closest(".quiz-step").dataset.step, 10);
      if (validateStep(step)) showStep(step + 1);
    });
  });

  document.querySelectorAll('[data-action="prev"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.closest(".quiz-step").dataset.step, 10);
      if (step > 1) showStep(step - 1);
    });
  });
}

// =============================================
//  SUBMIT
// =============================================
async function handleSubmit() {
  if (!quizState.answers.ageRange) {
    showStep(1);
    return;
  }
  if (!quizState.answers.activityLevel) {
    showStep(4);
    return;
  }
  if (!quizState.answers.mainGoal) {
    showStep(5);
    return;
  }
  if (!validateStep(6)) return;

  const submitBtn = document.getElementById("submitQuiz");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving…";
  }

  const timeSpent = getTimeSpentSeconds();

  const payload = {
    age_range: quizState.answers.ageRange,
    current_weight: quizState.answers.currentWeight,
    target_weight: quizState.answers.targetWeight,
    activity_level: quizState.answers.activityLevel,
    main_goal: quizState.answers.mainGoal,
    email: quizState.answers.email,
    time_spent_sec: timeSpent,
  };

  // Mark visit as completed
  patchVisit({ ...payload, completed: true, quiz_step_reached: TOTAL_STEPS });

  try {
    await dbInsert(QUIZ_TABLE, payload);
  } catch (err) {
    console.error("[Submit]", err);
  }

  clearSession();
  showStep(7);
}

function initSubmitButton() {
  const btn = document.getElementById("submitQuiz");
  if (btn) btn.addEventListener("click", handleSubmit);
}

// =============================================
//  RESTORE STATE FROM localStorage
// =============================================
function restoreQuizState() {
  try {
    const savedStep = parseInt(localStorage.getItem("gp_quiz_step"), 10);
    const savedAnswers = JSON.parse(
      localStorage.getItem("gp_quiz_answers") || "null",
    );
    if (savedAnswers) Object.assign(quizState.answers, savedAnswers);

    if (savedStep && savedStep >= 1 && savedStep <= TOTAL_STEPS) {
      if (quizState.answers.currentWeight) {
        const el = document.getElementById("currentWeight");
        if (el) el.value = quizState.answers.currentWeight;
      }
      if (quizState.answers.targetWeight) {
        const el = document.getElementById("targetWeight");
        if (el) el.value = quizState.answers.targetWeight;
      }
      if (quizState.answers.email) {
        const el = document.getElementById("userEmail");
        if (el) el.value = quizState.answers.email;
      }

      const optionMap = {
        1: quizState.answers.ageRange,
        4: quizState.answers.activityLevel,
        5: quizState.answers.mainGoal,
      };
      Object.entries(optionMap).forEach(([step, value]) => {
        if (!value) return;
        const btn = document.querySelector(
          `.quiz-step[data-step="${step}"] .quiz-option-btn[data-value="${value}"]`,
        );
        if (btn) btn.classList.add("selected");
      });

      showStep(savedStep);
      return;
    }
  } catch (_) {}
  showStep(1);
}

// =============================================
//  INIT
// =============================================
document.addEventListener("DOMContentLoaded", async () => {
  await initSession(); // create page_visits row first
  initTimeTracking();
  initOptionButtons();
  initNavButtons();
  initSubmitButton();
  restoreQuizState();
});
