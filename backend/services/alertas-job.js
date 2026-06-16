/*
 * Job de Alertas Preventivos — Audiências, Perícias e Resumo
 * Executa diariamente às 07:00 (America/Fortaleza)
 */

const cron = require('node-cron');
const { supabaseAdmin } = require('../supabase');
const EmailService = require('./email');

// Lista real de destinatários (notifica clientes/advogados ativos)
function rolesNotificacao() {
  return ['ADMIN', 'ADVOGADO', 'ADVOGADA' , 'esdrassouzabrito1@gmail.com'];
}


const DIAS_ANTECIPACAO = [7, 3, 1, 0];

function diasAte(dataEvento) {
  const agora = new Date();
  const evento = new Date(dataEvento);

  agora.setHours(0, 0, 0, 0);
  evento.setHours(0, 0, 0, 0);

  return Math.round((evento - agora) / (1000 * 60 * 60 * 24));
}

async function buscarAudiencias() {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + 7);

  const { data, error } = await supabaseAdmin
    .from('audiencias')
    .select('*, processos(numero_cnj)')
    .gte('data', hoje.toISOString())
    .lte('data', limite.toISOString())
    .order('data', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function buscarAtendimentos() {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + 7);

  // Usa campo `data` porque o route já ordena por `data`.
  const { data, error } = await supabaseAdmin
    .from('atendimentos')
    .select('*, clientes(nome), usuarios(nome)')
    .gte('data', hoje.toISOString())
    .lte('data', limite.toISOString())
    .order('data', { ascending: true });

  if (error) throw error;
  return data || [];
}


async function buscarPericias() {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + 7);

  const { data, error } = await supabaseAdmin
    .from('pericias')
    .select('*, clientes(nome)')
    .gte('data', hoje.toISOString())
    .lte('data', limite.toISOString())
    .order('data', { ascending: true });

  if (error) throw error;
  return data || [];
}

async function buscarDestinatariosAtivos() {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('email')
    .eq('ativo', true)
    .in('role', rolesNotificacao());

  if (error) throw error;
  return (data || []).map(u => u.email).filter(Boolean);
}


async function enviarResumoDiario(destinatarios) {
  const hoje = new Date();
  const inicioDia = new Date(hoje);
  inicioDia.setHours(0, 0, 0, 0);

  const fimDia = new Date(hoje);
  fimDia.setHours(23, 59, 59, 999);

  const [{ data: audiencias }, { data: pericias }] = await Promise.all([
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
      .order('data', { ascending: true })
  ]);

  await EmailService.enviarResumoDiario(destinatarios, {
    audiencias: audiencias || [],
    pericias: pericias || [],
    data: hoje
  });
}

async function executarVerificacaoDeAlertas() {
  console.log('[Alertas] Iniciando verificação...');

  const destinatarios = await buscarDestinatariosAtivos();

  if (!destinatarios.length) {
    console.warn('[Alertas] Nenhum destinatário ativo para notificação.');

    return;
  }

  const audiencias = await buscarAudiencias();
  const pericias = await buscarPericias();
  const atendimentos = await buscarAtendimentos();


  for (const audiencia of audiencias) {
    const dias = diasAte(audiencia.data);
    if (DIAS_ANTECIPACAO.includes(dias)) {
      await EmailService.enviarAlertaAudiencia(destinatarios, audiencia, dias);
    }
  }

  for (const pericia of pericias) {
    const dias = diasAte(pericia.data);
    if (DIAS_ANTECIPACAO.includes(dias)) {
      await EmailService.enviarAlertaPericia(destinatarios, pericia, dias);
    }
  }

  for (const atendimento of atendimentos) {
    const dias = diasAte(atendimento.data);
    if (DIAS_ANTECIPACAO.includes(dias)) {
      await EmailService.enviarAlertaAtendimento(destinatarios, atendimento, dias);
    }
  }

  await enviarResumoDiario(destinatarios);

  console.log('[Alertas] Verificação concluída.');
}

function iniciarJobAlertas() {
  cron.schedule('0 7 * * *', executarVerificacaoDeAlertas, {
    timezone: 'America/Fortaleza'
  });

  console.log('[Alertas] Job agendado para 07:00 (America/Fortaleza)');
}

module.exports = { iniciarJobAlertas, executarVerificacaoDeAlertas };

