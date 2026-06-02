require('dotenv').config();

// Importações necessárias
const express = require('express');
const cors = require('cors');
const path = require('path');

// Inicializa Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares essenciais
// CORS necessário para frontend local (http://localhost:8080)
app.use(cors({
  origin: [
    'http://localhost:8080', 
    'http://127.0.0.1:8080',
    'http://localhost:3000', // Padrão npx serve
    'http://localhost:5000'  // Alternativa npx serve
  ],
  credentials: true
}));

// Parser JSON para bodies das requisições
app.use(express.json({ limit: '10mb' })); // 10mb para documentos
app.use(express.urlencoded({ extended: true }));

// Rotas principais
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rota raiz para confirmação visual (evita o erro 404 ao abrir no navegador)
app.get('/', (req, res) => {
  res.json({ message: 'Backend Jurídico rodando com sucesso! 🚀', status: 'ONLINE' });
});

// Seed REMOVIDO do startup (executar manualmente apenas quando necessário)
 // (async () => { try { await require('./seed.js')(); } catch (e) { console.warn('⚠️ Seed executado com warnings:', e.message); } })();

// Importa middlewares
const authMiddleware = require('./middleware/auth.js');
// Sugestão de implementação futura: const requireRole = require('./middleware/requireRole.js');

// Importa rotas
const clientesRouter = require('./routes/clientes.js');
app.use('/api/clientes', authMiddleware, clientesRouter);

const processosRouter = require('./routes/processos.js');
app.use('/api/processos', authMiddleware, processosRouter);

const documentosRouter = require('./routes/documentos.js');
app.use('/api/documentos', authMiddleware, documentosRouter);

const audienciasRouter = require('./routes/audiencias.js');
app.use('/api/audiencias', authMiddleware, audienciasRouter);

const periciasRouter = require('./routes/pericias.js');
app.use('/api/pericias', authMiddleware, periciasRouter);

const atendimentosRouter = require('./routes/atendimentos.js');
app.use('/api/atendimentos', authMiddleware, atendimentosRouter);

const usuariosRouter = require('./routes/usuarios.js');
app.use('/api/usuarios', authMiddleware, usuariosRouter);

const publicacoesRouter = require('./routes/publicacoes.js');
// Proteção de nível ADMIN para publicações
app.use('/api/publicacoes', authMiddleware, (req, res, next) => {
  // Verificação temporária inline até criar o middleware específico
  if (req.user && req.user.role === 'ADMIN') return next();
  return res.status(403).json({ error: 'Acesso negado: Requer privilégios de Administrador' });
}, publicacoesRouter);

// Rota de Webhook do Escavador (Sem authMiddleware pois vem da API externa)
const escavadorRouter = require('./routes/escavador-webhook.js');
app.use('/api/escavador/webhook', escavadorRouter);

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro Crítico:', err.stack);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Inicializa Jobs Agendados (Cron)
// Desativado em ambientes serverless (Vercel) para evitar bloqueios
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  try {
    const iniciarJobEscavador = require('./services/escavador-job.js');
    iniciarJobEscavador();
  } catch (e) {
    // Silenciado
  }
}
// 404 para rotas não encontradas
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Inicialização do servidor SILENCIOSA (sem logs de boot)
if (require.main === module) {
  app.listen(PORT, () => {
    // Logs removidos para acelerar startup
  });
}

module.exports = app;

