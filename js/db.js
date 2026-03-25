import { SUPABASE_URL, SUPABASE_KEY, TABLE, db } from "./config.js";
import { uuid } from "./utils.js";

export async function dbInsert(data) {
  // Generate id client-side — avoids needing a SELECT policy to get the id back
  const id = uuid();
  const { error } = await db.from(TABLE).insert({ ...data, id });
  if (error) throw new Error(`Insert failed: ${error.message}`);
  return { id };
}

export function dbPatch(id, data) {
  return db.from(TABLE)
    .update(data)
    .eq("id", id)
    .then(({ error }) => {
      if (error) console.warn("[Patch]", error.message);
    });
}

// Raw fetch with keepalive:true — survives page close / tab switch.
// The Supabase SDK doesn't support keepalive, so we fall back to fetch for unload events.
export function dbPatchKeepAlive(id, data) {
  fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
    keepalive: true,
  }).catch(() => {});
}
