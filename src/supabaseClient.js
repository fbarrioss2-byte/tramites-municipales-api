// supabaseClient.js
// Con anon key el cliente respeta las políticas RLS de Supabase.
// El token JWT del usuario se inyecta por request en cada controlador.

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables: SUPABASE_URL y SUPABASE_ANON_KEY son requeridas');
}

// Cliente base sin token (para operaciones públicas)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Cliente con token del usuario — úsalo en controllers que requieren auth
// Uso: const db = getSupabaseUser(req)
const getSupabaseUser = (req) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

module.exports = { supabase, getSupabaseUser };
