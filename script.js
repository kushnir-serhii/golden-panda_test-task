// =============================================
//  TIME TRACKING
// =============================================
const TIME_KEY = 'gp_start_time';

/**
 * Record session start time. If a previous start time exists in
 * localStorage (e.g. user refreshed), reuse it so time is cumulative.
 */
function initTimeTracking() {
  try {
    if (!localStorage.getItem(TIME_KEY)) {
      localStorage.setItem(TIME_KEY, Date.now().toString());
    }
  } catch (_) {}

  // Persist on tab hide / close so the value survives visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistStartTime();
    }
  });

  window.addEventListener('beforeunload', persistStartTime);
}

function persistStartTime() {
  try {
    if (!localStorage.getItem(TIME_KEY)) {
      localStorage.setItem(TIME_KEY, Date.now().toString());
    }
  } catch (_) {}
}

/**
 * Returns the number of seconds the user has spent on the page.
 * Uses the start time stored in localStorage.
 */
function getTimeSpentSeconds() {
  try {
    const start = parseInt(localStorage.getItem(TIME_KEY), 10);
    if (start && !isNaN(start)) {
      return Math.floor((Date.now() - start) / 1000);
    }
  } catch (_) {}
  return 0;
}

/**
 * Clear time tracking data after a successful submission.
 */
function clearTimeTracking() {
  try {
    localStorage.removeItem(TIME_KEY);
    localStorage.removeItem('gp_quiz_step');
    localStorage.removeItem('gp_quiz_answers');
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
  document.querySelectorAll('.quiz-step').forEach((el) => el.classList.remove('active'));
  const step = getStep(n);
  if (step) step.classList.add('active');

  // Update progress bar
  const progressEl = document.getElementById('quizProgress');
  const labelEl = document.getElementById('quizStepLabel');
  if (n <= TOTAL_STEPS) {
    const pct = (n / TOTAL_STEPS) * 100;
    if (progressEl) progressEl.style.width = `${pct}%`;
    if (labelEl) labelEl.textContent = `Step ${n} of ${TOTAL_STEPS}`;

    // Update aria
    const bar = document.querySelector('.quiz-progress-bar');
    if (bar) bar.setAttribute('aria-valuenow', n);
  } else {
    // Thank-you step — full bar, hide label
    if (progressEl) progressEl.style.width = '100%';
    if (labelEl) labelEl.style.display = 'none';
  }

  quizState.currentStep = n;

  // Persist current step
  try {
    localStorage.setItem('gp_quiz_step', n);
    localStorage.setItem('gp_quiz_answers', JSON.stringify(quizState.answers));
  } catch (_) {}
}

// =============================================
//  VALIDATION
// =============================================
function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function validateStep(step) {
  if (step === 2) {
    const val = parseInt(document.getElementById('currentWeight').value, 10);
    clearError('currentWeightError');
    document.getElementById('currentWeight').classList.remove('error');
    if (!val || val < 20 || val > 300) {
      showError('currentWeightError', 'Please enter a valid weight between 20 and 300 kg.');
      document.getElementById('currentWeight').classList.add('error');
      return false;
    }
    quizState.answers.currentWeight = val;
    return true;
  }

  if (step === 3) {
    const cw = quizState.answers.currentWeight;
    const val = parseInt(document.getElementById('targetWeight').value, 10);
    clearError('targetWeightError');
    document.getElementById('targetWeight').classList.remove('error');
    if (!val || val < 20 || val > 300) {
      showError('targetWeightError', 'Please enter a valid weight between 20 and 300 kg.');
      document.getElementById('targetWeight').classList.add('error');
      return false;
    }
    if (val >= cw) {
      showError('targetWeightError', `Target weight must be less than your current weight (${cw} kg).`);
      document.getElementById('targetWeight').classList.add('error');
      return false;
    }
    quizState.answers.targetWeight = val;
    return true;
  }

  if (step === 6) {
    const val = document.getElementById('userEmail').value.trim();
    clearError('emailError');
    document.getElementById('userEmail').classList.remove('error');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!val || !emailRegex.test(val)) {
      showError('emailError', 'Please enter a valid email address.');
      document.getElementById('userEmail').classList.add('error');
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
  document.querySelectorAll('.quiz-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.closest('.quiz-step').dataset.step, 10);

      // Deselect siblings
      btn.closest('.quiz-options').querySelectorAll('.quiz-option-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');

      // Save answer
      const value = btn.dataset.value;
      if (step === 1) quizState.answers.ageRange = value;
      if (step === 4) quizState.answers.activityLevel = value;
      if (step === 5) quizState.answers.mainGoal = value;

      // Auto-advance after short delay
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
    btn.addEventListener('click', () => {
      const step = parseInt(btn.closest('.quiz-step').dataset.step, 10);
      if (validateStep(step)) showStep(step + 1);
    });
  });

  document.querySelectorAll('[data-action="prev"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.closest('.quiz-step').dataset.step, 10);
      if (step > 1) showStep(step - 1);
    });
  });
}

// =============================================
//  SUBMIT (step 6 manual trigger)
// =============================================
async function handleSubmit() {
  if (!validateStep(6)) return;
  // Time tracking + Supabase save added in commits 8 & 9
  showStep(7);
}

function initSubmitButton() {
  const btn = document.getElementById('submitQuiz');
  if (btn) btn.addEventListener('click', handleSubmit);
}

// =============================================
//  RESTORE STATE FROM localStorage
// =============================================
function restoreQuizState() {
  try {
    const savedStep = parseInt(localStorage.getItem('gp_quiz_step'), 10);
    const savedAnswers = JSON.parse(localStorage.getItem('gp_quiz_answers') || 'null');
    if (savedAnswers) Object.assign(quizState.answers, savedAnswers);
    if (savedStep && savedStep >= 1 && savedStep <= TOTAL_STEPS) {
      // Restore input values
      if (quizState.answers.currentWeight) {
        const el = document.getElementById('currentWeight');
        if (el) el.value = quizState.answers.currentWeight;
      }
      if (quizState.answers.targetWeight) {
        const el = document.getElementById('targetWeight');
        if (el) el.value = quizState.answers.targetWeight;
      }
      if (quizState.answers.email) {
        const el = document.getElementById('userEmail');
        if (el) el.value = quizState.answers.email;
      }
      showStep(savedStep);
      return;
    }
  } catch (_) {}
  showStep(1);
}

// =============================================
//  INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initTimeTracking();
  initOptionButtons();
  initNavButtons();
  initSubmitButton();
  restoreQuizState();
});
