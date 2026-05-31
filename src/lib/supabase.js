import { createClient } from '@supabase/supabase-js';

// Vite exposes only vars prefixed with VITE_ to the client bundle.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// When the keys are absent the app still runs, persisting to localStorage.
export const supabaseEnabled = Boolean(url && anonKey);

export const supabase = supabaseEnabled ? createClient(url, anonKey) : null;

const TABLE = 'portfolios';

/* ---- auth ---------------------------------------------------------------- */
export const getSession = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export const onAuthChange = (cb) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
};

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUp = (email, password) => supabase.auth.signUp({ email, password });

export const signOut = () => supabase.auth.signOut();

/* ---- portfolio snapshot (one jsonb row per user) ------------------------- */
export const loadPortfolio = async (userId) => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLE)
    .select('data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
};

export const savePortfolio = async (userId, data) => {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
};
