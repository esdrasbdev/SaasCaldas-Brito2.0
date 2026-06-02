/*
 * Módulo de Documentos - Frontend
 * Gerencia Upload, Listagem e Ações (Visualizar/Excluir)
 */

import { supabase, getApiUrl } from './supabase.js';
import { showToast } from './utils.js';

const DocumentosUI = {
  init() {
    const container = document.getElementById('view-documentos-container');
    if (!container) return;
    this.render();
    this.carregarDocumentos();
    this.bindEvents();
  },

  render() {
    const container = document.getElementById('view-documentos-container');
    if (!container) return;

    container.innerHTML = `
      <div class="card-section">
        <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>Gestão de Documentos</h2>
          <label class="btn-primary" style="cursor: pointer;">
            <i class="fa-solid fa-upload"></i> Subir Novo Arquivo
            <input type="file" id="input-upload-doc" style="display: none;">
          </label>
        </div>
        
        <div class="table-responsive">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Nome do Arquivo</th>
                <th>Vínculo</th>
                <th>Data</th>
                <th style="text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody id="lista-documentos">
              <tr><td colspan="4" class="text-center">Carregando documentos...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async carregarDocumentos() {
    try {
      const token = localStorage.getItem('supabaseToken');
      const res = await fetch(`${getApiUrl()}/documentos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const documentos = await res.json();
      
      const tbody = document.getElementById('lista-documentos');
      if (!documentos || documentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum documento encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = documentos.map(doc => `
        <tr>
          <td><i class="fa-solid fa-file-lines" style="color: var(--azul-medio);"></i> ${doc.nome}</td>
          <td><small>${doc.clientes?.nome || 'Geral'}</small></td>
          <td>${new Date(doc.criado_em).toLocaleDateString('pt-BR')}</td>
          <td style="text-align: right;">
            <a href="${doc.url}" target="_blank" class="btn-sm" title="Visualizar"><i class="fa-solid fa-eye"></i></a>
            <a href="${doc.url}" download="${doc.nome}" class="btn-sm" title="Baixar"><i class="fa-solid fa-download"></i></a>
            <button class="btn-sm btn-delete-doc" data-id="${doc.id}" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      console.error(e);
    }
  },

  bindEvents() {
    const input = document.getElementById('input-upload-doc');
    input?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const token = localStorage.getItem('supabaseToken');
        const res = await fetch(`${getApiUrl()}/documentos/upload`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            nome: file.name,
            tipo: file.type,
            arquivo: reader.result
          })
        });

        if (res.ok) {
          showToast('Documento enviado!', 'success');
          this.carregarDocumentos();
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('lista-documentos')?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-delete-doc');
      if (btn && confirm('Excluir documento permanentemente?')) {
        const id = btn.dataset.id;
        const token = localStorage.getItem('supabaseToken');
        
        try {
          const res = await fetch(`${getApiUrl()}/documentos/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
            showToast('Documento excluído', 'success');
            this.carregarDocumentos();
          } else {
            showToast('Erro ao excluir documento', 'error');
          }
        } catch (err) {
          showToast('Erro de conexão com o servidor', 'error');
        }
      }
    });
  }
};

// Inicialização automática ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  DocumentosUI.init();
});