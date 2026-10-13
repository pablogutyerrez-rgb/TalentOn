import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const isSupabaseConfigured = Boolean(url && key);
function publicKey(value: string) {
  if (value.startsWith('sb_secret_')) throw new Error('La clave secreta Supabase no debe estar en VITE_.');
  if (value.split('.').length === 3) { try { if (JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role === 'service_role') throw new Error('SUPABASE_PRIVATE_KEY_IN_FRONTEND'); } catch(e) { if (e instanceof Error && e.message === 'SUPABASE_PRIVATE_KEY_IN_FRONTEND') throw e; } }
  return value;
}
const storageKey = 'talent-on:supabase-session';
const preferredStorage = () => localStorage.getItem('talent-on:remember-supabase') === 'false' ? sessionStorage : localStorage;
export const supabase = isSupabaseConfigured ? createClient(url, publicKey(key), {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey, storage: { getItem: k => preferredStorage().getItem(k), setItem: (k,v) => preferredStorage().setItem(k,v), removeItem: k => { localStorage.removeItem(k); sessionStorage.removeItem(k); } } },
}) : null;
export async function signInSupabase(username: string, password: string, remember = true) {
  if (!supabase) throw new Error('Supabase todavía no está configurado.');
  localStorage.setItem('talent-on:remember-supabase', String(remember));
  localStorage.removeItem('talent:company');
  return supabase.auth.signInWithPassword({ email: `${username.trim().toLowerCase()}@auth.talentcc.invalid`, password });
}
export async function signOutSupabase() { if (supabase) { const { error } = await supabase.auth.signOut(); if (error) throw error; } }
export async function supabaseAccessToken() { if (!supabase) throw new Error('Supabase todavía no está configurado.'); const { data, error } = await supabase.auth.getSession(); if (error || !data.session) throw new Error('No hay sesión Supabase.'); return data.session.access_token; }
