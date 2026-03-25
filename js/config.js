export const SUPABASE_URL = "https://qpykntwppcdkttkbedgs.supabase.co";
export const SUPABASE_KEY = "sb_publishable_LRkPXFhsBbgfiKcGtRCtWA_KW2sT41O";
export const TABLE = "quiz_sessions";

// supabase is the global created by the CDN UMD build loaded before this module
export const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
