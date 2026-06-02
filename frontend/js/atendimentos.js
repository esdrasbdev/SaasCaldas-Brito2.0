import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';

const view = {
  container: document.getElementById('lista-atendimentos-container'),
  modal: document.getElementById('modal-atendimento'),
  form: document.getElementById('form-atendimento'),
  btnNovo: document.getElementById('btn-novo-atendimento'),
  btnCancelar: document.getElementById('btn-cancelar'),
  selectCliente: document.getElementById('atend-cliente'),
  
  init() {
    this.btnNovo.onclick = () => this.modal.style.display = 'flex';
    this.btnCancelar.onclick = () => this.modal.style.display = 'none';
    this.form.onsubmit = controller.salvar;
    
    this.container.addEventListener('click', controller.handleClick);
  },

  renderizar(dados) {
    const isAdmin = AuthAPI.getRole() === 'ADMIN';
    if (!dados || dados.length === 0) {
      this.container.innerHTML = `<div class="card-section"><p class="text-center text-muted">Nenhum atendimento registrado.</p></div>`;
      return;
    }
    
    let html = `<div class="card-section"><div class="table-responsive"><table class="recent-table">
      <thead><tr><th>Data / Canal</th><th>Cliente / Assunto</th><th>Resumo</th><th>Responsável</th>${isAdmin ? '<th style="text-align:right">Ações</th>' : ''}</tr></thead><tbody>`;
      
    html += dados.map(d => {
      // Define ícone e cor baseado no canal
      let iconClass = 'fa-comments';
      let colorStyle = 'color: #64748b';
      if (d.canal === 'WhatsApp') { iconClass = 'fa-whatsapp'; colorStyle = 'color: #25D366'; }
      else if (d.canal === 'Telefone') { iconClass = 'fa-phone'; colorStyle = 'color: #3b82f6'; }
      else if (d.canal === 'E-mail') { iconClass = 'fa-envelope'; colorStyle = 'color: #f59e0b'; }
      else if (d.canal === 'Presencial') { iconClass = 'fa-handshake'; colorStyle = 'color: #7c3aed'; }
      else if (d.canal === 'Videoconferência') { iconClass = 'fa-video'; colorStyle = 'color: #0ea5e9'; }

      return `
      <tr>
        <td style="width: 140px;">
          <div style="font-weight: 600;">${new Date(d.data).toLocaleDateString('pt-BR')}</div>
          <div style="font-size: 0.85rem; margin-top: 4px; ${colorStyle}"><i class="fa-brands ${iconClass} fa-fw"></i> ${d.canal || 'Geral'}</div>
        </td>
        <td>
          <strong style="color: var(--azul-escuro);">${d.clientes?.nome || 'Cliente N/A'}</strong>
          <div style="font-size: 0.9rem; color: var(--cinza-escuro); margin-top: 2px; font-weight: 500;">${d.titulo || 'Sem assunto'}</div>
        </td>
        <td style="max-width: 300px;"><div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--cinza-medio);" title="${d.anotacoes}">${d.anotacoes || '-'}</div></td>
        <td><small class="status-badge" style="background:#f1f5f9; color:#475569;">${d.usuarios?.nome ? d.usuarios.nome.split(' ')[0] : 'Sistema'}</small></td>
        ${isAdmin ? `<td style="text-align: right;"><button class="btn-sm btn-delete" data-id="${d.id}" style="color: #ef4444;" title="Excluir"><i class="fa-solid fa-trash"></i></button></td>` : ''}
      </tr>`;
    }).join('');
      
    html += `</tbody></table></div></div>`;
    this.container.innerHTML = html;
  }
};

const controller = {
  async init() {
    view.init();
    await this.carregar();
    await this.carregarClientes();
  },

  async carregar() {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*, clientes(nome), usuarios(nome)')
      .order('data', { ascending: false });
      
    if(!error) view.renderizar(data);
  },

  async carregarClientes() {
    const { data } = await supabase.from('clientes').select('id, nome').order('nome');
    if(data) {
      view.selectCliente.innerHTML = '<option value="">Selecione...</option>' + 
        data.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }
  },

  async salvar(e) {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Busca ID do usuario na tabela usuarios baseado no email auth
    const { data: usuarioDB } = await supabase.from('usuarios').select('id').eq('email', user.email).single();
    
    const dataInput = document.getElementById('atend-data').value;
    const horaInput = document.getElementById('atend-hora').value;
    const dataIso = (dataInput && horaInput) ? new Date(`${dataInput}T${horaInput}`).toISOString() : dataInput;

    const novo = {
      cliente_id: document.getElementById('atend-cliente').value,
      titulo: document.getElementById('atend-titulo').value,
      data: dataIso,
      canal: document.getElementById('atend-canal').value,
      duracao: document.getElementById('atend-duracao').value,
      anotacoes: document.getElementById('atend-anotacoes').value,
      usuario_id: usuarioDB?.id
    };

    const { error } = await supabase.from('atendimentos').insert(novo);
    if (!error) {
      view.modal.style.display = 'none';
      view.form.reset();
      controller.carregar();
    } else { alert('Erro: ' + error.message); }
  },

  async handleClick(e) {
    const btn = e.target.closest('.btn-delete');
    if (btn && confirm('Deseja excluir este registro?')) {
      const { error } = await supabase
        .from('atendimentos')
        .delete()
        .eq('id', btn.dataset.id);
        
      if (!error) controller.carregar();
      else alert('Erro ao excluir: ' + error.message);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => controller.init());