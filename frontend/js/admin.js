/*
 * Módulo Admin - Gerenciamento de Usuários e Permissões
 * Funcionalidades: Listar, Criar (Convidar), Editar, Excluir
 */

import { supabase } from './supabase.js';
import { showToast } from './utils.js';

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
    
    document.getElementById('modal-titulo').textContent = usuario ? 'Editar Usuário' : 'Novo Usuário';
    document.getElementById('user-id').value = usuario ? usuario.id : '';
    
    if (usuario) {
      document.getElementById('user-nome').value = usuario.nome;
      document.getElementById('user-email').value = usuario.email;
      document.getElementById('user-email').disabled = false;
      document.getElementById('user-role').value = usuario.role;
      document.getElementById('user-ativo').value = usuario.ativo.toString();
    } else {
      document.getElementById('user-email').disabled = false;
      document.getElementById('user-ativo').value = 'true';
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
    if (!supabase) {
      AdminView.container.innerHTML = '<div class="text-center" style="padding:16px;">Supabase não inicializado. Verifique js/env.js.</div>';
      return;
    }

    const { data, error } = await supabase.from('usuarios').select('*').order('nome');
    if (!error) AdminView.renderizarTabela(data);
  },

  bindEvents() {
    document.getElementById('btn-novo-usuario').onclick = () => AdminView.abrirModal();
    document.getElementById('btn-cancelar-modal').onclick = () => AdminView.fecharModal();
    
    document.getElementById('form-usuario').onsubmit = async (e) => {
      e.preventDefault();
      const id = document.getElementById('user-id').value;
      const dados = {
        nome: document.getElementById('user-nome').value,
        email: document.getElementById('user-email').value,
        role: document.getElementById('user-role').value,
        ativo: document.getElementById('user-ativo').value === 'true'
      };

      if (!id) {
        // Criar (apenas insere na tabela pública por enquanto, auth deve ser tratado à parte ou via convite)
        const { error } = await supabase.from('usuarios').insert(dados);
        if (error) {
          showToast('Erro ao criar usuário: ' + error.message, 'error');
        } else {
          showToast('Usuário criado com sucesso!', 'success');
        }
      } else {
        // Editar
        const { error } = await supabase.from('usuarios').update(dados).eq('id', id);
        if (error) {
          showToast('Erro ao atualizar: ' + error.message, 'error');
        } else {
          showToast('Usuário atualizado!', 'success');
        }
      }
      
      AdminView.fecharModal();
      this.carregar();
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

document.addEventListener('DOMContentLoaded', () => AdminController.init());