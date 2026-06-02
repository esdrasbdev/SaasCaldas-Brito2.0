/*
 * Serviço de Envio de E-mails Transacionais (Resend)
 */

require('dotenv').config();
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'; // Use seu domínio verificado em produção

const EmailService = {
  async enviarAlertaPublicacao(destinatario, publicacao) {
    if (!resend) {
      console.warn('⚠️ RESEND_API_KEY ausente. Ignorando envio de e-mail.');
      return;
    }
    if (!destinatario || !destinatario.includes('@')) {
      console.warn('⚠️ E-mail inválido para envio:', destinatario);
      return;
    }


    try {
      const dataPub = new Date(publicacao.data_publicacao).toLocaleDateString('pt-BR');
      const dataPrazo = publicacao.prazo_data 
        ? new Date(publicacao.prazo_data).toLocaleDateString('pt-BR') 
        : 'A verificar';

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px;">
          <h2 style="color: #0f172a;">Nova Publicação Jurídica Detectada</h2>
          <p>Olá, uma nova publicação foi identificada pelo nosso sistema de monitoramento.</p>
          
          <div style="background: #f8fafc; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p><strong>Processo:</strong> ${publicacao.numero_cnj || 'Não identificado'}</p>
            <p><strong>Diário:</strong> ${publicacao.diario}</p>
            <p><strong>Data da Publicação:</strong> ${dataPub}</p>
            <p><strong>Prazo Identificado:</strong> <span style="color: #d97706; font-weight: bold;">${publicacao.prazo_dias ? publicacao.prazo_dias + ' dias' : 'Não identificado'}</span></p>
            <p><strong>Data Limite Sugerida:</strong> ${dataPrazo}</p>
          </div>

          <h3>Conteúdo (Resumo):</h3>
          <p style="background: #eee; padding: 10px; font-family: monospace; font-size: 12px; white-space: pre-wrap;">
            ${publicacao.conteudo.substring(0, 500)}...
          </p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            Este é um e-mail automático do Sistema Jurídico. Acesse o painel para ver o teor completo e tomar providências.
          </p>
        </div>
      `;

      const { data, error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: destinatario,
        subject: `[JURÍDICO] Nova Publicação: ${publicacao.numero_cnj || 'Atualização'}`,
        html: htmlContent,
      });

      if (error) console.error('Erro ao enviar e-mail:', error);
      else console.log(`📧 E-mail enviado para ${destinatario} (ID: ${data.id})`);

    } catch (err) {
      console.error('Falha crítica no serviço de e-mail:', err);
    }
  }
};

module.exports = EmailService;