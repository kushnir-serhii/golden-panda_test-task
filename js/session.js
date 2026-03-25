import { dbInsert, dbPatch } from "./db.js";
import { uuid } from "./utils.js";

export const KEY_SESSION = "gp_session_id";
export const KEY_ROW     = "gp_row_id";
export const KEY_START   = "gp_start_time";
export const KEY_STEP    = "gp_quiz_step";
export const KEY_ANSWERS = "gp_quiz_answers";

let rowId = null;

export function getRowId() { return rowId; }

function getSessionId() {
  let id = localStorage.getItem(KEY_SESSION);
  if (!id) {
    id = uuid();
    localStorage.setItem(KEY_SESSION, id);
  }
  return id;
}

export async function initSession() {
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

export function save(data) {
  if (!rowId) return Promise.resolve();
  return dbPatch(rowId, data);
}

export function clearSession() {
  [KEY_SESSION, KEY_ROW, KEY_START, KEY_STEP, KEY_ANSWERS,
   "gp_visit_row_id", "gp_start_time"].forEach((k) => localStorage.removeItem(k));
  rowId = null;
}
