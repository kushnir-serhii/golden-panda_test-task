// =============================================
//  CONFIG
// =============================================
const SUPABASE_URL = "https://qpykntwppcdkttkbedgs.supabase.co";
const SUPABASE_KEY = "sb_publishable_LRkPXFhsBbgfiKcGtRCtWA_KW2sT41O";
const TABLE = "quiz_sessions";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =============================================
//  SUPABASE
// =============================================
async function dbInsert(data) {
  // Generate id client-side — avoids needing SELECT policy just to get the id back
  const id = crypto.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
  const { error } = await db.from(TABLE).insert({ ...data, id });
  if (error) throw new Error(`Insert failed: ${error.message}`);
  return { id };
}

function dbPatch(id, data) {
  db.from(TABLE).update(data).eq("id", id).then(({ error }) => {
    if (error) console.warn("[Patch]", error.message);
  });
}

// =============================================
//  SESSION
// =============================================
const KEY_SESSION  = "gp_session_id";
const KEY_ROW      = "gp_row_id";
const KEY_START    = "gp_start_time";
const KEY_STEP     = "gp_quiz_step";
const KEY_ANSWERS  = "gp_quiz_answers";

let rowId = null;

function getSessionId() {
  let id = localStorage.getItem(KEY_SESSION);
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
        });
    localStorage.setItem(KEY_SESSION, id);
  }
  return id;
}

async function initSession() {
  const savedRowId = localStorage.getItem(KEY_ROW);
  if (savedRowId) { rowId = savedRowId; return; }

  try {
    const row = await dbInsert({ session_id: getSessionId() });
    rowId = row.id;
    localStorage.setItem(KEY_ROW, rowId);
  } catch (e) {
    console.warn("[Session]", e);
  }
}

function save(data) {
  if (!rowId) return;
  dbPatch(rowId, data);
}

function clearSession() {
  [KEY_SESSION, KEY_ROW, KEY_START, KEY_STEP, KEY_ANSWERS].forEach((k) => {
    localStorage.removeItem(k);
  });
}

// =============================================
//  TIME TRACKING
// =============================================
function getSeconds() {
  const start = parseInt(localStorage.getItem(KEY_START), 10);
  return start ? Math.floor((Date.now() - start) / 1000) : 0;
}

function initTimeTracking() {
  if (!localStorage.getItem(KEY_START)) {
    localStorage.setItem(KEY_START, Date.now());
  }

  // Heartbeat every 30s
  setInterval(() => save({ time_spent_sec: getSeconds() }), 30_000);

  // Save on tab hide / close
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      save({ time_spent_sec: getSeconds() });
    }
  });
  window.addEventListener("beforeunload", () => {
    save({ time_spent_sec: getSeconds() });
  });
}

// =============================================
//  QUIZ STATE
// =============================================
const TOTAL_STEPS = 6;

const state = {
  step: 1,
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
//  QUIZ UI
// =============================================
function showStep(n) {
  document.querySelectorAll(".quiz-step").forEach((el) => el.classList.remove("active"));
  const stepEl = document.querySelector(`.quiz-step[data-step="${n}"]`);
  if (stepEl) stepEl.classList.add("active");

  const progressEl = document.getElementById("quizProgress");
  const labelEl    = document.getElementById("quizStepLabel");

  if (n <= TOTAL_STEPS) {
    if (progressEl) progressEl.style.width = `${(n / TOTAL_STEPS) * 100}%`;
    if (labelEl)    labelEl.textContent = `Step ${n} of ${TOTAL_STEPS}`;
    document.querySelector(".quiz-progress-bar")?.setAttribute("aria-valuenow", n);
  } else {
    if (progressEl) progressEl.style.width = "100%";
    if (labelEl)    labelEl.style.display = "none";
  }

  state.step = n;

  try {
    localStorage.setItem(KEY_STEP, n);
    localStorage.setItem(KEY_ANSWERS, JSON.stringify(state.answers));
  } catch (_) {}

  // Sync partial progress to DB on every step
  save({
    quiz_step_reached: n,
    time_spent_sec:    getSeconds(),
    age_range:         state.answers.ageRange,
    current_weight:    state.answers.currentWeight,
    target_weight:     state.answers.targetWeight,
    activity_level:    state.answers.activityLevel,
    main_goal:         state.answers.mainGoal,
    email:             state.answers.email,
  });
}

// =============================================
//  VALIDATION
// =============================================
function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  if (msg) document.getElementById(id.replace("Error", ""))?.classList.add("error");
  else document.getElementById(id.replace("Error", ""))?.classList.remove("error");
}

function validateStep(step) {
  if (step === 2) {
    const val = parseInt(document.getElementById("currentWeight").value, 10);
    setError("currentWeightError", "");
    if (!val || val < 20 || val > 300) {
      setError("currentWeightError", "Please enter a valid weight between 20 and 300 kg.");
      return false;
    }
    state.answers.currentWeight = val;
    return true;
  }
  if (step === 3) {
    const val = parseInt(document.getElementById("targetWeight").value, 10);
    setError("targetWeightError", "");
    if (!val || val < 20 || val > 300) {
      setError("targetWeightError", "Please enter a valid weight between 20 and 300 kg.");
      return false;
    }
    if (val >= state.answers.currentWeight) {
      setError("targetWeightError", `Must be less than current weight (${state.answers.currentWeight} kg).`);
      return false;
    }
    state.answers.targetWeight = val;
    return true;
  }
  if (step === 6) {
    const val = document.getElementById("userEmail").value.trim();
    setError("emailError", "");
    if (!val || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setError("emailError", "Please enter a valid email address.");
      return false;
    }
    state.answers.email = val;
    return true;
  }
  return true;
}

// =============================================
//  OPTION BUTTONS (steps 1, 4, 5)
// =============================================
function initOptionButtons() {
  document.querySelectorAll(".quiz-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.closest(".quiz-step").dataset.step, 10);
      btn.closest(".quiz-options").querySelectorAll(".quiz-option-btn")
        .forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");

      const val = btn.dataset.value;
      if (step === 1) state.answers.ageRange      = val;
      if (step === 4) state.answers.activityLevel  = val;
      if (step === 5) state.answers.mainGoal        = val;

      setTimeout(() => {
        if (step < TOTAL_STEPS) showStep(step + 1);
        else handleSubmit();
      }, 250);
    });
  });
}

// =============================================
//  NAVIGATION
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
  if (!state.answers.ageRange)      { showStep(1); return; }
  if (!state.answers.activityLevel) { showStep(4); return; }
  if (!state.answers.mainGoal)      { showStep(5); return; }
  if (!validateStep(6)) return;

  const btn = document.getElementById("submitQuiz");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  save({
    completed:         true,
    quiz_step_reached: TOTAL_STEPS,
    time_spent_sec:    getSeconds(),
    age_range:         state.answers.ageRange,
    current_weight:    state.answers.currentWeight,
    target_weight:     state.answers.targetWeight,
    activity_level:    state.answers.activityLevel,
    main_goal:         state.answers.mainGoal,
    email:             state.answers.email,
  });

  clearSession();
  showStep(7);
}

function initSubmitButton() {
  document.getElementById("submitQuiz")?.addEventListener("click", handleSubmit);
}

// =============================================
//  RESTORE STATE
// =============================================
function restoreState() {
  try {
    const savedStep    = parseInt(localStorage.getItem(KEY_STEP), 10);
    const savedAnswers = JSON.parse(localStorage.getItem(KEY_ANSWERS) || "null");
    if (savedAnswers) Object.assign(state.answers, savedAnswers);

    if (savedStep >= 1 && savedStep <= TOTAL_STEPS) {
      const fields = { currentWeight: "currentWeight", targetWeight: "targetWeight", email: "userEmail" };
      Object.entries(fields).forEach(([key, id]) => {
        if (state.answers[key]) {
          const el = document.getElementById(id);
          if (el) el.value = state.answers[key];
        }
      });
      const optionMap = { 1: state.answers.ageRange, 4: state.answers.activityLevel, 5: state.answers.mainGoal };
      Object.entries(optionMap).forEach(([step, val]) => {
        if (!val) return;
        document.querySelector(`.quiz-step[data-step="${step}"] .quiz-option-btn[data-value="${val}"]`)
          ?.classList.add("selected");
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
  await initSession();
  initTimeTracking();
  initOptionButtons();
  initNavButtons();
  initSubmitButton();
  restoreState();
});
