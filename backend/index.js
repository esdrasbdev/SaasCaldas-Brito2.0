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
    'http://localhost:3000',
    'http://localhost:5000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));


// Parser JSON para bodies das requisições
// Upload de documentos é enviado como base64 dentro de JSON.
// Para suportar ~15MB reais em base64 (≈ 20,5MB) com overhead de JSON, usamos um limite maior.
// Limite do body para suportar upload base64 (aprox. 15MB arquivo + overhead de base64/json)
// Aumentamos para reduzir chance de 413 no runtime/serverless.
// Para endpoints multipart não precisa do body parser JSON.
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));




// Rotas principais
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rota raiz para confirmação visual (evita o erro 404 ao abrir no navegador)
app.get('/', (req, res) => {
  res.json({ message: 'Backend Jurídico rodando com sucesso! 🚀', status: 'ONLINE' });
});

// Endpoint de teste de e-mail (sem depender do Supabase e do fluxo de alertas)
// Requer ADMIN e só envia para destinatário informado.
// (Sem Require de middleware aqui; a rota exige ADMIN via handler)

// Endpoint de teste de e-mail (sem depender de Supabase/alertas)
// Rota: POST /api/email/testar
// Arquivo: backend/routes/email-test.js
app.use('/api/email', require('./routes/email-test.js'));

// Config do Supabase para o frontend (evita dependência de js/env.js no deploy)
// Obs: rotas de backend precisam responder exatamente /api/env
app.get('/api/env', (req, res) => {
  return require('./routes/env.js')(req, res);
});




// Seed REMOVIDO do startup (executar manualmente apenas quando necessário)
// (async () => { try { await require('./seed.js')(); } catch (e) { console.warn('⚠️ Seed executado com warnings:', e.message); } })();

// Importa middlewares
const authMiddleware = require('./middleware/auth.js');

// Sugestão de implementação futura: const requireRole = require('./middleware/requireRole.js');

// Rota de alertas (cron + teste manual)
const alertasRouter = require('./routes/alertas.js');
app.use('/api/alertas', authMiddleware, alertasRouter);

// Rota de cron (sem authMiddleware, protegido por CRON_SECRET)
const alertasCronRouter = require('./routes/alertas-cron.js');
app.use('/api/alertas', alertasCronRouter);

// Importa rotas



const clientesRouter = require('./routes/clientes.js');
app.use('/api/clientes', authMiddleware, clientesRouter);

const processosRouter = require('./routes/processos.js');
app.use('/api/processos', authMiddleware, processosRouter);

const documentosRouter = require('./routes/documentos.js');
app.use('/api/documentos', authMiddleware, documentosRouter);

const documentosDebugRouter = require('./routes/documentos-debug.js');
// Debug de blob deve ficar acessível sem auth para diagnóstico em produção
app.use('/api/documentos', documentosDebugRouter);




const audienciasRouter = require('./routes/audiencias.js');
app.use('/api/audiencias', authMiddleware, audienciasRouter);

const periciasRouter = require('./routes/pericias.js');
app.use('/api/pericias', authMiddleware, periciasRouter);

const atendimentosRouter = require('./routes/atendimentos.js');
app.use('/api/atendimentos', authMiddleware, atendimentosRouter);

const usuariosRouter = require('./routes/usuarios.js');
app.use('/api/usuarios', authMiddleware, usuariosRouter);



// Rota de Webhook do Escavador (Sem authMiddleware pois vem da API externa)
const escavadorRouter = require('./routes/escavador-webhook.js');
app.use('/api/escavador/webhook', escavadorRouter);

// Middleware global de tratamento de erros
app.use((err, req, res, next) => {
  console.error('❌ Erro Crítico:', err?.stack || err);

  const status = err?.status || err?.statusCode || 500;

  // Payload muito grande (ex.: express.json limit)
  if (status === 413 || err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Arquivo excede o tamanho máximo permitido pelo servidor.'
    });
  }

  return res.status(status).json({
    error: status === 500 ? 'Erro interno do servidor' : (err?.message || 'Erro na requisição'),
    message: process.env.NODE_ENV === 'development' ? err?.message : undefined
  });
});


// Inicializa Jobs Agendados (Cron)
// Evita executar em Vercel serverless; executa sempre no Railway/Node
if (!process.env.VERCEL) {

  try {
    const iniciarJobEscavador = require('./services/escavador-job.js');
    iniciarJobEscavador();
  } catch (e) {
    // Silenciado
  }

  try {
    const { iniciarJobAlertas } = require('./services/alertas-job.js');
    iniciarJobAlertas();
  } catch (e) {
    console.warn('[Jobs] alertas-job não inicializado:', e.message);
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

