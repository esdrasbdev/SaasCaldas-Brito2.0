/*
 * Módulo Agenda - Arquitetura MVC
 * Lista unificada de Audiências e Perícias em formato de tabela
 */

import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js';

// ==========================================
// 1. MODEL
// ==========================================
const AgendaModel = {
  async listarTudo() {
    // Busca Atendimentos
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');
    
    const { data: usuarioDB } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', user.email)
      .single();
    
    const { data, error } = await supabase
      .from('atendimentos')
      .select('*, clientes(nome)')
      .eq('usuario_id', usuarioDB.id)
      .order('data', { ascending: true });

    if (error) throw error;

    const lista = [];
    if (data) {
      data.forEach(r => {
        lista.push({
          id: r.id,
          tipo: 'REUNIAO',
          data: r.data,
          titulo: r.titulo || 'Reunião com Cliente',
          local: r.canal || 'Escritório / Online',
          processo: '-',
          cliente: r.clientes?.nome || 'Avulso',
          obs: r.anotacoes
        });
      });
    }

    return lista.sort((a, b) => new Date(a.data) - new Date(b.data));
  },

  async criar(dados) {
    // Converte string vazia para null (evita erro de UUID inválido no Supabase)
    const sanitizeUUID = (val) => (val && val.trim() !== '') ? val : null;

    // A agenda agora gerencia exclusivamente Atendimentos (Reuniões)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    // Busca ID do usuário na tabela pública
    const { data: uData } = await supabase.from('usuarios').select('id').eq('email', user.email).single();
    
    // Constrói a anotação com os participantes
    const nomesClientes = dados.participantes.clientes.map(c => c.nome).join(', ');
    const nomesUsuarios = dados.participantes.usuarios.map(u => u.nome).join(', ');
    let participantesStr = [nomesClientes, nomesUsuarios].filter(Boolean).join(' e ');
    if (!participantesStr) participantesStr = 'N/A';

    const payload = { 
      titulo: dados.titulo || 'Reunião',
      data: dados.data, 
      cliente_id: sanitizeUUID(dados.cliente_id),
      usuario_id: uData?.id || null,
      canal: dados.local || 'Escritório', // Mapeia local para canal de atendimento
      anotacoes: `[Agendamento] Participantes: ${participantesStr}. Obs: ${dados.obs || ''}`
    };

    const { error } = await supabase.from('atendimentos').insert([payload]);
    if (error) throw error;
    return true;
  },

  async deletar(id, tipo) {
    const tabela = tipo === 'AUDIENCIA' ? 'audiencias' : (tipo === 'PERICIA' ? 'pericias' : 'atendimentos');
    const { error } = await supabase
      .from(tabela)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

// ==========================================
// 2. VIEW
// ==========================================
const AgendaView = {
  container: document.getElementById('view-agenda-container'),
  modal: document.getElementById('modal-container'),
  form: document.getElementById('form-agenda'),
  btnNovo: document.getElementById('btn-novo-evento'),
  btnCancelar: document.getElementById('btn-cancelar'),
  selectProcessos: document.getElementById('agenda-processo'),
  selectTipo: document.getElementById('agenda-tipo'),
  blocoVinculos: document.getElementById('bloco-vinculos'),
  blocoParticipantes: document.getElementById('bloco-participantes'),
  listClientesMulti: document.getElementById('agenda-clientes-list'),
  listUsuariosMulti: document.getElementById('agenda-usuarios-list'),
  selectClienteSingle: document.getElementById('agenda-cliente-single'),

  init() {
    this.container.innerHTML = `
      <div class="card-section">
        <div class="table-responsive">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Evento / Detalhes</th>
                <th>Local / Participantes</th>
                <th>Status</th>
                <th style="text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody id="lista-agenda-body">
              <tr><td colspan="5" class="text-center">Carregando agenda...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // Injeta estilos para a lista de checkboxes
    const style = document.createElement('style');
    style.textContent = `
      .checkbox-list-container {
        border: 1px solid var(--cinza-borda);
        border-radius: 8px;
        padding: 8px;
        height: 150px;
        overflow-y: auto;
        background: #f8fafc;
      }
      .checkbox-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid #eee;
      }
      .checkbox-item:last-child { border-bottom: none; }
      .checkbox-item input { width: auto; margin: 0; }
      .checkbox-item label { margin: 0; font-weight: normal; font-size: 0.9rem; cursor: pointer; }
    `;
    document.head.appendChild(style);
  },

  renderizarTabela(eventos) {
    const tbody = document.getElementById('lista-agenda-body');
    const isAdmin = AuthAPI.getRole() === 'ADMIN';
    const isAdvogado = ['ADMIN', 'ADVOGADO'].includes(AuthAPI.getRole());

    if (!eventos || eventos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:40px;">Nenhum agendamento futuro encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = eventos.map(evt => `
      <tr>
        <td style="width: 140px;">
          <strong>${new Date(evt.data).toLocaleDateString('pt-BR')}</strong><br>
          <span class="text-muted">${new Date(evt.data).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
        </td>
        <td>
          <div style="font-weight:600; color: var(--azul-escuro)">${evt.titulo}</div>
          <small class="text-muted">${evt.processo !== 'S/N' && evt.processo !== '-' ? 'Proc: ' + evt.processo : (evt.cliente !== '-' ? 'Cliente: ' + evt.cliente : '')}</small>
        </td>
        <td>
          <div>${evt.local || '-'}</div>
          <small class="text-muted" title="${evt.obs || ''}" style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;">${evt.obs || ''}</small>
        </td>
        <td>
          <span class="status-badge icon-green">REUNIÃO</span>
        </td>
        <td style="text-align: right;">
          <button class="btn-sm btn-view" data-id="${evt.id}" data-tipo="${evt.tipo}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
          ${isAdvogado ? `<button class="btn-sm btn-edit" data-id="${evt.id}" data-tipo="${evt.tipo}" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
          ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${evt.id}" data-tipo="${evt.tipo}" style="color: #ef4444;" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : ''}
        </td>
      </tr>
    `).join('');
  },

  popularSelectProcessos(processos) {
    this.selectProcessos.innerHTML = '<option value="">(Opcional) Selecione...</option>' + 
      processos.map(p => `<option value="${p.id}">CNJ: ${p.numero_cnj} - ${p.clientes?.nome}</option>`).join('');
  },

  popularSelectClientes(clientes) {
    // Popula a lista de checkboxes (Multi)
    this.listClientesMulti.innerHTML = clientes.map(c => `
      <div class="checkbox-item">
        <input type="checkbox" id="cli-${c.id}" value="${c.id}" data-nome="${c.nome}">
        <label for="cli-${c.id}">${c.nome}</label>
      </div>
    `).join('');

    // Popula o select simples
    this.selectClienteSingle.innerHTML = '<option value="">(Opcional) Selecione...</option>' + 
      clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  },
  
  popularSelectUsuarios(usuarios) {
    this.listUsuariosMulti.innerHTML = usuarios.map(u => `
      <div class="checkbox-item">
        <input type="checkbox" id="user-${u.id}" value="${u.id}" data-nome="${u.nome.split(' ')[0]}">
        <label for="user-${u.id}">${u.nome} (${u.role})</label>
      </div>
    `).join('');
  },

  // Alterna a visibilidade dos campos do formulário
  toggleForm() {
    const modalBody = this.form.querySelector('.modal-body');
    
    // Garante que o campo de Título exista no modal
    if (modalBody && !document.getElementById('agenda-titulo')) {
      const tituloHtml = `
        <div class="form-group" id="group-titulo">
          <label for="agenda-titulo">Assunto / Título da Reunião *</label>
          <input type="text" id="agenda-titulo" placeholder="Ex: Reunião Inicial ou Fechamento de Contrato" required>
        </div>
      `;
      modalBody.insertAdjacentHTML('afterbegin', tituloHtml);
    }

    this.blocoVinculos.style.display = 'none';
    this.blocoParticipantes.style.display = 'block';
    
    if (this.selectTipo) {
      this.selectTipo.value = 'reuniao';
      this.selectTipo.parentElement.style.display = 'none'; // Esconde o seletor de tipo
    }

    // Ajusta o label do campo "extra" para algo mais intuitivo em reuniões
    const labelExtra = document.querySelector('label[for="agenda-extra"]');
    if (labelExtra) labelExtra.textContent = 'Link da Reunião (se online)';
    const inputExtra = document.getElementById('agenda-extra');
    if (inputExtra) inputExtra.placeholder = 'https://zoom.us/j/...';
  },

  abrirModal(dados = null, visualizacao = false) {
    this.form.reset(); // Limpa o formulário
    document.getElementById('modal-titulo').textContent = visualizacao ? 'Detalhes do Agendamento' : (dados ? 'Editar Agendamento' : 'Novo Agendamento'); // Define o título
    
    // Reseta estado dos inputs
    const inputs = this.form.querySelectorAll('input, select, textarea');
    inputs.forEach(el => el.disabled = visualizacao);

    // Aplica/remove a classe mode-view para estilização de leitura
    if (visualizacao) {
      this.form.classList.add('mode-view');
    } else {
      this.form.classList.remove('mode-view');
    }
    
    // Botão Salvar
    const btnSalvar = this.form.querySelector('button[type="submit"]');
    if (btnSalvar) btnSalvar.style.display = visualizacao ? 'none' : 'block';

    this.modal.style.display = 'flex';
    
    if (document.getElementById('agenda-titulo')) document.getElementById('agenda-titulo').value = dados?.titulo || '';

    if (dados) {
        // Lógica de preenchimento virá no controller
    }
  }
};

// ==========================================
// 3. CONTROLLER
// ==========================================
const AgendaController = {
  async init() {
    AgendaView.init();
    
    AgendaView.btnNovo.onclick = () => {
      AgendaView.toggleForm();
      AgendaView.abrirModal();
    };
    AgendaView.btnCancelar.onclick = () => AgendaView.modal.style.display = 'none';
    
    AgendaView.form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const dataInput = document.getElementById('agenda-data').value;
        const horaInput = document.getElementById('agenda-hora').value;

        if (!dataInput || !horaInput) return showToast('Por favor, selecione a data e hora.', 'warning');

        // Combina data e hora no formato ISO
        const dataIso = new Date(`${dataInput}T${horaInput}`).toISOString();

        if (!document.getElementById('agenda-titulo').value) return showToast('O título da reunião é obrigatório.', 'warning');

        const dados = {
          tipo: 'reuniao',
          data: dataIso,
          titulo: document.getElementById('agenda-titulo').value,
          local: document.getElementById('agenda-local').value,
          extra: document.getElementById('agenda-extra').value,
          obs: document.getElementById('agenda-obs').value
        };

        // Coleta marcados na lista de clientes
        const clientesChecks = document.querySelectorAll('#agenda-clientes-list input[type="checkbox"]:checked');
        const clientesSelecionados = Array.from(clientesChecks);
        
        // Coleta marcados na lista de usuários
        const usuariosChecks = document.querySelectorAll('#agenda-usuarios-list input[type="checkbox"]:checked');
        const usuariosSelecionados = Array.from(usuariosChecks);

        dados.participantes = {
          clientes: clientesSelecionados.map(opt => ({ id: opt.value, nome: opt.dataset.nome })),
          usuarios: usuariosSelecionados.map(opt => ({ id: opt.value, nome: opt.dataset.nome }))
        };
        dados.cliente_id = clientesSelecionados.length > 0 ? clientesSelecionados[0].value : null;

        await AgendaModel.criar(dados);
        AgendaView.modal.style.display = 'none';
        AgendaView.form.reset();
        this.carregar();
      } catch(err) { showToast(err.message, 'error'); }
    };

    await this.carregar();
    
    // Carrega processos para o select
    const { data: processos } = await supabase.from('processos').select('id, numero_cnj, clientes(nome)').order('criado_em', {ascending: false});
    if(processos) AgendaView.popularSelectProcessos(processos);
    
    // Carrega clientes para o select
    const { data: clientes } = await supabase.from('clientes').select('id, nome').order('nome', {ascending: true});
    if(clientes) AgendaView.popularSelectClientes(clientes);

    // Carrega usuários para o select
    const { data: usuarios } = await supabase.from('usuarios').select('id, nome, role').order('nome', {ascending: true});
    if(usuarios) AgendaView.popularSelectUsuarios(usuarios);

    // Delegação de eventos para ações (Visualizar, Editar, Excluir)
    AgendaView.container.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-delete');
      const btnView = e.target.closest('.btn-view');
      const btnEdit = e.target.closest('.btn-edit');

      if (btn && confirm('Tem certeza que deseja excluir este agendamento?')) {
        try {
          await AgendaModel.deletar(btn.dataset.id, btn.dataset.tipo);
          this.carregar();
        } catch (err) { showToast('Erro ao excluir: ' + err.message, 'error'); }
      }

      if (btnView || btnEdit) {
        const btnAlvo = btnView || btnEdit;
        const id = btnAlvo.dataset.id;
        const tipo = btnAlvo.dataset.tipo;
        const visualizacao = !!btnView;

        // Busca dados completos para preencher o modal
        // Obs: Como o listarTudo já traz quase tudo normalizado, podemos buscar lá ou fazer query específica.
        // Para simplificar e garantir dados frescos, faremos uma query rápida baseada no tipo.
        let data;
        const { data: d } = await supabase.from('atendimentos').select('*').eq('id', id).single();
        data = d;

        if (data) {
            AgendaView.abrirModal(data, visualizacao);
            
            AgendaView.toggleForm();

            // Ajusta data para formato datetime-local
            const dateObj = new Date(data.data);
            const localDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            document.getElementById('agenda-data').value = localDate;
            
            if (document.getElementById('agenda-titulo')) document.getElementById('agenda-titulo').value = data.titulo || '';
            document.getElementById('agenda-local').value = data.local || ''; // Atendimentos podem não ter local na raiz, ajustar se necessário
            document.getElementById('agenda-extra').value = data.perito || ''; // Pericias
            document.getElementById('agenda-obs').value = data.anotacoes || ''; // Reuniões usam 'anotacoes'
            
            // Vínculos
            if (data.processo_id) document.getElementById('agenda-processo').value = data.processo_id;
            if (data.cliente_id) document.getElementById('agenda-cliente-single').value = data.cliente_id;

            // Desabilita checkboxes em modo visualização
            const checkboxes = AgendaView.listClientesMulti.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.disabled = visualizacao);
            const userCheckboxes = AgendaView.listUsuariosMulti.querySelectorAll('input[type="checkbox"]');
            userCheckboxes.forEach(cb => cb.disabled = visualizacao);
        }
      }
    });
  },

  async carregar() {
    const dados = await AgendaModel.listarTudo();
    AgendaView.renderizarTabela(dados);
  }
};

document.addEventListener('DOMContentLoaded', () => AgendaController.init());
