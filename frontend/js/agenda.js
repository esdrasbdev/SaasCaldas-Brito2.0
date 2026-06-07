/*
 * Módulo Agenda - Arquitetura MVC
 * Lista unificada de Audiências e Perícias em formato de tabela
 */

import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast, formatarHora24h } from './utils.js';


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
    if (data && data.length > 0) {
      const ids = data.map(r => r.id);

      // Tenta buscar participantes atrelados a esses atendimentos (se a tabela existir)
      let participacoes = [];
      try {
        const resp = await supabase.from('participantes_atendimento').select('*').in('atendimento_id', ids);
        if (resp.data) participacoes = resp.data;
      } catch (err) {
        console.warn('Não foi possível carregar participantes_atendimento:', err.message || err);
      }

      // Agrupa participantes por atendimento
      const mapPart = {};
      participacoes.forEach(p => {
        if (!mapPart[p.atendimento_id]) mapPart[p.atendimento_id] = { clientes: [], usuarios: [] };
        if (p.tipo === 'cliente') mapPart[p.atendimento_id].clientes.push({ id: p.participante_id, nome: p.nome });
        else mapPart[p.atendimento_id].usuarios.push({ id: p.participante_id, nome: p.nome });
      });

      data.forEach(r => {
        let anotObj = {};
        try { if (r.anotacoes) anotObj = JSON.parse(r.anotacoes); } catch(e) { anotObj = {}; }

        lista.push({
          id: r.id,
          tipo: 'REUNIAO',
          data: r.data,
          titulo: anotObj.titulo || 'Reunião com Cliente',
          local: anotObj.extra || 'Escritório / Online',
          processo: '-',
          cliente: r.clientes?.nome || 'Avulso',
          obs: anotObj.obs || '',
          participantes: mapPart[r.id] || { clientes: [], usuarios: [] }
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
    if (!uData) throw new Error('Usuário não encontrado no banco de dados');
    
    // Constrói a anotação com os participantes
    const nomesClientes = dados.participantes.clientes.map(c => c.nome).join(', ');
    const nomesUsuarios = dados.participantes.usuarios.map(u => u.nome).join(', ');
    let participantesStr = [nomesClientes, nomesUsuarios].filter(Boolean).join(' e ');
    if (!participantesStr) participantesStr = 'Sem participantes selecionados';

    // Monta a data e hora corretamente (sem conversão errada de timezone)
    const dataFormatada = `${dados.data} ${dados.hora}`;
    const dataObj = new Date(dataFormatada);
    
    if (isNaN(dataObj.getTime())) {
      throw new Error('Data ou hora inválida');
    }

    // Como a tabela `atendimentos` só tem: cliente_id, usuario_id, data, anotacoes
    // Serializamos título/extra/obs dentro de `anotacoes` para preservar os campos
    const anot = {
      titulo: dados.titulo || 'Reunião',
      extra: dados.extra || null,
      obs: dados.obs || null
    };

    const payload = {
      data: dataObj.toISOString(),
      cliente_id: sanitizeUUID(dados.cliente_id),
      usuario_id: uData.id,
      anotacoes: JSON.stringify(anot)
    };

    const { data: inserted, error } = await supabase.from('atendimentos').insert([payload]).select().single();
    if (error) throw error;
    
    // Se houver participantes, salva a relação em uma tabela de participantes (se existir)
    // Caso contrário, os dados estão salvos nas anotações
    if (inserted && (dados.participantes.clientes.length > 0 || dados.participantes.usuarios.length > 0)) {
      // Salva os participantes para referência futura
      const participantes = [];
      
      dados.participantes.clientes.forEach(c => {
        participantes.push({
          atendimento_id: inserted.id,
          tipo: 'cliente',
          participante_id: c.id,
          nome: c.nome
        });
      });
      
      dados.participantes.usuarios.forEach(u => {
        participantes.push({
          atendimento_id: inserted.id,
          tipo: 'usuario',
          participante_id: u.id,
          nome: u.nome
        });
      });

      // Tenta salvar na tabela de participantes se existir
      if (participantes.length > 0) {
        const { error: errPart } = await supabase.from('participantes_atendimento').insert(participantes).select();
        // Não falha se a tabela não existir, apenas continua
        if (errPart) console.warn('Aviso ao salvar participantes:', errPart.message);
      }
    }
    
    return true;
  },

  async atualizar(id, dados) {
    // Constrói a data corretamente (mantém comportamento já testado em criar)
    const dataFormatada = `${dados.data} ${dados.hora}`;
    const dataObj = new Date(dataFormatada);
    if (isNaN(dataObj.getTime())) throw new Error('Data ou hora inválida');

    // Serializa título/extra/obs dentro de `anotacoes`
    const anot = {
      titulo: dados.titulo || 'Reunião',
      extra: dados.extra || null,
      obs: dados.obs || null
    };

    const sanitizeUUID = (val) => (val && val.trim() !== '') ? val : null;

    // Atualiza o atendimento
    const payload = {
      data: dataObj.toISOString(),
      cliente_id: sanitizeUUID(dados.cliente_id),
      usuario_id: dados.usuario_id, // passa o usuario_id vindo do controller
      anotacoes: JSON.stringify(anot)
    };

    const { error } = await supabase
      .from('atendimentos')
      .update(payload)
      .eq('id', id);
    if (error) throw error;

    // Recria participantes (se a tabela existir)
    try {
      // Remove antigos
      const { error: errDel } = await supabase
        .from('participantes_atendimento')
        .delete()
        .eq('atendimento_id', id);
      if (errDel) throw errDel;

      // Insere novos
      const participantes = [];
      dados.participantes.clientes.forEach(c => {
        participantes.push({
          atendimento_id: id,
          tipo: 'cliente',
          participante_id: c.id,
          nome: c.nome
        });
      });
      dados.participantes.usuarios.forEach(u => {
        participantes.push({
          atendimento_id: id,
          tipo: 'usuario',
          participante_id: u.id,
          nome: u.nome
        });
      });

      if (participantes.length > 0) {
        const { error: errIns } = await supabase
          .from('participantes_atendimento')
          .insert(participantes);
        if (errIns) throw errIns;
      }
    } catch (errPart) {
      // Não impede o update do atendimento se a tabela não existir
      console.warn('Aviso ao atualizar participantes:', errPart.message || errPart);
    }

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
  selectClienteSingle: document.getElementById('agenda-cliente-single'),
  blocoParticipantes: document.getElementById('bloco-participantes'),
  
  // Busca de clientes
  inputClientesSearch: document.getElementById('agenda-clientes-search'),
  dropdownClientes: document.getElementById('agenda-clientes-dropdown'),
  tagsClientes: document.getElementById('agenda-clientes-tags'),
  
  // Busca de usuários
  inputUsuariosSearch: document.getElementById('agenda-usuarios-search'),
  dropdownUsuarios: document.getElementById('agenda-usuarios-dropdown'),
  tagsUsuarios: document.getElementById('agenda-usuarios-tags'),

  // Dados internos
  clientesList: [],
  usuariosList: [],
  clientesSelecionados: [],
  usuariosSelecionados: [],
  editId: null,
  _usuarioId: null,

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
  },

  renderizarTabela(eventos) {
    const tbody = document.getElementById('lista-agenda-body');
    const isAdmin = AuthAPI.getRole() === 'ADMIN';
    const isAdvogado = ['ADMIN', 'ADVOGADO'].includes(AuthAPI.getRole());

    if (!eventos || eventos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding:0;">
            <div style="min-height:220px; display:flex; align-items:center; justify-content:center; text-align:center; color: var(--cinza-texto, #6b7280);">
              Nenhum agendamento futuro encontrado.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    // Observação: hora em 24h (sem AM/PM) via utils.js


    tbody.innerHTML = eventos.map(evt => {
      const dataStr = `<strong>${new Date(evt.data).toLocaleDateString('pt-BR')}</strong><br><span class="text-muted">${formatarHora24h(evt.data)}</span>`;




      const tituloStr = `<div style="font-weight:600; color: var(--azul-escuro)">${evt.titulo}</div><small class="text-muted">${evt.processo !== 'S/N' && evt.processo !== '-' ? 'Proc: ' + evt.processo : (evt.cliente !== '-' ? 'Cliente: ' + evt.cliente : '')}</small>`;

      const clientesChips = (evt.participantes?.clientes || []).map(c => `<span style="display:inline-block; background:#f1f5f9; color:#0f172a; padding:4px 8px; border-radius:12px; margin:2px; font-size:0.8rem; border:1px solid #e2e8f0;"><i class=\"fa-solid fa-user\" style=\"margin-right:6px;color:#475569;font-size:0.8rem;\"></i>${c.nome}</span>`).join('');
      const usuariosChips = (evt.participantes?.usuarios || []).map(u => `<span style="display:inline-block; background:#eef2ff; color:#0b4a6f; padding:4px 8px; border-radius:12px; margin:2px; font-size:0.8rem; border:1px solid #c7d2fe;"><i class=\"fa-solid fa-user-tie\" style=\"margin-right:6px;color:#334155;font-size:0.8rem;\"></i>${u.nome.split(' ')[0]}</span>`).join('');

      const participantesHtml = (clientesChips || usuariosChips) ? `<div style="margin-top:6px;">${clientesChips} ${usuariosChips}</div>` : '';

      const localStr = `<div>${evt.local || '-'}</div>${participantesHtml}`;

      return `
      <tr>
        <td style="width: 140px;">${dataStr}</td>
        <td>${tituloStr}</td>
        <td>${localStr}</td>
        <td><span class="status-badge icon-green">REUNIÃO</span></td>
        <td style="text-align: right;">
          <button class="btn-sm btn-view" data-id="${evt.id}" data-tipo="${evt.tipo}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
          ${isAdvogado ? `<button class="btn-sm btn-edit" data-id="${evt.id}" data-tipo="${evt.tipo}" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
          ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${evt.id}" data-tipo="${evt.tipo}" style="color: #ef4444;" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : ''}
        </td>
      </tr>
      `;
    }).join('');
  },

  popularSelectProcessos(processos) {
    this.selectProcessos.innerHTML = '<option value="">(Opcional) Selecione...</option>' + 
      processos.map(p => `<option value="${p.id}">CNJ: ${p.numero_cnj} - ${p.clientes?.nome}</option>`).join('');
  },

  popularSelectClientes(clientes) {
    this.clientesList = clientes;
    
    // Popula o select simples
    this.selectClienteSingle.innerHTML = '<option value="">(Opcional) Selecione...</option>' + 
      clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  },
  
  popularSelectUsuarios(usuarios) {
    this.usuariosList = usuarios;
  },

  // Configura os eventos de busca de clientes
  setupSearchClientes() {
    const renderLista = (lista) => {
      if (!lista || lista.length === 0) {
        this.dropdownClientes.innerHTML = '<div style="padding: 12px; text-align: center; color: #999; font-size: 0.9rem;">Nenhum cliente encontrado</div>';
        return;
      }
      this.dropdownClientes.innerHTML = lista.map(c => `
        <div style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0;" 
             data-cliente-id="${c.id}" data-cliente-nome="${c.nome}" class="dropdown-cliente-item">
          <strong>${c.nome}</strong>
        </div>
      `).join('');

      // Adiciona listeners aos itens
      this.dropdownClientes.querySelectorAll('.dropdown-cliente-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.clienteId;
          const nome = item.dataset.clienteNome;
          this.adicionarClienteSelecionado(id, nome);
        });
      });
    };

    const filtrar = (termo) => {
      const t = (termo || '').toLowerCase();
      const disponiveis = this.clientesList.filter(c => !this.clientesSelecionados.some(s => s.id === c.id));
      if (!t) return disponiveis.slice(0, 10);
      return disponiveis.filter(c => c.nome.toLowerCase().includes(t)).slice(0, 20);
    };

    this.inputClientesSearch.addEventListener('input', (e) => {
      const termo = e.target.value;
      const lista = filtrar(termo);
      renderLista(lista);
      this.dropdownClientes.style.display = 'block';
    });

    // Ao focar mostra as primeiras opções
    this.inputClientesSearch.addEventListener('focus', () => {
      const lista = filtrar('');
      renderLista(lista);
      this.dropdownClientes.style.display = 'block';
    });

    // Fecha dropdown ao clicar fora
    document.addEventListener('click', (e) => {
      if (e.target !== this.inputClientesSearch && !this.dropdownClientes.contains(e.target)) {
        this.dropdownClientes.style.display = 'none';
      }
    });
  },

  // Configura os eventos de busca de usuários
  setupSearchUsuarios() {
    const renderListaU = (lista) => {
      if (!lista || lista.length === 0) {
        this.dropdownUsuarios.innerHTML = '<div style="padding: 12px; text-align: center; color: #999; font-size: 0.9rem;">Nenhum membro encontrado</div>';
        return;
      }
      this.dropdownUsuarios.innerHTML = lista.map(u => `
        <div style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #f0f0f0;" 
             data-usuario-id="${u.id}" data-usuario-nome="${u.nome}" class="dropdown-usuario-item">
          <strong>${u.nome}</strong><br>
          <small style="color: #888;">${u.role}</small>
        </div>
      `).join('');

      // Adiciona listeners aos itens
      this.dropdownUsuarios.querySelectorAll('.dropdown-usuario-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.usuarioId;
          const nome = item.dataset.usuarioNome;
          this.adicionarUsuarioSelecionado(id, nome);
        });
      });
    };

    const filtrarU = (termo) => {
      const t = (termo || '').toLowerCase();
      const disponiveis = this.usuariosList.filter(u => !this.usuariosSelecionados.some(s => s.id === u.id));
      if (!t) return disponiveis.slice(0, 10);
      return disponiveis.filter(u => u.nome.toLowerCase().includes(t)).slice(0, 20);
    };

    this.inputUsuariosSearch.addEventListener('input', (e) => {
      const termo = e.target.value;
      const lista = filtrarU(termo);
      renderListaU(lista);
      this.dropdownUsuarios.style.display = 'block';
    });

    // Ao focar mostra as primeiras opções
    this.inputUsuariosSearch.addEventListener('focus', () => {
      const lista = filtrarU('');
      renderListaU(lista);
      this.dropdownUsuarios.style.display = 'block';
    });

    // Fecha dropdown ao clicar fora
    document.addEventListener('click', (e) => {
      if (e.target !== this.inputUsuariosSearch && !this.dropdownUsuarios.contains(e.target)) {
        this.dropdownUsuarios.style.display = 'none';
      }
    });
  },

  // Adiciona cliente aos selecionados
  adicionarClienteSelecionado(id, nome) {
    if (!this.clientesSelecionados.some(c => c.id === id)) {
      this.clientesSelecionados.push({ id, nome });
      this.renderizarTagsClientes();
      this.inputClientesSearch.value = '';
      this.dropdownClientes.style.display = 'none';
    }
  },

  // Remove cliente dos selecionados
  removerClienteSelecionado(id) {
    this.clientesSelecionados = this.clientesSelecionados.filter(c => c.id !== id);
    this.renderizarTagsClientes();
  },

  // Adiciona usuário aos selecionados
  adicionarUsuarioSelecionado(id, nome) {
    if (!this.usuariosSelecionados.some(u => u.id === id)) {
      this.usuariosSelecionados.push({ id, nome });
      this.renderizarTagsUsuarios();
      this.inputUsuariosSearch.value = '';
      this.dropdownUsuarios.style.display = 'none';
    }
  },

  // Remove usuário dos selecionados
  removerUsuarioSelecionado(id) {
    this.usuariosSelecionados = this.usuariosSelecionados.filter(u => u.id !== id);
    this.renderizarTagsUsuarios();
  },

  // Renderiza as tags de clientes selecionados
  renderizarTagsClientes() {
    this.tagsClientes.innerHTML = this.clientesSelecionados.map(c => `
      <span style="background: #f1f5f9; color: #0f172a; padding: 6px 10px; border-radius: 16px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #e2e8f0;" data-tag-id="${c.id}" class="tag-cliente">
        <i class="fa-solid fa-user" style="color:#475569; font-size:0.85rem; margin-right:6px;"></i>
        <span style="line-height:1;">${c.nome}</span>
        <i class="fa-solid fa-times" style="cursor: pointer; font-size: 0.8rem; color:#64748b;" title="Remover"></i>
      </span>
    `).join('');

    // Adiciona listeners para remover
    this.tagsClientes.querySelectorAll('.tag-cliente').forEach(tag => {
      const btn = tag.querySelector('i.fa-times');
      if (btn) btn.addEventListener('click', () => {
        const id = tag.dataset.tagId;
        this.removerClienteSelecionado(id);
      });
    });
  },

  // Renderiza as tags de usuários selecionados
  renderizarTagsUsuarios() {
    this.tagsUsuarios.innerHTML = this.usuariosSelecionados.map(u => `
      <span style="background: #eef2ff; color: #0b4a6f; padding: 6px 10px; border-radius: 16px; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px; border: 1px solid #c7d2fe;" data-tag-id="${u.id}" class="tag-usuario">
        <i class="fa-solid fa-user-tie" style="color:#334155; font-size:0.85rem; margin-right:6px;"></i>
        <span style="line-height:1;">${u.nome.split(' ')[0]}</span>
        <i class="fa-solid fa-times" style="cursor: pointer; font-size: 0.8rem; color:#64748b;" title="Remover"></i>
      </span>
    `).join('');

    // Adiciona listeners para remover
    this.tagsUsuarios.querySelectorAll('.tag-usuario').forEach(tag => {
      const btn = tag.querySelector('i.fa-times');
      if (btn) btn.addEventListener('click', () => {
        const id = tag.dataset.tagId;
        this.removerUsuarioSelecionado(id);
      });
    });
  },

  // Abre o modal de agendamento
  abrirModal(dados = null, visualizacao = false) {
    this.form.reset(); // Limpa o formulário
    
    // Reseta seleção de participantes
    this.clientesSelecionados = [];
    this.usuariosSelecionados = [];
    this.renderizarTagsClientes();
    this.renderizarTagsUsuarios();

    // Se for abrir como novo, limpa modo edição
    if (!dados && !visualizacao) {
      this.editId = null;
      this._usuarioId = null;
    }
    
    document.getElementById('modal-titulo').textContent = visualizacao ? 'Detalhes do Agendamento' : (dados ? 'Editar Agendamento' : 'Novo Agendamento');
    
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

    if (dados) {
        // Lógica de preenchimento no controller
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
      AgendaView.editId = null;
      AgendaView.abrirModal();
    };
    AgendaView.btnCancelar.onclick = () => AgendaView.modal.style.display = 'none';
    
    AgendaView.form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        // Coleta valores dos campos
        const dataInput = document.getElementById('agenda-data')?.value;
        const horaInput = document.getElementById('agenda-hora')?.value;
        const tituloInput = document.getElementById('agenda-titulo')?.value;
        const localInput = document.getElementById('agenda-local')?.value;

        // Validações
        if (!dataInput) return showToast('Por favor, selecione a data.', 'warning');
        if (!horaInput) return showToast('Por favor, selecione a hora.', 'warning');
        if (!tituloInput) return showToast('O título da reunião é obrigatório.', 'warning');
        // Local é opcional (removida obrigatoriedade)


        // Monta o objeto de dados
        const dados = {
          tipo: 'reuniao',
          data: dataInput, // Data em formato YYYY-MM-DD
          hora: horaInput, // Hora em formato HH:mm
          titulo: tituloInput,
          local: localInput,
          extra: document.getElementById('agenda-extra')?.value || '',
          obs: document.getElementById('agenda-obs')?.value || '',
          participantes: {
            clientes: AgendaView.clientesSelecionados,
            usuarios: AgendaView.usuariosSelecionados
          },
          cliente_id: document.getElementById('agenda-cliente-single')?.value || null,
          usuario_id: AgendaView._usuarioId || null,
        };

        // Salva/atualiza o agendamento (evita duplicar ao editar)
        if (AgendaView.editId) {
          await AgendaModel.atualizar(AgendaView.editId, dados);
        } else {
          await AgendaModel.criar(dados);
        }

        
        // Limpa e fecha
        AgendaView.modal.style.display = 'none';
        AgendaView.form.reset();
        
        // Recarrega a lista
        await this.carregar();
        showToast('Agendamento salvo com sucesso!', 'success');
      } catch(err) { 
        console.error('Erro ao salvar agendamento:', err);
        const msg = err?.message || (err?.error && err.error.message) || JSON.stringify(err);
        showToast(msg || 'Erro ao salvar agendamento', 'error'); 
      }
    };

    await this.carregar();
    
    // Carrega processos para o select
    try {
      const { data: processos, error: errP } = await supabase.from('processos').select('id, numero_cnj, clientes(nome)').order('criado_em', {ascending: false});
      if (errP) console.warn('Erro ao carregar processos:', errP.message || errP);
      if(processos) AgendaView.popularSelectProcessos(processos);
    } catch (err) { console.warn('Exceção carregar processos:', err); }

    // Carrega clientes para o select
    try {
      const { data: clientes, error: errC } = await supabase.from('clientes').select('id, nome').order('nome', {ascending: true});
      if (errC) console.warn('Erro ao carregar clientes:', errC.message || errC);
      if (clientes) {
        AgendaView.popularSelectClientes(clientes);
        console.debug('Clientes carregados:', clientes.length);
      }
    } catch (err) { console.warn('Exceção carregar clientes:', err); }

    // Carrega usuários para o select
    try {
      const { data: usuarios, error: errU } = await supabase.from('usuarios').select('id, nome, role').order('nome', {ascending: true});
      if (errU) console.warn('Erro ao carregar usuários:', errU.message || errU);
      if (usuarios) {
        AgendaView.popularSelectUsuarios(usuarios);
        console.debug('Usuários carregados:', usuarios.length);
      }
    } catch (err) { console.warn('Exceção carregar usuários:', err); }

    // Configura buscas de participantes
    AgendaView.setupSearchClientes();
    AgendaView.setupSearchUsuarios();

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
            const editando = !visualizacao && !!btnEdit;

        // Busca dados completos para preencher o modal
        let data;
        const { data: d } = await supabase.from('atendimentos').select('*').eq('id', id).single();
        data = d;

        if (data) {
            if (editando) AgendaView.editId = id;
            else AgendaView.editId = null;
            AgendaView.abrirModal(data, visualizacao);



            // Separa data e hora do ISO string
            const dateObj = new Date(data.data);
            const dataFormatada = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            const horaFormatada = dateObj.toISOString().split('T')[1].slice(0, 5); // HH:mm
            
            document.getElementById('agenda-data').value = dataFormatada;
            document.getElementById('agenda-hora').value = horaFormatada;
            
            // Preenche campos a partir de `anotacoes` (armazenamos JSON lá)
            let anotObj = {};
            try { if (data.anotacoes) anotObj = JSON.parse(data.anotacoes); } catch(e) { anotObj = {}; }
            if (document.getElementById('agenda-titulo')) document.getElementById('agenda-titulo').value = anotObj.titulo || '';
            document.getElementById('agenda-local').value = anotObj.extra || '';
            document.getElementById('agenda-extra').value = anotObj.extra || '';
            document.getElementById('agenda-obs').value = anotObj.obs || '';
            
            // Vínculos
            if (data.processo_id) document.getElementById('agenda-processo').value = data.processo_id;
            if (data.cliente_id) document.getElementById('agenda-cliente-single').value = data.cliente_id;
            // Atualiza usuario_id para suportar UPDATE
            AgendaView._usuarioId = data.usuario_id;

            // Carrega participantes específicos deste atendimento e preenche as tags
            try {
              const { data: parts } = await supabase.from('participantes_atendimento').select('*').eq('atendimento_id', id);
              if (parts) {
                AgendaView.clientesSelecionados = parts.filter(p => p.tipo === 'cliente').map(p => ({ id: p.participante_id, nome: p.nome }));
                AgendaView.usuariosSelecionados = parts.filter(p => p.tipo === 'usuario').map(p => ({ id: p.participante_id, nome: p.nome }));
                AgendaView.renderizarTagsClientes();
                AgendaView.renderizarTagsUsuarios();
              }
            } catch (err) {
              console.warn('Erro ao carregar participantes deste atendimento:', err.message || err);
            }

            // Se estiver em modo visualização, oculta os ícones de remoção
            if (visualizacao) {
              document.querySelectorAll('#agenda-clientes-tags i, #agenda-usuarios-tags i').forEach(ic => ic.style.display = 'none');
            } else {
              document.querySelectorAll('#agenda-clientes-tags i, #agenda-usuarios-tags i').forEach(ic => ic.style.display = 'inline-block');
            }
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
