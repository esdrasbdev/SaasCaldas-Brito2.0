/*
 * Job de Alertas — SaasCaldas-Brito 2.0
 * Executa diariamente às 07:00 (America/Fortaleza)
 *
 * Cobre: audiências, perícias, atendimentos, processos novos, publicações e resumo diário.
 * Roles notificados: ADMIN, ADVOGADO, ADVOGADA, ESTAGIARIO, ESTAGIARIA
 */

const cron = require('node-cron');
const { supabaseAdmin } = require('../supabase');
const EmailService = require('./email');

// Dias de antecipação para alertas de prazo
const DIAS_ANTECIPACAO = [7, 3, 1, 0];

// Roles que recebem notificações
const ROLES_JURIDICOS = ['ADMIN', 'ADVOGADO', 'ADVOGADA', 'ESTAGIARIO', 'ESTAGIARIA'];
const ROLES_ADMIN_ADV = ['ADMIN', 'ADVOGADO', 'ADVOGADA'];

// Emails extras fixos (sem role obrigatório) — configurar via ALERT_EMAILS_EXTRA
function emailsFixos() {
  if (!process.env.ALERT_EMAILS_EXTRA) return [];
  return process.env.ALERT_EMAILS_EXTRA.split(',').map(e => e.trim()).filter(Boolean);
}

// Calcula dias entre hoje e um evento (sem hora, só data)
function diasAte(dataEvento) {
  const agora = new Date();
  const evento = new Date(dataEvento);
  agora.setHours(0, 0, 0, 0);
  evento.setHours(0, 0, 0, 0);
  return Math.round((evento - agora) / (1000 * 60 * 60 * 24));
}

// Busca destinatários ativos filtrando por roles
async function buscarDestinatarios(roles) {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('email, role')
    .eq('ativo', true)
    .in('role', roles);

  if (error) throw error;

  const emailsDoBanco = (data || []).map(u => u.email).filter(Boolean);
  const todos = [...new Set([...emailsDoBanco, ...emailsFixos()])];
  return todos;
}

// ─── Buscas de eventos ────────────────────────────────────────────────────────

async function buscarAudiencias(horizonte = 7) {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + horizonte);

  const { data, error } = await supabaseAdmin
    .from('audiencias')
    .select('*, processos(numero_cnj, clientes(nome))')
    .gte('data', hoje.toISOString())
    .lte('data', limite.toISOString())
    .order('data', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function buscarPericias(horizonte = 7) {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + horizonte);

  const { data, error } = await supabaseAdmin
    .from('pericias')
    .select('*, clientes(nome)')
    .gte('data', hoje.toISOString())
    .lte('data', limite.toISOString())
    .order('data', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function buscarAtendimentos(horizonte = 7) {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + horizonte);

  const { data, error } = await supabaseAdmin
    .from('atendimentos')
    .select('*, clientes(nome), usuarios(nome)')
    .gte('data', hoje.toISOString())
    .lte('data', limite.toISOString())
    .order('data', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Processos cadastrados nas últimas 24h
async function buscarProcessosNovos() {
  const limite = new Date();
  limite.setHours(limite.getHours() - 24);

  const { data, error } = await supabaseAdmin
    .from('processos')
    .select('*, clientes(nome)')
    .gte('criado_em', limite.toISOString())
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Clientes cadastrados nas últimas 24h
async function buscarClientesNovos() {
  const limite = new Date();
  limite.setHours(limite.getHours() - 24);

  const { data, error } = await supabaseAdmin
    .from('clientes')
    .select('id, nome, tipo, area_juridica, criado_em')
    .gte('criado_em', limite.toISOString())
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Publicações não lidas (para ADMIN e ADV)
async function buscarPublicacoesNaoLidas() {
  const { data, error } = await supabaseAdmin
    .from('publicacoes')
    .select('*')
    .eq('lida', false)
    .order('data_publicacao', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data || [];
}

// ─── Execução principal ───────────────────────────────────────────────────────

async function executarVerificacaoDeAlertas() {
  console.log('[Alertas] Iniciando verificação...');

  // Destinatários por perfil
  const destJuridicos = await buscarDestinatarios(ROLES_JURIDICOS); // todos — prazos
  const destAdminAdv = await buscarDestinatarios(ROLES_ADMIN_ADV); // apenas adm/adv — novos registros e publicações

  if (!destJuridicos.length) {
    console.warn('[Alertas] Nenhum destinatário ativo. Abortando.');
    return;
  }

  // 1. Alertas de prazo — audiências (todos os perfis jurídicos)
  const audiencias = await buscarAudiencias(7);
  for (const audiencia of audiencias) {
    const dias = diasAte(audiencia.data);
    if (DIAS_ANTECIPACAO.includes(dias)) {
      await EmailService.enviarAlertaAudiencia(destJuridicos, audiencia, dias);
    }
  }

  // 2. Alertas de prazo — perícias (todos os perfis jurídicos)
  const pericias = await buscarPericias(7);
  for (const pericia of pericias) {
    const dias = diasAte(pericia.data);
    if (DIAS_ANTECIPACAO.includes(dias)) {
      await EmailService.enviarAlertaPericia(destJuridicos, pericia, dias);
    }
  }

  // 3. Alertas de prazo — atendimentos (todos os perfis jurídicos)
  const atendimentos = await buscarAtendimentos(7);
  for (const atendimento of atendimentos) {
    const dias = diasAte(atendimento.data);
    if (DIAS_ANTECIPACAO.includes(dias)) {
      await EmailService.enviarAlertaAtendimento(destJuridicos, atendimento, dias);
    }
  }

  // 4. Novos clientes cadastrados ontem — apenas ADMIN e ADVOGADO
  const clientesNovos = await buscarClientesNovos();
  if (clientesNovos.length > 0 && destAdminAdv.length > 0) {
    await EmailService.enviarAlertaClientesNovos(destAdminAdv, clientesNovos);
  }

  // 5. Novos processos cadastrados ontem — apenas ADMIN e ADVOGADO
  const processosNovos = await buscarProcessosNovos();
  if (processosNovos.length > 0 && destAdminAdv.length > 0) {
    await EmailService.enviarAlertaProcessosNovos(destAdminAdv, processosNovos);
  }

  // 6. Publicações não lidas — apenas ADMIN e ADVOGADO
  const publicacoes = await buscarPublicacoesNaoLidas();
  if (publicacoes.length > 0 && destAdminAdv.length > 0) {
    await EmailService.enviarResumoPublicacoes(destAdminAdv, publicacoes);
  }

  // 7. Resumo diário — todos os perfis jurídicos
  await enviarResumoDiario(destJuridicos);

  console.log('[Alertas] Verificação concluída.');
}

async function enviarResumoDiario(destinatarios) {
  // Resumo diário com audiências, perícias e atendimentos
  const hoje = new Date();
  const inicioDia = new Date(hoje);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(hoje);
  fimDia.setHours(23, 59, 59, 999);

  const [{ data: audiencias }, { data: pericias }, { data: atendimentos }] = await Promise.all([
    supabaseAdmin
      .from('audiencias')
      .select('*, processos(numero_cnj)')
      .gte('data', inicioDia.toISOString())
      .lte('data', fimDia.toISOString())
      .order('data', { ascending: true }),

    supabaseAdmin
      .from('pericias')
      .select('*, clientes(nome)')
      .gte('data', inicioDia.toISOString())
      .lte('data', fimDia.toISOString())
      .order('data', { ascending: true }),

    supabaseAdmin
      .from('atendimentos')
      .select('*, clientes(nome)')
      .gte('data', inicioDia.toISOString())
      .lte('data', fimDia.toISOString())
      .order('data', { ascending: true })
  ]);

  await EmailService.enviarResumoDiario(destinatarios, {
    audiencias: audiencias || [],
    pericias: pericias || [],
    atendimentos: atendimentos || [],
    data: hoje
  });
}

function iniciarJobAlertas() {
  cron.schedule('0 7 * * *', executarVerificacaoDeAlertas, {
    timezone: 'America/Fortaleza'
  });
  console.log('[Alertas] Job agendado para 07:00 (America/Fortaleza)');
}

module.exports = { iniciarJobAlertas, executarVerificacaoDeAlertas };

