import { initSession } from "./session.js";
import { initTimeTracking } from "./time.js";
import { initOptionButtons, initNavButtons, initSubmitButton, restoreState } from "./quiz.js";

document.addEventListener("DOMContentLoaded", async () => {
  await initSession();
  initTimeTracking();
  initOptionButtons();
  initNavButtons();
  initSubmitButton();
  restoreState();
});
