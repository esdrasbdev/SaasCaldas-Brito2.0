/*
 * Módulo Admin - Gerenciamento de Usuários e Permissões
 * Funcionalidades: Listar, Criar (Convidar), Editar, Excluir
 */

import { supabase, initSupabase, getApiUrl } from './supabase.js';
import { showToast } from './utils.js';

async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}


const AdminView = {
  container: document.getElementById('admin-container') || document.body, // Fallback
  
  init() {
    // Garante a estrutura da página caso não exista
    const mainContent = document.querySelector('.main-content') || this.container;
    
    // Injeta o HTML da interface administrativa se necessário
    if (!document.getElementById('lista-usuarios-body')) {
      mainContent.innerHTML = `
        <div class="page-header">
          <div>
            <h1>Configurações Administrativas</h1>
            <p>Gerenciamento de acesso e usuários do sistema.</p>
          </div>
          <button id="btn-novo-usuario" class="btn btn-primary">
            <i class="fa-solid fa-user-plus"></i> Novo Usuário
          </button>
        </div>

        <div class="card-section">
          <h2>Usuários Cadastrados</h2>
          <div class="table-responsive">
            <table class="recent-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Função (Role)</th>
                  <th>Status</th>
                  <th style="text-align: right;">Ações</th>
                </tr>
              </thead>
              <tbody id="lista-usuarios-body">
                <tr><td colspan="5" class="text-center">Carregando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Usuário -->
        <div id="modal-usuario" class="modal-overlay" style="display: none;">
          <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
              <h2 id="modal-titulo">Gerenciar Usuário</h2>
            </div>
            <form id="form-usuario">
              <div class="modal-body">
                <input type="hidden" id="user-id">
                
                <div class="form-group">
                  <label for="user-nome">Nome Completo</label>
                  <input type="text" id="user-nome" required>
                </div>

                <div class="form-group">
                  <label for="user-email">E-mail Corporativo</label>
                  <input type="email" id="user-email" required>
                </div>

                <div class="form-group">
                  <label for="user-role">Nível de Acesso</label>
                  <select id="user-role" required>
                    <option value="ADMIN">ADMIN (Acesso total)</option>
                    <option value="ADVOGADO">ADVOGADO</option>
                    <option value="ADVOGADA">ADVOGADA</option>
                    <option value="SECRETARIA">SECRETÁRIA</option>
                    <option value="ESTAGIARIO">ESTAGIÁRIO</option>
                    <option value="ESTAGIARIA">ESTAGIÁRIA</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="user-ativo">Status da Conta</label>
                  <select id="user-ativo" required>
                    <option value="true">Ativo</option>
                    <option value="false">Inativo (Bloqueado)</option>
                  </select>
                </div>

                <div class="form-group" id="grupo-senha" style="display:none;">
                  <label for="user-nova-senha">Nova Senha <span style="font-size:0.8rem;color:var(--cinza-medio);">(deixe vazio para não alterar)</span></label>
                  <input type="password" id="user-nova-senha" minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
                </div>
              </div>
              <div class="modal-footer">

                <button type="button" class="btn btn-secondary" id="btn-cancelar-modal">Cancelar</button>
                <button type="submit" class="btn btn-primary">Salvar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }
  },

  renderizarTabela(usuarios) {
    const tbody = document.getElementById('lista-usuarios-body');
    
    if (!usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Nenhum usuário encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = usuarios.map(u => `
      <tr>
        <td><strong>${u.nome}</strong></td>
        <td>${u.email}</td>
        <td><span class="status-badge prazo-amarelo">${u.role}</span></td>
        <td>
          <span class="status-badge ${u.ativo ? 'status-ativo' : 'prazo-vermelho'}">
            ${u.ativo ? 'ATIVO' : 'INATIVO'}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="btn-sm btn-edit" data-id="${u.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-sm btn-delete" data-id="${u.id}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');
  },

  abrirModal(usuario = null) {
    const modal = document.getElementById('modal-usuario');
    const form = document.getElementById('form-usuario');
    form.reset();

    const grupSenha = document.getElementById('grupo-senha');
    const campoSenha = document.getElementById('user-nova-senha');

    document.getElementById('modal-titulo').textContent = usuario ? 'Editar Usuário' : 'Novo Usuário';
    document.getElementById('user-id').value = usuario ? usuario.id : '';

    if (usuario) {
      document.getElementById('user-nome').value = usuario.nome;
      document.getElementById('user-email').value = usuario.email;
      document.getElementById('user-email').disabled = true; // e-mail imutável em edição

      const roleSelect = document.getElementById('user-role');
      roleSelect.value = usuario.role;
      roleSelect.disabled = false;

      document.getElementById('user-ativo').value = usuario.ativo.toString();

      // Mostrar campo nova senha apenas em edição
      grupSenha.style.display = 'block';
      campoSenha.required = false;
      campoSenha.value = '';
    } else {
      document.getElementById('user-email').disabled = false;
      document.getElementById('user-ativo').value = 'true';

      document.getElementById('user-role').disabled = false;

      // Em criação, senha é obrigatória
      grupSenha.style.display = 'block';
      campoSenha.required = true;
      campoSenha.value = '';
    }

    modal.style.display = 'flex';
  },

  fecharModal() {
    document.getElementById('modal-usuario').style.display = 'none';
  }
};

const AdminController = {
  async init() {
    AdminView.init();
    await this.carregar();
    this.bindEvents();
  },

  async carregar() {
    const tbody = document.getElementById('lista-usuarios-body');
    if (!supabase) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Supabase não inicializado.</td></tr>';
      return;
    }

    try {
      const res = await apiFetch('/usuarios');

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.toLowerCase().includes('application/json') || contentType.toLowerCase().includes('+json');

      if (!isJson) {
        const text = await res.text().catch(() => '');
        throw new Error(`Resposta inesperada (${res.status}): ${text.slice(0, 500)}`);
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar usuários');
      AdminView.renderizarTabela(data);
    } catch (err) {
      showToast('Erro ao carregar usuários: ' + err.message, 'error');
    }
  },

  bindEvents() {
    document.getElementById('btn-novo-usuario').onclick = () => AdminView.abrirModal();
    document.getElementById('btn-cancelar-modal').onclick = () => AdminView.fecharModal();
    
    document.getElementById('form-usuario').onsubmit = async (e) => {
      e.preventDefault();

      const id = document.getElementById('user-id').value;
      const nome = document.getElementById('user-nome').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const role = document.getElementById('user-role').value;
      const ativo = document.getElementById('user-ativo').value === 'true';
      const novaSenha = document.getElementById('user-nova-senha').value;

      try {
        if (!id) {
          if (!novaSenha) {
            showToast('Informe uma senha para o novo usuário.', 'error');
            return;
          }

          const res = await apiFetch('/usuarios', {
            method: 'POST',
            body: JSON.stringify({ nome, email, role, senha: novaSenha })
          });

          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erro ao criar usuário.');
          showToast('Usuário criado com sucesso!', 'success');
        } else {
          const body = { nome, role, ativo };
          if (novaSenha) body.novaSenha = novaSenha;

          const res = await apiFetch(`/usuarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(body)
          });

          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Erro ao atualizar usuário.');
          showToast('Usuário atualizado com sucesso!', 'success');
        }

        AdminView.fecharModal();
        await this.carregar();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    document.getElementById('lista-usuarios-body').addEventListener('click', async (e) => {
      const btnEdit = e.target.closest('.btn-edit');
      const btnDelete = e.target.closest('.btn-delete');
      
      if (btnEdit) {
        const { data } = await supabase.from('usuarios').select('*').eq('id', btnEdit.dataset.id).single();
        AdminView.abrirModal(data);
      }
      
      if (btnDelete) {
        const { confirmarExclusao } = await import('./utils.js');
        const ok = await confirmarExclusao({
          title: 'Excluir usuário?',
          message: 'Tem certeza que deseja excluir este usuário? Verifique possíveis dependências (foreign keys). Esta ação não pode ser desfeita.',
          confirmText: 'Sim, excluir',
          cancelText: 'Cancelar',
          danger: true
        });
        if (ok) {
          try {
            const { error } = await supabase.from('usuarios').delete().eq('id', btnDelete.dataset.id);

            if (error) {
              showToast('Falha: ' + error.message + '. Limpe dependências.', 'error');
            } else {
              showToast('Excluído!', 'success');
              this.carregar();
            }
          } catch (err) {
            showToast('Erro DELETE: ' + err.message, 'error');
          }
        }
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  AdminController.init();
});
