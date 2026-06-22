/*
 * Serviço de Envio de E-mails Transacionais (Resend)
 */

require('dotenv').config();
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Remetente padrão (domínio verificado em produção)
const EMAIL_FROM = process.env.EMAIL_FROM || 'Advocacia Caldas & Brito <alertas@caldasebritoadvocacia.com.br>';

function layoutBase(titulo, corDestaque, conteudoHtml) {
  const faviconInline = `data:image/png;base64,iVBORw0KGgo=`; // marcador: favicon inline só para render determinístico

  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 680px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #0f172a 0%, #111827 60%, #0b1220 100%); padding: 22px 24px; border-radius: 14px 14px 0 0; position: relative; overflow: hidden;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px;height:40px;border-radius:12px;background: rgba(255,255,255,0.10); display:flex; align-items:center; justify-content:center; border: 1px solid rgba(255,255,255,0.14);">
            <img src="${faviconInline}" alt="CB" width="20" height="20" style="display:block; border-radius:6px;" />
          </div>
          <div>
            <div style="color:#f8fafc; font-size:16px; font-weight:800; letter-spacing:-0.02em;">Advocacia Caldas &amp; Brito</div>
            <div style="color:#9ca3af; font-size:12.5px; margin-top:2px;">Sistema de Alertas Jurídicos</div>
          </div>
        </div>

        <div style="margin-top:14px; padding-top:14px; border-top: 1px solid rgba(255,255,255,0.10); display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div style="color:#cbd5e1; font-size:12.5px;">Notificação automática</div>
          <div style="color:#94a3b8; font-size:12.5px;">${new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <div style="background:#ffffff; padding: 26px 24px; border-left:1px solid #e5e7eb; border-right:1px solid #e5e7eb; border-bottom:1px solid #e5e7eb; border-radius: 0 0 14px 14px;">
        <div style="border:1px solid #e5e7eb; border-left: 5px solid ${corDestaque}; background: #f9fafb; padding: 16px 16px; border-radius: 12px; margin-bottom: 18px;">
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
            <h2 style="margin:0; font-size:16px; color:#0f172a; line-height:1.3;">${titulo}</h2>
            <div style="font-size:12px; color:#64748b; font-weight:700; white-space:nowrap;">Atualizado agora</div>
          </div>
        </div>

        ${conteudoHtml}

        <div style="margin-top:22px; padding-top:16px; border-top: 1px solid #e2e8f0; display:flex; align-items:flex-start; gap:12px;">
          <div style="width:10px;height:10px;background:${corDestaque}; border-radius:999px; margin-top:6px; flex:0 0 auto;"></div>
          <div style="font-size:11.5px; color:#64748b; line-height:1.5;">
            E-mail automático — Sistema Jurídico CB.<br/>
            Acesse o painel para gerenciar. Em caso de dúvidas, contate a administração.
          </div>
        </div>
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

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

const EmailService = {
  // Envio direto (teste manual)
  async enviarDireto(to, subject, html) {
    return enviar(to, subject, html);
  },

  // Alertas existentes: audiências/perícias/atendimentos
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
      `<p style="font-size:14px;"><strong>Processo:</strong> ${escapeHtml(audiencia.processos?.numero_cnj || audiencia.processo_id)}</p>
       <p><strong>Data e Hora:</strong> ${escapeHtml(dataFormatada)}</p>
       <p><strong>Data do prazo:</strong> ${escapeHtml(dataPrazo)}</p>
       <p><strong>Local:</strong> ${escapeHtml(audiencia.local || 'Não informado')}</p>
       <p><strong>Tipo:</strong> ${escapeHtml(audiencia.tipo || 'Não informado')}</p>
       ${audiencia.observacoes ? `<p><strong>Observações:</strong> ${escapeHtml(audiencia.observacoes)}</p>` : ''}
       <div style="background:${urgencia};color:#fff;padding:12px 16px;border-radius:6px;text-align:center;font-size:15px;font-weight:bold;margin-top:16px;">
         Faltam ${escapeHtml(labelUrgencia)}
       </div>`
    );

    return enviar(
      destinatarios,
      `[ALERTA] Audiência ${labelUrgencia} — ${audiencia.processos?.numero_cnj || 'Processo'}`,
      html
    );
  },

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
      `<p style="font-size:14px;"><strong>Cliente:</strong> ${escapeHtml(cliente)}</p>
       <p><strong>Data e Hora:</strong> ${escapeHtml(dataFormatada)}</p>
       ${atendimento.local ? `<p><strong>Local:</strong> ${escapeHtml(atendimento.local)}</p>` : ''}
       ${atendimento.observacoes ? `<p><strong>Observações:</strong> ${escapeHtml(atendimento.observacoes)}</p>` : ''}
       <div style="background:${urgencia};color:#fff;padding:12px 16px;border-radius:6px;text-align:center;font-size:15px;font-weight:bold;margin-top:16px;">
         Faltam ${escapeHtml(labelUrgencia)}
       </div>`
    );

    return enviar(
      destinatarios,
      `[ALERTA] Atendimento ${labelUrgencia} — ${cliente}`,
      html
    );
  },

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
      `<p><strong>Cliente:</strong> ${escapeHtml(pericia.clientes?.nome || 'Não informado')}</p>
       <p><strong>Tipo:</strong> ${escapeHtml(pericia.tipo || 'Não informado')} (${escapeHtml(pericia.tribunal || '')} — ${escapeHtml(pericia.vara || '')})</p>
       <p><strong>Data:</strong> ${escapeHtml(dataFormatada)}</p>
       <p><strong>Data do prazo:</strong> ${escapeHtml(new Date(pericia.data).toLocaleDateString('pt-BR', { dateStyle: 'full' }))}</p>
       <p><strong>Local:</strong> ${escapeHtml(pericia.local || 'Não informado')}</p>
       <p><strong>Perito:</strong> ${escapeHtml(pericia.perito || 'Não informado')}</p>
       <div style="background:${urgencia};color:#fff;padding:12px 16px;border-radius:6px;text-align:center;font-size:15px;font-weight:bold;margin-top:16px;">
         Faltam ${escapeHtml(labelUrgencia)}
       </div>`
    );

    return enviar(
      destinatarios,
      `[ALERTA] Perícia ${labelUrgencia} — ${pericia.clientes?.nome || 'Cliente'}`,
      html
    );
  },

  // Novos clientes/processos
  async enviarAlertaClientesNovos(destinatarios, clientes) {
    const listar = clientes.map(c =>
      `<div style="background:#f8fafc;padding:10px 14px;border-radius:4px;margin-bottom:8px;border-left:3px solid #2563eb;">
        <strong>${escapeHtml(c.nome)}</strong>
        <span style="font-size:0.85rem; color:#64748b; margin-left:8px;">${escapeHtml(c.tipo || '')} ${c.area_juridica ? '— ' + escapeHtml(c.area_juridica) : ''}</span>
      </div>`
    ).join('');

    const html = layoutBase(
      `${clientes.length} Novo(s) Cliente(s) Cadastrado(s)`,
      '#2563eb',
      `<p>Os seguintes clientes foram cadastrados no sistema nas últimas 24 horas:</p>
       ${listar}
       <p style="font-size:0.85rem; color:#64748b; margin-top:12px;">Acesse o painel para visualizar os detalhes completos.</p>`
    );

    return enviar(
      destinatarios,
      `[SISTEMA] ${clientes.length} novo(s) cliente(s) cadastrado(s)`,
      html
    );
  },

  async enviarAlertaProcessosNovos(destinatarios, processos) {
    const listar = processos.map(p =>
      `<div style="background:#f8fafc;padding:10px 14px;border-radius:4px;margin-bottom:8px;border-left:3px solid #7c3aed;">
        <strong>${escapeHtml(p.numero_cnj || 'CNJ não informado')}</strong>
        <span style="font-size:0.85rem; color:#64748b; margin-left:8px;">${escapeHtml(p.clientes?.nome || '')}</span>
        <div style="font-size:0.8rem; color:#94a3b8; margin-top:2px;">${[p.tribunal, p.vara].filter(Boolean).map(escapeHtml).join(' — ') || ''}</div>
      </div>`
    ).join('');

    const html = layoutBase(
      `${processos.length} Novo(s) Processo(s) Cadastrado(s)`,
      '#7c3aed',
      `<p>Os seguintes processos foram cadastrados no sistema nas últimas 24 horas:</p>
       ${listar}
       <p style="font-size:0.85rem; color:#64748b; margin-top:12px;">Acesse o painel para visualizar os detalhes completos.</p>`
    );

    return enviar(
      destinatarios,
      `[SISTEMA] ${processos.length} novo(s) processo(s) cadastrado(s)`,
      html
    );
  },

  // Resumo diário — inclui audiências/perícias/atendimentos
  async enviarResumoDiario(destinatarios, { audiencias, pericias, atendimentos, data }) {
    const dataFormatada = new Date(data).toLocaleDateString('pt-BR', { dateStyle: 'full' });

    const listarEventos = (eventos, cor) => {
      if (!eventos || !eventos.length) {
        return `<p style="color:#64748b; font-size:0.85rem;">Nenhum evento para hoje.</p>`;
      }
      return eventos.map(e => `
        <div style="background:#f8fafc;padding:10px 14px;border-radius:4px;margin-bottom:8px;border-left:3px solid ${cor};">
          <strong>${new Date(e.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Fortaleza' })}</strong>
          — ${escapeHtml(e.processos?.numero_cnj || e.clientes?.nome || 'N/I')}
          ${e.local ? `<span style="color:#64748b;"> | ${escapeHtml(e.local)}</span>` : ''}
          ${e.clientes?.nome && e.processos ? `<div style="font-size:0.8rem; color:#94a3b8;">${escapeHtml(e.clientes.nome)}</div>` : ''}
        </div>
      `).join('');
    };

    const total = (audiencias?.length || 0) + (pericias?.length || 0) + (atendimentos?.length || 0);

    const html = layoutBase(
      `Agenda do Dia — ${dataFormatada}`,
      '#0f172a',
      `<p><strong>${total} evento(s) para hoje.</strong></p>

       <h3 style="font-size:13px;color:#2563eb;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em;">
         Audiências (${audiencias?.length || 0})
       </h3>
       ${listarEventos(audiencias, '#2563eb')}

       <h3 style="font-size:13px;color:#7c3aed;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em;">
         Perícias (${pericias?.length || 0})
       </h3>
       ${listarEventos(pericias, '#7c3aed')}

       <h3 style="font-size:13px;color:#0891b2;margin:16px 0 8px;text-transform:uppercase;letter-spacing:0.05em;">
         Atendimentos (${atendimentos?.length || 0})
       </h3>
       ${listarEventos(atendimentos, '#0891b2')}`
    );

    return enviar(destinatarios, `[AGENDA] Resumo do dia — ${dataFormatada}`, html);
  }
};

module.exports = EmailService;

