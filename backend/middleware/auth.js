/*
 * Middleware de Autenticação Global
 * Valida o JWT do Supabase e anexa o usuário da tabela 'usuarios' ao req.user
 */
const supabase = require('../supabase');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

  const token = authHeader.split(' ')[1];

  try {
    // 1. Valida a sessão com o Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Sessão inválida');

    // 2. Busca os dados estendidos (Role) na tabela de usuários
    const { data: dbUser, error: dbError } = await supabase
      .from('usuarios')
      .select('id, email, role, nome')
      .eq('email', user.email)
      .single();

    if (dbError || !dbUser) throw new Error('Usuário não encontrado no cadastro');

    // Anexa ao request para uso nas rotas e outros middlewares
    req.user = dbUser;
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

module.exports = authMiddleware;