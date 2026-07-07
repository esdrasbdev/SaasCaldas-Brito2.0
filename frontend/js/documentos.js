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

      try {
        const token = localStorage.getItem('supabaseToken');

        const formData = new FormData();
        // Backend espera multipart/form-data via busboy com campo 'file'
        formData.append('file', file);

        // Campos opcionais que ajudam o backend a salvar metadata
        formData.append('nome', file.name);
        formData.append('tipo', file.type);

        // IMPORTANTE: backend exige cliente_id.
        // Como a tela atual de documentos.html está em desenvolvimento e não tem select,
        // este campo precisa ser definido quando você integrar o vínculo com cliente/processo.
        // Por enquanto deixamos opcional (vai falhar com 400 se cliente_id não vier).
        // Exemplo: formData.append('cliente_id', clienteId);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${getApiUrl()}/documentos/blob-upload`, true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        const criarBarProgresso = () => {
          const container = document.getElementById('upload-progresso-container');
          if (container) return;

          const el = document.createElement('div');
          el.id = 'upload-progresso-container';
          el.style.marginTop = '12px';
          el.style.padding = '10px 12px';
          el.style.borderRadius = '10px';
          el.style.background = 'rgba(99, 102, 241, 0.08)';
          el.innerHTML = `
            <div style="display:flex;gap:10px;align-items:center;">
              <div style="flex:1; height:10px; background:rgba(0,0,0,0.08); border-radius:999px; overflow:hidden;">
                <div id="upload-progresso-bar" style="width:0%; height:100%; background:var(--azul-medio);"></div>
              </div>
              <div id="upload-progresso-text" style="min-width:60px; text-align:right; color: var(--cinza-medio);">0%</div>
            </div>
          `;
          document.querySelector('#view-documentos-container')?.appendChild(el);
        };

        const atualizarBarProgresso = (percent) => {
          criarBarProgresso();
          const bar = document.getElementById('upload-progresso-bar');
          const text = document.getElementById('upload-progresso-text');
          if (bar) bar.style.width = `${percent}%`;
          if (text) text.textContent = `${percent}%`;
        };

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          const percent = Math.round((event.loaded / event.total) * 100);
          atualizarBarProgresso(Math.min(100, Math.max(0, percent)));
        };

        xhr.onload = async () => {
          try {
            const res = { ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status };
            let payload = null;
            try {
              payload = JSON.parse(xhr.responseText);
            } catch (_) {
              payload = null;
            }

            if (res.ok) {
              showToast('Documento enviado!', 'success');
              const container = document.getElementById('upload-progresso-container');
              if (container) container.remove();
              this.carregarDocumentos();
              return;
            }

            const err = payload || {};
            const map = {
              400: err.error || 'Tipo/entrada inválida.',
              401: 'Sessão inválida. Faça login novamente.',
              413: 'Arquivo muito grande.',
              500: err.error || 'Falha ao enviar documento.'
            };
            const msg = map[res.status] || err.error || 'Falha ao enviar documento.';
            showToast(msg, 'error');
          } catch (e2) {
            console.error(e2);
            showToast('Erro ao processar resposta do servidor.', 'error');
          }
        };

        xhr.onerror = () => {
          showToast('Erro de conexão com o servidor', 'error');
        };

        xhr.send(formData);
      } catch (err) {
        console.error(err);
        showToast('Erro de conexão com o servidor', 'error');
      }
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