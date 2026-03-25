import { save, getRowId, KEY_START } from "./session.js";
import { dbPatchKeepAlive } from "./db.js";

let _startTime = null;

export function getSeconds() {
  const start = _startTime || parseInt(localStorage.getItem(KEY_START), 10);
  return start ? Math.floor((Date.now() - start) / 1000) : 0;
}

export function initTimeTracking() {
  const saved = parseInt(localStorage.getItem(KEY_START), 10);
  _startTime = saved || Date.now();
  localStorage.setItem(KEY_START, _startTime);

  // Heartbeat every 30 s
  setInterval(() => save({ time_spent_sec: getSeconds() }), 30_000);

  // Save on tab hide / close — keepalive so the request survives unload
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      const id = getRowId();
      if (id) dbPatchKeepAlive(id, { time_spent_sec: getSeconds() });
    }
  });
  window.addEventListener("beforeunload", () => {
    const id = getRowId();
    if (id) dbPatchKeepAlive(id, { time_spent_sec: getSeconds() });
  });
}
