import { supabase, initSupabase } from './supabase.js';

import { AuthAPI } from './auth.js';
import { formatarData, formatarHora24h } from './utils.js';

const view = {
  showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    const root = container || (() => {
      const c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : 'toast-info'}`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i>
      <div>
        <div style="font-weight:700; margin-bottom:2px;">${title || ''}</div>
        <div style="opacity:0.9; font-weight:500; font-size:0.9rem;">${message || ''}</div>
      </div>
    `;

    root.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(10px)';
      setTimeout(() => toast.remove(), 260);
    }, 3200);
  },
  container: document.getElementById('lista-atendimentos-container'),
  modal: document.getElementById('modal-atendimento'),
  form: document.getElementById('form-atendimento'),
  btnNovo: document.getElementById('btn-novo-atendimento'),
  btnCancelar: document.getElementById('btn-cancelar'),
  selectCliente: document.getElementById('atend-cliente'),

  init() {
    this.btnNovo.onclick = () => {
      this.modal.style.display = 'flex';
      this.form.classList.remove('mode-view');
      Array.from(this.form.querySelectorAll('input, select, textarea')).forEach(el => (el.disabled = false));

      const submitBtn = this.form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.style.display = 'block';

      const headerEl = this.modal.querySelector('.modal-header h2');
      if (headerEl) headerEl.textContent = 'Registrar Interação';

      const atendIdEl = document.getElementById('atend-id');
      if (atendIdEl) atendIdEl.value = '';

      this.form.reset();
    };

    this.btnCancelar.onclick = () => {
      this.modal.style.display = 'none';
    };

    this.form.onsubmit = controller.salvar;
    this.container.addEventListener('click', controller.handleClick);
  },

  // Extrai o título do atendimento de forma segura.
  // Suporta dois formatos: campo direto ou JSON serializado dentro de anotacoes (criado pela agenda)
  extrairTitulo(d) {
    if (d?.titulo && typeof d.titulo === 'string' && !d.titulo.startsWith('{')) return d.titulo;

    if (d?.anotacoes) {
      try {
        const parsed = JSON.parse(d.anotacoes);
        if (parsed && parsed.titulo) return parsed.titulo;
      } catch (e) {
        // anotacoes é texto puro
        return d.anotacoes;
      }
    }

    return 'Sem assunto';
  },

  // Extrai anotações/obs de forma segura (sem vazar o JSON bruto)
  extrairAnotacoes(d) {
    if (d?.anotacoes) {
      try {
        const parsed = JSON.parse(d.anotacoes);
        if (parsed && typeof parsed === 'object') {
          return parsed.obs || parsed.extra || '-';
        }
      } catch (e) {
        return d.anotacoes;
      }
    }
    return d?.anotacoes || '-';
  },

  getRespNome(d) {
    // Depende do formato do select no Supabase.
    // Tentamos algumas formas.
    const u = d?.usuarios || d?.usuario || null;
    if (u && typeof u === 'object') {
      const nome = u.nome || u.full_name || u.name;
      if (nome) return String(nome).split(' ')[0];
    }
    if (d?.usuarios_nome) return String(d.usuarios_nome).split(' ')[0];
    return 'Sistema';
  },

  renderizar(dados) {
    const role = AuthAPI.getRole();
    const canEdit = ['ADMIN', 'ADVOGADO', 'ADVOGADA'].includes(role);

    if (!dados || dados.length === 0) {
      this.container.innerHTML = `<div class="card-section"><p class="text-center text-muted">Nenhum atendimento registrado.</p></div>`;
      return;
    }

    const rows = dados
      .map((d) => {
        let iconClass = 'fa-comments';
        let colorStyle = 'color: #64748b';

        if (d.canal === 'WhatsApp') {
          iconClass = 'fa-whatsapp';
          colorStyle = 'color: #25D366';
        } else if (d.canal === 'Telefone') {
          iconClass = 'fa-phone';
          colorStyle = 'color: #3b82f6';
        } else if (d.canal === 'E-mail') {
          iconClass = 'fa-envelope';
          colorStyle = 'color: #f59e0b';
        } else if (d.canal === 'Presencial') {
          iconClass = 'fa-handshake';
          colorStyle = 'color: #7c3aed';
        } else if (d.canal === 'Videoconferência') {
          iconClass = 'fa-video';
          colorStyle = 'color: #0ea5e9';
        }

        // Extrai campos sensíveis de anotacoes
        const titulo = this.extrairTitulo(d);
        const anot = this.extrairAnotacoes(d);
        const resp = this.getRespNome(d);


        return `
      <tr>
        <td style="width: 140px;">
          <div style="font-weight: 600;">${d.data ? formatarData(d.data) : '-'}</div>
        </td>
        <td style="width: 160px;">
          <div style="font-size: 0.85rem; ${colorStyle}">
            <i class="fa-brands ${iconClass} fa-fw"></i> ${d.canal || 'Geral'}
          </div>
        </td>
        <td>
          <strong style="color: var(--azul-escuro);">${d.clientes?.nome || 'Cliente N/A'}</strong>
        </td>
        <td style="max-width: 420px;">
          <div style="font-size: 0.9rem; color: var(--cinza-escuro); margin-top: 2px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${anot}">${titulo}</div>
          <div style="font-size: 0.8rem; color: var(--cinza-medio); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${anot}">${anot}</div>
        </td>
        <td>
          <small class="status-badge" style="background:#f1f5f9; color:#475569;">${resp}</small>
        </td>
        <td style="text-align: right;">
          <div style="display:flex; gap:8px; justify-content:flex-end; align-items:center;">
            <button class="btn-sm btn-view" data-id="${d.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
            ${canEdit ? `
              <button class="btn-sm btn-edit" data-id="${d.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              <button class="btn-sm btn-delete" data-id="${d.id}" style="color: #ef4444;" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            ` : ''}
          </div>
        </td>
      </tr>`;

      })
      .join('');

    this.container.innerHTML = `
      <div class="card-section">
        <div class="table-responsive">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Canal</th>
                <th>Cliente</th>
                <th>Assunto</th>
                <th>Responsável</th>
                <th style="text-align:right">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
};


const controller = {
  async init() {
    view.init();

    const role = AuthAPI.getRole();
    const canEdit = ['ADMIN', 'ADVOGADO', 'ADVOGADA'].includes(role);

    const btnNovo = document.getElementById('btn-novo-atendimento');
    if (btnNovo && !canEdit) btnNovo.style.display = 'none';

    await this.carregar();
    await this.carregarClientes();
  },


  async carregar() {
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*, clientes(nome), usuarios(nome)')
      .order('data', { ascending: false });

    if (error) {
      console.error('Carregar atendimentos:', error);
      view.container.innerHTML = `<div class="card-section"><p class="text-center text-muted">Erro ao carregar atendimentos.</p></div>`;
      return;
    }

    view.renderizar(data);
  },

  async carregarClientes() {
    const { data } = await supabase.from('clientes').select('id, nome').order('nome');
    if (!data) return;

    view.selectCliente.innerHTML =
      '<option value="">Selecione...</option>' +
      data.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  },

  async salvar(e) {
    const role = AuthAPI.getRole();
    const canEdit = ['ADMIN', 'ADVOGADO', 'ADVOGADA'].includes(role);
    if (!canEdit) {
      view.showToast('warning', 'Permissão negada', 'Você não tem permissão para salvar atendimentos.');
      return;
    }
    e.preventDefault();

    if (view.form.classList.contains('mode-view')) return;

    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      alert('Usuário não autenticado.');
      return;
    }

    const { data: usuarioDB, error: usuarioErr } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', user.email)
      .single();

    if (usuarioErr || !usuarioDB) {
      alert('Usuário não encontrado no banco.');
      return;
    }

    const atendId = document.getElementById('atend-id')?.value;
    const isEdit = !!atendId;

    const dataInput = document.getElementById('atend-data').value;
    const horaInput = document.getElementById('atend-hora').value;
    const dataIso = (dataInput && horaInput) ? new Date(`${dataInput}T${horaInput}:00-03:00`).toISOString() : null;

    const payload = {
      cliente_id: document.getElementById('atend-cliente').value,
      titulo: document.getElementById('atend-titulo').value,
      data: dataIso,
      canal: document.getElementById('atend-canal').value,
      duracao: document.getElementById('atend-duracao').value,
      anotacoes: document.getElementById('atend-anotacoes').value,
      usuario_id: usuarioDB.id
    };

    const { error } = isEdit
      ? await supabase.from('atendimentos').update(payload).eq('id', atendId)
      : await supabase.from('atendimentos').insert(payload);

      if (error) {
        const msg = error.message || 'Erro ao salvar';
        view.showToast('error', 'Erro ao salvar', msg);
        return;
      }

    view.modal.style.display = 'none';
    view.form.reset();
    const atendIdEl = document.getElementById('atend-id');
    if (atendIdEl) atendIdEl.value = '';
    controller.carregar();
  },

  async handleClick(e) {
    const btnView = e.target.closest('.btn-view');
    const btnEdit = e.target.closest('.btn-edit');
    const btnDelete = e.target.closest('.btn-delete');

    const id = (btnView || btnEdit || btnDelete)?.dataset?.id;
    if (!id) return;

    if (btnView) {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*, clientes(nome), usuarios(nome)')
        .eq('id', id)
        .single();

      if (error || !data) {
        alert('Erro ao carregar atendimento para visualizar: ' + (error?.message || ''));
        return;
      }

      document.getElementById('atend-cliente').value = data.cliente_id || '';
      document.getElementById('atend-titulo').value = data.titulo || '';
      document.getElementById('atend-canal').value = data.canal || 'WhatsApp';
      document.getElementById('atend-duracao').value = data.duracao || '';
      document.getElementById('atend-anotacoes').value = data.anotacoes || '';

      if (data.data) {
        const dt = new Date(data.data);
        document.getElementById('atend-data').value = dt.toLocaleDateString('pt-BR', {
          timeZone: 'America/Fortaleza'
        }).split('/').reverse().join('-');
        document.getElementById('atend-hora').value = dt.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Fortaleza',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }

      Array.from(view.form.querySelectorAll('input, select, textarea')).forEach(el => (el.disabled = true));
      view.form.classList.add('mode-view');

      const submitBtn = view.form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.style.display = 'none';

      const atendIdEl = document.getElementById('atend-id');
      if (atendIdEl) atendIdEl.value = '';

      const headerEl = view.modal.querySelector('.modal-header h2');
      const clienteSelectEl = document.getElementById('atend-cliente');
      const clienteNome = clienteSelectEl?.options?.[clienteSelectEl.selectedIndex]?.text;
      if (headerEl) {
        headerEl.textContent = clienteNome && clienteNome !== 'Selecione o cliente...'
          ? clienteNome
          : 'Detalhes do Atendimento';
        headerEl.title = clienteNome || '';
      }

      view.modal.style.display = 'flex';
      return;
    }

    if (btnEdit) {
      const role = AuthAPI.getRole();
      const canEdit = ['ADMIN', 'ADVOGADO', 'ADVOGADA'].includes(role);
      if (!canEdit) {
        view.showToast('warning', 'Permissão negada', 'Você não tem permissão para editar atendimentos.');
        return;
      }
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*, clientes(nome), usuarios(nome)')
        .eq('id', id)
        .single();

      if (error || !data) {
        alert('Erro ao carregar atendimento para editar: ' + (error?.message || ''));
        return;
      }

      document.getElementById('atend-cliente').value = data.cliente_id || '';
      document.getElementById('atend-titulo').value = data.titulo || '';
      document.getElementById('atend-canal').value = data.canal || 'WhatsApp';
      document.getElementById('atend-duracao').value = data.duracao || '';
      document.getElementById('atend-anotacoes').value = data.anotacoes || '';

      if (data.data) {
        const dt = new Date(data.data);
        document.getElementById('atend-data').value = dt.toLocaleDateString('pt-BR', {
          timeZone: 'America/Fortaleza'
        }).split('/').reverse().join('-');
        document.getElementById('atend-hora').value = dt.toLocaleTimeString('pt-BR', {
          timeZone: 'America/Fortaleza',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      }

      Array.from(view.form.querySelectorAll('input, select, textarea')).forEach(el => (el.disabled = false));
      view.form.classList.remove('mode-view');

      const submitBtn = view.form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.style.display = 'block';

      const headerEl = view.modal.querySelector('.modal-header h2');
      if (headerEl) headerEl.textContent = 'Editar Atendimento';

      let atendIdEl = document.getElementById('atend-id');
      if (!atendIdEl) {
        atendIdEl = document.createElement('input');
        atendIdEl.type = 'hidden';
        atendIdEl.id = 'atend-id';
        atendIdEl.value = '';
        view.form.insertBefore(atendIdEl, view.form.firstChild);
      }
      atendIdEl.value = id;

      view.modal.style.display = 'flex';
      return;
    }

    if (btnDelete) {
      const role = AuthAPI.getRole();
      const canEdit = ['ADMIN', 'ADVOGADO', 'ADVOGADA'].includes(role);
      if (!canEdit) {
        view.showToast('warning', 'Permissão negada', 'Você não tem permissão para excluir atendimentos.');
        return;
      }

      const { confirmarExclusao } = await import('./utils.js');
      const ok = await confirmarExclusao({
        title: 'Excluir atendimento?',
        message: 'Tem certeza que deseja excluir este atendimento? Esta ação não pode ser desfeita.',
        confirmText: 'Sim, excluir',
        cancelText: 'Cancelar',
        danger: true
      });
      if (!ok) return;


      const { error } = await supabase
        .from('atendimentos')
        .delete()
        .eq('id', btnDelete.dataset.id);

      if (error) {
        const msg = error.message || 'Erro ao excluir';
        view.showToast('error', 'Erro ao excluir', msg);
        return;
      }

      controller.carregar();
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  controller.init();
});


