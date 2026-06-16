/*
 * Middleware de Autenticação Global
 * Valida o JWT do Supabase e anexa o usuário da tabela 'usuarios' ao req.user
 */
const { supabaseAdmin } = require('../supabase');
const cache = require('../cache');

const authMiddleware = async (req, res, next) => {
  // Evita múltiplas inicializações de cache em pipelines internos

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token inválido' });

  const cacheKey = `session:${token.slice(-16)}`; // evita chave gigante
  const cached = cache.get(cacheKey);
  if (cached) {
    req.user = cached;
    return next();
  }

  try {
    // 1) Valida sessão
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw new Error('Sessão inválida');

    // 2) Busca role do cadastro
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, role, nome')
      .eq('email', user.email)
      .single();

    if (dbError || !dbUser) throw new Error('Usuário não encontrado no cadastro');

    cache.set(cacheKey, dbUser, 300000); // 5min
    req.user = dbUser;
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};


module.exports = authMiddleware;