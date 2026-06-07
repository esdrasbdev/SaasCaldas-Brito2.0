/*
 * Módulo Clientes - Arquitetura MVC
 * Separação clara entre Dados (Supabase), Interface (DOM) e Regras de Negócio
 */

import { supabase, getApiUrl } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js'; // Novo sistema de avisos

// ==========================================
// 1. MODEL (Gerencia Dados e Banco)
// ==========================================
const ClienteModel = {
async listarTodos() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async criar(cliente) {
    const { data, error } = await supabase
      .from('clientes')
      .insert([cliente])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async atualizar(id, dados) {
    const { data, error } = await supabase
      .from('clientes')
      .update(dados)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deletar(id) {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  async listarDocumentos(clienteId) {
    // Busca o token atualizado da sessão para evitar erro 401
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${getApiUrl()}/documentos?cliente_id=${clienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
      // evita poluir UI com aviso; 401 pode ocorrer durante carregamentos assíncronos
      return [];
    }


    if (!res.ok) throw new Error('Falha ao buscar documentos');
    return await res.json();
  }
};

// ==========================================
// 2. VIEW (Gerencia o HTML e Exibição)
// ==========================================
const ClienteView = {
  elementos: {
    tabelaContainer: document.getElementById('view-tabela-container'),
    modal: document.getElementById('modal-container'),
    form: document.getElementById('form-cliente'),
    tituloModal: document.getElementById('modal-titulo'),
    btnNovo: document.getElementById('btn-novo-cliente'),
    btnCancelar: document.getElementById('btn-cancelar'),
    inputBusca: null // Criado dinamicamente
  },

  init() {
    // Renderiza estrutura base da tabela com busca
    this.elementos.tabelaContainer.innerHTML = `
      <div class="card-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>Base de Clientes</h2>
          <input type="text" id="busca-cliente" placeholder="Buscar por nome ou CPF..." style="max-width: 300px;">
        </div>
        <div class="table-responsive">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Contato</th>
                <th style="text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody id="lista-clientes-body">
              <tr><td colspan="4" class="text-center">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    this.elementos.inputBusca = document.getElementById('busca-cliente');
  },

  renderizarTabela(clientes) {
    const tbody = document.getElementById('lista-clientes-body');
    const isAdmin = AuthAPI.getRole() === 'ADMIN';
    
    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center" style="padding: 30px; color: var(--cinza-medio);">
            <i class="fa-solid fa-folder-open"></i> Nenhum cliente encontrado.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = clientes.map(c => `
      <tr>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600; color: var(--azul-escuro);">${c.nome}</span>
            <span style="font-size: 0.75rem; color: var(--cinza-medio); margin-top: 2px;">
              ${c.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'} 
              ${c.usuarios?.nome ? `• Criado por <strong>${c.usuarios.nome.split(' ')[0]}</strong>` : ''}
            </span>
          </div>
        </td>
        <td>${c.documento || '-'}</td>
        <td>
          <div><i class="fa-solid fa-envelope" style="font-size: 0.8em;"></i> ${c.email || '-'}</div>
          <div><i class="fa-solid fa-phone" style="font-size: 0.8em;"></i> ${c.telefone || '-'}</div>
        </td>
        <td style="text-align: right;">
          <button class="btn-sm btn-view" data-id="${c.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-sm btn-edit" data-id="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${c.id}" title="Excluir" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
        </td>
      </tr>
    `).join('');
  },

  abrirModal(cliente = null, visualizacao = false) {
    this.elementos.tituloModal.textContent = visualizacao ? 'Visualizar Cliente' : (cliente ? 'Editar Cliente' : 'Novo Cliente');
    this.elementos.form.reset();
    
    // Adiciona classe de estilo visualização ao container do form
    if (visualizacao) {
      this.elementos.form.classList.add('mode-view');
    } else {
      this.elementos.form.classList.remove('mode-view');
    }

    const modalHeader = this.elementos.modal.querySelector('.modal-header');
    const modalBody = this.elementos.modal.querySelector('.modal-body');
    const modalFooter = this.elementos.modal.querySelector('.modal-footer');

    // Formatação do Cabeçalho: Título à esquerda, Botão à direita
    if (modalHeader && !modalHeader.querySelector('.btn-close-modal')) {
      modalHeader.style.display = 'flex';
      modalHeader.style.justifyContent = 'space-between';
      modalHeader.style.alignItems = 'center';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn-close-modal';
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.style.cssText = 'background:none; border:none; color:var(--cinza-medio); cursor:pointer; font-size:1.4rem; padding:5px; transition: color 0.2s;';
      closeBtn.onmouseover = () => closeBtn.style.color = '#ef4444';
      closeBtn.onmouseout = () => closeBtn.style.color = 'var(--cinza-medio)';
      closeBtn.onclick = () => this.fecharModal();
      modalHeader.appendChild(closeBtn);
    }

    // Reseta estado dos inputs
    const inputs = this.elementos.form.querySelectorAll('input, select');
    inputs.forEach(el => {
      el.disabled = visualizacao;
      el.classList.remove('input-error');
    });

    // Posicionamento da seção de documentos: deve ficar no final do modal-body, antes do footer
    let containerDocs = document.getElementById('documentos-lista-container');
    if (!containerDocs) {
      containerDocs = document.createElement('div');
      containerDocs.id = 'documentos-lista-container';
    }

    // Se o modalBody existir, anexamos os documentos nele para que o footer (abaixo dele) fique sempre na base
    if (modalBody) {
      modalBody.appendChild(containerDocs);
    }

    containerDocs.style.marginTop = '20px';
    containerDocs.style.borderTop = '2px solid var(--azul-claro)';

    const btnSalvar = this.elementos.form.querySelector('button[type="submit"]');
    if (btnSalvar) btnSalvar.style.display = visualizacao ? 'none' : 'block';

    document.getElementById('cliente-id').value = '';

    if (cliente) {
      document.getElementById('cliente-id').value = cliente.id;
      document.getElementById('cliente-nome').value = cliente.nome;
      document.getElementById('cliente-tipo').value = cliente.tipo || 'PF';
      document.getElementById('cliente-documento').value = cliente.documento || '';
      document.getElementById('cliente-email').value = cliente.email || '';
      document.getElementById('cliente-telefone').value = cliente.telefone || '';
      // Novos campos
      document.getElementById('cliente-nacionalidade').value = cliente.nacionalidade || '';
      document.getElementById('cliente-estado-civil').value = cliente.estado_civil || '';
      document.getElementById('cliente-profissao').value = cliente.profissao || '';
      document.getElementById('cliente-cep').value = cliente.cep || '';
      document.getElementById('cliente-endereco').value = cliente.endereco || '';
      document.getElementById('cliente-numero').value = cliente.numero || '';
      document.getElementById('cliente-bairro').value = cliente.bairro || '';
      document.getElementById('cliente-cidade').value = cliente.cidade || '';
      document.getElementById('cliente-estado').value = cliente.estado || '';

      // Set advogado selection (garante que o value bate com as options, mesmo se vier number/uuid)
      const advogadoSelect = document.getElementById('cliente-advogado');
      if (advogadoSelect) {
        const advId = cliente.advogado_id ?? '';
        advogadoSelect.value = String(advId);

        // Se o id não existir nas options (ex: advogado não está mais ativo/role), evita ficar em valor inesperado
        const hasOption = Array.from(advogadoSelect.options)
          .some(o => String(o.value) === String(advId));
        if (!hasOption) advogadoSelect.value = '';
      }

      // Previdenciário
      document.getElementById('cliente-inss-senha').value = cliente.inss_senha || '';
      document.getElementById('cliente-inss-cpf').value = cliente.documento || '';

      this.renderizarSessaoDocumentos(cliente.id, visualizacao);
      // Ajuste para garantir que a seção de documentos não quebre o grid dos inputs
      containerDocs.style.order = "99";
    } else {
      document.getElementById('cliente-inss-cpf').value = '';
      // Chama renderização mesmo sem ID para mostrar o cabeçalho e a mensagem de "Salvar Primeiro"
      this.renderizarSessaoDocumentos(null, false);
    }
    this.elementos.modal.style.display = 'flex';
  },

  async renderizarSessaoDocumentos(clienteId, visualizacao) {
    const container = document.getElementById('documentos-lista-container');
    if (!container) return;

    // Se não houver clienteId, estamos criando um novo cliente
    if (!clienteId) {
      container.innerHTML = `
        <div style="padding-top: 15px;">
          <h3 style="font-size: 1rem; color: var(--azul-medio); margin-bottom: 10px; border-bottom: 2px solid var(--azul-claro); padding-bottom: 5px;">
            <i class="fa-solid fa-paperclip"></i> Documentos do Cliente
          </h3>
          <div style="background: var(--azul-claro); color: var(--azul-medio); padding: 15px; border-radius: 8px; text-align: center; font-size: 0.9rem; font-weight: 500;">
            <i class="fa-solid fa-circle-info"></i> Para anexar documentos, primeiro salve os dados básicos do cliente.
          </div>
        </div>`;
      return;
    }

    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--cinza-medio);"><i class="fa-solid fa-spinner fa-spin"></i> Carregando arquivos...</div>';

    try {
      const docs = await ClienteModel.listarDocumentos(clienteId);
      
      let html = `
        <div style="padding-top: 15px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="font-size: 1rem; color: var(--azul-medio); margin-bottom: 0; border-bottom: 2px solid var(--azul-claro); padding-bottom: 5px; flex: 1;">
              <i class="fa-solid fa-paperclip"></i> Documentos do Cliente
            </h3>
            ${!visualizacao ? `<label class="btn-primary" style="cursor: pointer; padding: 8px 16px; border-radius: 6px; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-cloud-arrow-up"></i> Anexar Arquivo
              <input type="file" id="upload-doc-cliente" style="display: none;" data-cliente="${clienteId}">
            </label>` : ''}
          </div>
          <table class="recent-table" style="font-size: 0.85rem; width: 100%; background: #fff; border: 1px solid var(--cinza-borda); border-radius: 8px; overflow: hidden;">
            <thead><tr><th>Arquivo</th><th style="text-align: right;">Ações</th></tr></thead>
            <tbody>
              ${docs.length === 0 ? '<tr><td colspan="2" class="text-center">Nenhum documento.</td></tr>' : 
                docs.map(d => `
                <tr>
                  <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <i class="fa-solid fa-file-pdf" style="margin-right: 8px; color: #ef4444;"></i> ${d.nome}
                  </td>
                  <td style="text-align: right;">
                    <a href="${d.url}" target="_blank" class="btn-sm" title="Ver"><i class="fa-solid fa-eye"></i></a>
                    <a href="${d.url}" download class="btn-sm" title="Baixar"><i class="fa-solid fa-download"></i></a>
                    ${!visualizacao ? `<button class="btn-sm btn-del-doc" data-id="${d.id}" data-cliente="${clienteId}" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = '<p class="text-danger">Erro ao carregar documentos.</p>';
    }
  },

  fecharModal() {
    this.elementos.modal.style.display = 'none';
    this.elementos.form.reset();
  },

  mostrarErro(msg) {
    showToast(msg, 'error');
  }
};

// ==========================================
// 3. CONTROLLER (Regras e Eventos)
// ==========================================
const ClienteController = {
  dadosLocais: [], // Cache local para busca rápida

  async init() {
    ClienteView.init();
    this.bindEvents();
    await this.carregarAdvogados();
    await this.carregarDados();
  },

  async carregarAdvogados() {
    const select = document.getElementById('cliente-advogado');
    if (!select) return;

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome')
      .in('role', ['ADMIN', 'ADVOGADO', 'ADVOGADA'])
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao carregar advogados:', error);
      return;
    }

    select.innerHTML = '<option value="">Selecione...</option>' +
      data.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
  },

  bindEvents() {
    // Botão Novo
    ClienteView.elementos.btnNovo.addEventListener('click', () => {
      ClienteView.abrirModal();
    });

    // Botão Cancelar Modal
    ClienteView.elementos.btnCancelar.addEventListener('click', () => {
      ClienteView.fecharModal();
    });

    // Submit do Formulário
    ClienteView.elementos.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarCliente();
    });

    // Input de Busca (Debounce manual simples)
    ClienteView.elementos.inputBusca.addEventListener('input', (e) => {
      const termo = e.target.value.toLowerCase();
      const filtrados = this.dadosLocais.filter(c => 
        c.nome.toLowerCase().includes(termo) || 
        (c.documento && c.documento.includes(termo))
      );
      ClienteView.renderizarTabela(filtrados);
    });

    // Sincroniza CPF principal com CPF do INSS visualmente
    document.getElementById('cliente-documento').addEventListener('input', (e) => {
      document.getElementById('cliente-inss-cpf').value = e.target.value;
    });

    // Delegação de eventos para botões dinâmicos (Editar/Excluir)
    document.getElementById('lista-clientes-body').addEventListener('click', async (e) => {
      const btnView = e.target.closest('.btn-view');
      const btnEdit = e.target.closest('.btn-edit');
      const btnDelete = e.target.closest('.btn-delete');

      if (btnView) {
        const id = btnView.dataset.id;
        const cliente = this.dadosLocais.find(c => c.id === id);
        if (cliente) ClienteView.abrirModal(cliente, true); // true = modo visualização
      }

      if (btnEdit) {
        const id = btnEdit.dataset.id;
        const cliente = this.dadosLocais.find(c => c.id === id);
        if (cliente) ClienteView.abrirModal(cliente);
      }

      if (btnDelete) {
        const id = btnDelete.dataset.id;
        if (confirm('Tem certeza? Isso apagará o histórico deste cliente.')) {
          await this.excluirCliente(id);
        }
      }
    });

    // Listener para Upload de Documento dentro do Modal
    document.body.addEventListener('change', async (e) => {
      if (e.target.id === 'upload-doc-cliente') {
        const file = e.target.files[0];
        const clienteId = e.target.dataset.cliente;
        if (!file || !clienteId) return;

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch(`${getApiUrl()}/documentos/upload`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                nome: file.name,
                tipo: file.type,
                arquivo: reader.result,
                cliente_id: clienteId
              })
            });

            if (res.ok) {
              showToast('Arquivo anexado!', 'success');
              ClienteController.atualizarSessaoDocumentos(clienteId);
            }
          } catch (err) { showToast('Erro no upload', 'error'); }
        };
        reader.readAsDataURL(file);
      }
    });

    // Listener para Exclusão de Documento dentro do Modal
    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-del-doc');
      if (btn && confirm('Deseja excluir este documento?')) {
        const id = btn.dataset.id;
        const clienteId = btn.dataset.cliente;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`${getApiUrl()}/documentos/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          showToast('Arquivo removido', 'success');
          ClienteController.atualizarSessaoDocumentos(clienteId);
        }
      }
    });
  },

  atualizarSessaoDocumentos(clienteId) {
    ClienteView.renderizarSessaoDocumentos(clienteId, false);
  },

  async carregarDados() {
    try {
      this.dadosLocais = await ClienteModel.listarTodos();
      ClienteView.renderizarTabela(this.dadosLocais);
    } catch (error) {
      console.error(error);
      ClienteView.mostrarErro('Falha ao carregar clientes.');
    }
  },

  async salvarCliente() {
    const id = document.getElementById('cliente-id').value;
    
    // Helper para garantir integridade de dados (Sanitização)
    const getVal = (eid) => {
      const el = document.getElementById(eid);
      if (!el) return null;
      const val = el.value.trim();
      // Campos UUID ou Datas no Postgres não aceitam string vazia ""
      return val === "" ? null : val;
    };
    
    // Pega o usuário logado para registrar quem criou
    const { data: { user } } = await supabase.auth.getUser();
    
    // Busca o ID interno do usuário na tabela pública 'usuarios' 
    // Isso previne erro de Foreign Key se o Auth ID for diferente do ID da tabela
    let usuarioIdReferencia = null;
    if (user && user.email) {
      const { data: usuarioPublico } = await supabase
        .from('usuarios')
        .select('id')
        .eq('ativo', true) // Apenas usuários ativos podem registrar
        .eq('email', user.email)
        .single();
      
      if (usuarioPublico) usuarioIdReferencia = usuarioPublico.id;
    }

    // Prepara objeto APENAS com colunas que existem no banco para evitar erro PGRST204
    // Campos de endereço removidos temporariamente do envio até que a tabela seja atualizada
    const payload = {
      nome: getVal('cliente-nome'),
      tipo: document.getElementById('cliente-tipo').value,
      documento: getVal('cliente-documento'),
      email: getVal('cliente-email'),
      telefone: getVal('cliente-telefone'),
      inss_senha: getVal('cliente-inss-senha'),

      // Endereço
      cep: getVal('cliente-cep'),
      endereco: getVal('cliente-endereco'),
      numero: getVal('cliente-numero'),
      bairro: getVal('cliente-bairro'),
      cidade: getVal('cliente-cidade'),
      estado: getVal('cliente-estado'),

      // Outros dados
      nacionalidade: getVal('cliente-nacionalidade'),
      estado_civil: getVal('cliente-estado-civil'),
      profissao: getVal('cliente-profissao'),

      // Relações
      advogado_id: getVal('cliente-advogado'),
      usuario_id: usuarioIdReferencia
    };

    // Validação Obrigatória Dinâmica
    const camposFaltantes = [];
    if (!payload.nome) camposFaltantes.push('Nome Completo');
    if (!payload.documento) camposFaltantes.push('CPF/CNPJ');

    if (camposFaltantes.length > 0) {
      // Mensagem gramaticalmente correta (e ou ,)
      const msg = camposFaltantes.join(' e ');
      showToast(`ATENÇÃO: É obrigatório preencher: ${msg}`, 'warning');
      
      // Realça visualmente os campos com erro
      if (!payload.nome) document.getElementById('cliente-nome').classList.add('input-error');
      if (!payload.documento) document.getElementById('cliente-documento').classList.add('input-error');
      
      return;
    }

    try {
      if (id) {
        // Ao atualizar, remove usuario_id para não sobrescrever o criador original, se não quiser
        const { usuario_id, ...dadosAtualizacao } = payload;
        await ClienteModel.atualizar(id, dadosAtualizacao);
      } else {
        // Tenta criar o cliente (com retry automático se faltar a coluna usuario_id no banco)
        try {
          await ClienteModel.criar(payload);
        } catch (err) {
          // Tratamento robusto para falhas específicas de vínculo de usuário
          const isColumnMissing = err.code === '42703'; // Coluna não existe no banco
          const isFKViolation = err.code === '23503';   // Usuário auth não existe na tabela publica

          if (isColumnMissing || isFKViolation || (err.message && err.message.includes('inss_senha'))) {
             // Apenas aviso silencioso para debug, tenta salvar sem os campos problemáticos
             console.warn(`Salvando com payload reduzido. Motivo: ${err.message}`);
             
             const { usuario_id, inss_senha, ...dadosReduzidos } = payload;
             await ClienteModel.criar(dadosReduzidos);
          } else {
             throw err; // Repassa erro 23505 (Duplicidade) ou outros para o catch principal
          }
        }
      }
      ClienteView.fecharModal();
      showToast('Cliente salvo com sucesso!', 'success');
      await this.carregarDados(); // Recarrega para garantir consistência
    } catch (error) {
      console.error(error);
      // Tratamento específico de erro de duplicidade (código Postgres 23505)
      if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
        ClienteView.mostrarErro('Este CPF/CNPJ já está cadastrado no sistema.');
      } else {
        // Se o erro for sobre a coluna usuario_id não existir, avisamos mas não travamos no futuro
        if (error.message && error.message.includes('usuario_id')) {
           ClienteView.mostrarErro('Erro de banco de dados: Coluna usuario_id não encontrada. Contate o suporte.');
        } else {
           ClienteView.mostrarErro(`Erro ao salvar: ${error.message}`);
        }
      }
    }
  },

  async excluirCliente(id) {
    try {
      await ClienteModel.deletar(id);
      showToast('Cliente excluído.', 'success');
      await this.carregarDados();
    } catch (error) {
      console.error(error);
      ClienteView.mostrarErro('Não foi possível excluir (pode haver processos vinculados).');
    }
  }
};

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  ClienteController.init();
});

