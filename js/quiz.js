import { save, clearSession, KEY_STEP, KEY_ANSWERS } from "./session.js";
import { getSeconds } from "./time.js";

export const TOTAL_STEPS = 6;

export const state = {
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

// ── UI ──────────────────────────────────────────────────────────────────────

export function showStep(n) {
  document.querySelectorAll(".quiz-step").forEach((el) => el.classList.remove("active"));
  document.querySelector(`.quiz-step[data-step="${n}"]`)?.classList.add("active");

  const progressEl = document.getElementById("quizProgress");
  const labelEl    = document.getElementById("quizStepLabel");

  const completed = Math.max(0, n - 1);
  if (n <= TOTAL_STEPS) {
    if (progressEl) progressEl.style.width = `${(completed / TOTAL_STEPS) * 100}%`;
    if (labelEl) {
      labelEl.style.display = completed > 0 ? "" : "none";
      labelEl.textContent   = `Step ${completed} of ${TOTAL_STEPS}`;
    }
    document.querySelector(".quiz-progress-bar")?.setAttribute("aria-valuenow", completed);
  } else {
    if (progressEl) progressEl.style.width = "100%";
    if (labelEl)    labelEl.style.display = "none";
  }

  state.step = n;

  if (n <= TOTAL_STEPS) {
    try {
      localStorage.setItem(KEY_STEP, n);
      localStorage.setItem(KEY_ANSWERS, JSON.stringify(state.answers));
    } catch (_) {}
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
}

// ── Validation ───────────────────────────────────────────────────────────────

function setError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
  const fieldEl = document.getElementById(id.replace("Error", ""));
  if (msg) fieldEl?.classList.add("error");
  else     fieldEl?.classList.remove("error");
}

export function validateStep(step) {
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

// ── Navigation ───────────────────────────────────────────────────────────────

export function initOptionButtons() {
  document.querySelectorAll(".quiz-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.closest(".quiz-step").dataset.step, 10);
      btn.closest(".quiz-options")
        .querySelectorAll(".quiz-option-btn")
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

export function initNavButtons() {
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

// ── Submit ───────────────────────────────────────────────────────────────────

export async function handleSubmit() {
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

  clearSession(); // also nulls rowId — stops heartbeat/unload from overwriting submitted data
  showStep(7);
}

export function initSubmitButton() {
  document.getElementById("submitQuiz")?.addEventListener("click", handleSubmit);
}

// ── Restore state ─────────────────────────────────────────────────────────────

export function restoreState() {
  try {
    const savedStep    = parseInt(localStorage.getItem(KEY_STEP), 10);
    const savedAnswers = JSON.parse(localStorage.getItem(KEY_ANSWERS) || "null");
    if (savedAnswers) Object.assign(state.answers, savedAnswers);

    if (savedStep >= 1 && savedStep <= TOTAL_STEPS) {
      const fieldMap = { currentWeight: "currentWeight", targetWeight: "targetWeight", email: "userEmail" };
      Object.entries(fieldMap).forEach(([key, id]) => {
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
