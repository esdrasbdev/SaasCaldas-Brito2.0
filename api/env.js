// Vercel Serverless Function: /api/env
// Exibe apenas variáveis públicas necessárias ao frontend (Supabase anon key).
// NÃO expor SERVICE_ROLE_KEY.

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({
        error: 'SUPABASE_URL e/ou SUPABASE_ANON_KEY não configuradas no Vercel.'
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: supabaseAnonKey
    });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao carregar /api/env', message: err?.message });
  }
}

