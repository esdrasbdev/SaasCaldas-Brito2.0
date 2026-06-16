/*
 * Serviço de Envio de E-mails Transacionais (Resend)
 * Mantém o alerta de publicações e adiciona alertas de audiência/perícia/resumo diário.
 */

require('dotenv').config();
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

function layoutBase(titulo, corDestaque, conteudoHtml) {
  return `
    <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f172a; padding: 20px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: #f8fafc; margin: 0; font-size: 18px;">Advocacia Caldas &amp; Brito</h1>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">Sistema de Alertas Jurídicos</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
        <div style="border-left: 4px solid ${corDestaque}; padding-left: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 4px; color: #0f172a; font-size: 16px;">${titulo}</h2>
        </div>
        ${conteudoHtml}
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          E-mail automático — Sistema Jurídico CB. Acesse o painel para gerenciar.
        </p>
      </div>
    </div>
  `;
}

async function enviar(destinatarios, subject, html) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY ausente. E-mail não enviado.');
    return { sucesso: false, motivo: 'sem_api_key' };
  }

  const to = Array.isArray(destinatarios) ? destinatarios : [destinatarios];
  const validos = to.filter(e => e && e.includes('@'));
  if (!validos.length) return { sucesso: false, motivo: 'destinatario_invalido' };

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: validos,
      subject,
      html
    });

    if (error) throw error;
    console.log(`[Email] Enviado para ${validos.join(', ')} — ID: ${data.id}`);
    return { sucesso: true, id: data.id };
  } catch (err) {
    console.error('[Email] Falha ao enviar:', err.message);
    return { sucesso: false, motivo: err.message };
  }
}

const EmailService = {
  // Envio direto (teste manual)
  // Não usa Supabase; depende apenas de RESEND_API_KEY + EMAIL_FROM.
  async enviarDireto(to, subject, html) {
    return enviar(to, subject, html);
  },

  // Alertas existentes: publicações
  async enviarAlertaPublicacao(destinatario, publicacao) {
    const dataPub = new Date(publicacao.data_publicacao).toLocaleDateString('pt-BR');
    const dataPrazo = publicacao.prazo_data
      ? new Date(publicacao.prazo_data).toLocaleDateString('pt-BR')
      : 'A verificar';

    const html = layoutBase(
      'Nova Publicação Jurídica Detectada',
      '#2563eb',
      `<p><strong>Processo:</strong> ${publicacao.numero_cnj || 'Não identificado'}</p>
       <p><strong>Diário:</strong> ${publicacao.diario}</p>
       <p><strong>Data da Publicação:</strong> ${dataPub}</p>
       <p><strong>Prazo:</strong> <span style="color:#d97706;font-weight:bold;">${publicacao.prazo_dias ? publicacao.prazo_dias + ' dias' : 'Não identificado'}</span></p>
       <p><strong>Data Limite:</strong> ${dataPrazo}</p>
       <div style="background:#f8fafc;padding:12px;font-family:monospace;font-size:12px;white-space:pre-wrap;border-radius:4px;">
         ${String(publicacao.conteudo || '').substring(0, 400)}...
       </div>`
    );

    return enviar(destinatario, `[JURÍDICO] Nova Publicação: ${publicacao.numero_cnj || 'Atualização'}`, html);
  },

  // Novo: Audiência próxima
  async enviarAlertaAudiencia(destinatarios, audiencia, diasRestantes) {
    const dataEvento = new Date(audiencia.data);
    const dataFormatada = dataEvento.toLocaleString('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const dataPrazo = dataEvento.toLocaleDateString('pt-BR', { dateStyle: 'full' });


    const urgencia = diasRestantes <= 1 ? '#dc2626' : diasRestantes <= 3 ? '#d97706' : '#2563eb';
    const labelUrgencia = diasRestantes === 0
      ? 'HOJE'
      : diasRestantes === 1
      ? 'AMANHÃ'
      : `em ${diasRestantes} dias`;

    const html = layoutBase(
      `Audiência ${labelUrgencia.toUpperCase()}`,
      urgencia,
      `<p style="font-size:14px;"><strong>Processo:</strong> ${audiencia.processos?.numero_cnj || audiencia.processo_id}</p>
       <p><strong>Data e Hora:</strong> ${dataFormatada}</p>
       <p><strong>Data do prazo:</strong> ${dataPrazo}</p>
       <p><strong>Local:</strong> ${audiencia.local || 'Não informado'}</p>

       <p><strong>Tipo:</strong> ${audiencia.tipo || 'Não informado'}</p>
       ${audiencia.observacoes ? `<p><strong>Observações:</strong> ${audiencia.observacoes}</p>` : ''}
       <div style="background:${urgencia};color:#fff;padding:12px 16px;border-radius:6px;text-align:center;font-size:15px;font-weight:bold;margin-top:16px;">
         Faltam ${labelUrgencia}
       </div>`
    );

    return enviar(
      destinatarios,
      `[ALERTA] Audiência ${labelUrgencia} — ${audiencia.processos?.numero_cnj || 'Processo'}`,
      html
    );
  },

  // Novo: Alerta de Atendimento (prazo)
  async enviarAlertaAtendimento(destinatarios, atendimento, diasRestantes) {
    const dataFormatada = new Date(atendimento.data).toLocaleString('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const urgencia = diasRestantes <= 1 ? '#dc2626' : diasRestantes <= 3 ? '#d97706' : '#2563eb';
    const labelUrgencia = diasRestantes === 0 ? 'HOJE' : diasRestantes === 1 ? 'AMANHÃ' : `em ${diasRestantes} dias`;

    const cliente = atendimento.clientes?.nome || atendimento.cliente?.nome || atendimento.cliente_nome || 'Cliente';

    const html = layoutBase(
      `Atendimento ${labelUrgencia.toUpperCase()}`,
      urgencia,
      `<p style="font-size:14px;"><strong>Cliente:</strong> ${cliente}</p>
       <p><strong>Data e Hora:</strong> ${dataFormatada}</p>
       ${atendimento.local ? `<p><strong>Local:</strong> ${atendimento.local}</p>` : ''}
       ${atendimento.observacoes ? `<p><strong>Observações:</strong> ${atendimento.observacoes}</p>` : ''}
       <div style="background:${urgencia};color:#fff;padding:12px 16px;border-radius:6px;text-align:center;font-size:15px;font-weight:bold;margin-top:16px;">
         Faltam ${labelUrgencia}
       </div>`
    );

    return enviar(
      destinatarios,
      `[ALERTA] Atendimento ${labelUrgencia} — ${cliente}`,
      html
    );
  },

  // Novo: Perícia próxima
  async enviarAlertaPericia(destinatarios, pericia, diasRestantes) {
    const dataFormatada = new Date(pericia.data).toLocaleString('pt-BR', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const urgencia = diasRestantes <= 1 ? '#dc2626' : diasRestantes <= 3 ? '#d97706' : '#7c3aed';
    const labelUrgencia = diasRestantes === 0 ? 'HOJE' : diasRestantes === 1 ? 'AMANHÃ' : `em ${diasRestantes} dias`;

    const html = layoutBase(
      `Perícia ${labelUrgencia.toUpperCase()}`,
      urgencia,
      `<p><strong>Cliente:</strong> ${pericia.clientes?.nome || 'Não informado'}</p>
       <p><strong>Tipo:</strong> ${pericia.tipo || 'Não informado'} (${pericia.tribunal || ''} — ${pericia.vara || ''})</p>
       <p><strong>Data:</strong> ${dataFormatada}</p>
       <p><strong>Data do prazo:</strong> ${new Date(pericia.data).toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p>
       <p><strong>Local:</strong> ${pericia.local || 'Não informado'}</p>

       <p><strong>Perito:</strong> ${pericia.perito || 'Não informado'}</p>
       <div style="background:${urgencia};color:#fff;padding:12px 16px;border-radius:6px;text-align:center;font-size:15px;font-weight:bold;margin-top:16px;">
         Faltam ${labelUrgencia}
       </div>`
    );

    return enviar(
      destinatarios,
      `[ALERTA] Perícia ${labelUrgencia} — ${pericia.clientes?.nome || 'Cliente'}`,
      html
    );
  },

  // Novo: Resumo diário
  async enviarResumoDiario(destinatarios, { audiencias, pericias, data }) {
    const dataFormatada = new Date(data).toLocaleDateString('pt-BR', { dateStyle: 'full' });

    const listarEventos = (eventos) => {
      if (!eventos.length) return `<p style="color:#64748b;">Nenhuma encontrada hoje.</p>`;
      return eventos.map(e => `
        <div style="background:#f8fafc;padding:10px 14px;border-radius:4px;margin-bottom:8px;border-left:3px solid #0f172a;">
          <strong>${new Date(e.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
          — ${e.processos?.numero_cnj || e.clientes?.nome || 'N/I'}
          ${e.local ? ` | ${e.local}` : ''}
        </div>
      `).join('');
    };

    const totalEventos = (audiencias?.length || 0) + (pericias?.length || 0);

    const html = layoutBase(
      `Agenda do Dia — ${dataFormatada}`,
      '#0f172a',
      `<p><strong>${totalEventos} evento(s) para hoje.</strong></p>
       <h3 style="font-size:14px;color:#2563eb;margin-bottom:8px;">Audiencias (${audiencias?.length || 0})</h3>
       ${listarEventos(audiencias || [])}
       <h3 style="font-size:14px;color:#7c3aed;margin-bottom:8px;margin-top:16px;">Pericias (${pericias?.length || 0})</h3>
       ${listarEventos(pericias || [])}`
    );

    return enviar(destinatarios, `[AGENDA] Resumo do dia — ${dataFormatada}`, html);
  }
};

module.exports = EmailService;

