/*
 * Módulo Audiências
 * Gerenciamento de audiências vinculadas a processos
 */

import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js';

// ==========================================
// 1. MODEL
// ==========================================
const AudienciaModel = {
  async listarTodas() {
    const { data, error } = await supabase
      .from('audiencias')
      .select('*, processos(numero_cnj, clientes(nome)), usuarios(nome)')
      .order('data', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async criar(audiencia) {
    // CORREÇÃO AQUI: Removemos campos que não existem na tabela se vierem nulos
    const { data, error } = await supabase
      .from('audiencias')
      .insert([audiencia])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deletar(id) {
    const { error } = await supabase.from('audiencias').delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};

// ==========================================
// 2. VIEW
// ==========================================
const AudienciaView = {
  container: document.getElementById('view-audiencias-container') || document.querySelector('.main-content'),
  
  init() {
    if (!document.getElementById('tabela-audiencias-container')) {
      this.container.innerHTML = `
        <div class="page-header">
          <div>
            <h1>Audiências</h1>
            <p>Gestão de pauta e compromissos judiciais.</p>
          </div>
          <button id="btn-nova-audiencia" class="btn btn-primary">
            <i class="fa-solid fa-plus"></i> Nova Audiência
          </button>
        </div>

        <div class="card-section" id="tabela-audiencias-container">
          <div class="table-responsive">
            <table class="recent-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Processo / Cliente</th>
                  <th>Local / Tipo</th>
                  <th style="text-align: right;">Ações</th>
                </tr>
              </thead>
              <tbody id="lista-audiencias-body">
                <tr><td colspan="4" class="text-center">Carregando...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Audiencia -->
        <div id="modal-audiencia" class="modal-overlay" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Agendar Audiência</h2>
            </div>
            <form id="form-audiencia">
              <div class="modal-body">
                <div class="form-group">
                  <label for="aud-processo">Processo Vinculado</label>
                  <select id="aud-processo"></select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div class="form-group">
                    <label for="aud-data">Data</label>
                    <input type="date" id="aud-data" required>
                  </div>
                  <div class="form-group">
                    <label for="aud-hora">Hora</label>
                    <input type="time" id="aud-hora" required>
                  </div>
                </div>

                <div class="form-group">
                  <label for="aud-tipo">Tipo</label>
                  <select id="aud-tipo">
                    <option value="Conciliação">Conciliação</option>
                    <option value="Instrução e Julgamento">Instrução e Julgamento</option>
                    <option value="Una">Una</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="aud-local">Local / Link</label>
                  <input type="text" id="aud-local" placeholder="Ex: 2ª Vara Cível ou Link Zoom">
                </div>

                <div class="form-group">
                  <label for="aud-obs">Observações</label>
                  <textarea id="aud-obs" rows="3"></textarea>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" id="btn-cancelar-aud">Cancelar</button>
                <button type="submit" class="btn btn-primary">Salvar Agendamento</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }
  },

  renderizarTabela(lista) {
    const tbody = document.getElementById('lista-audiencias-body');
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center">Nenhuma audiência agendada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(a => {
      const dataObj = new Date(a.data);
      return `
        <tr>
          <td>
            <div style="font-weight: 600; color: var(--azul-escuro);">${dataObj.toLocaleDateString('pt-BR')}</div>
            <div class="text-muted">${dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</div>
          </td>
          <td>
            <div>${a.processos?.numero_cnj || 'S/N'}</div>
            <small class="text-muted">${a.processos?.clientes?.nome || '-'}</small>
          </td>
          <td>
            <span class="status-badge" style="background: #e0f2fe; color: #0284c7;">${a.tipo}</span>
            <div style="font-size: 0.85rem; margin-top: 4px;">${a.local || 'Virtual'}</div>
          </td>
          <td style="text-align: right;">
            <button class="btn-sm btn-delete" data-id="${a.id}" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  },

  preencherSelectProcessos(processos) {
    const select = document.getElementById('aud-processo');
    select.innerHTML = '<option value="">(Opcional) Selecione...</option>' + 
      processos.map(p => `<option value="${p.id}">${p.numero_cnj} - ${p.clientes?.nome}</option>`).join('');
  },

  modal(abrir) {
    const el = document.getElementById('modal-audiencia');
    el.style.display = abrir ? 'flex' : 'none';
    if (!abrir) document.getElementById('form-audiencia').reset();
  }
};

// ==========================================
// 3. CONTROLLER
// ==========================================
const AudienciaController = {
  async init() {
    AudienciaView.init();
    
    // Carrega Processos para o Select
    const { data: processos } = await supabase.from('processos').select('id, numero_cnj, clientes(nome)');
    AudienciaView.preencherSelectProcessos(processos || []);

    await this.carregarDados();
    this.bindEvents();
  },

  async carregarDados() {
    try {
      const dados = await AudienciaModel.listarTodas();
      AudienciaView.renderizarTabela(dados);
    } catch (error) {
      showToast('Erro ao listar audiências', 'error');
    }
  },

  bindEvents() {
    document.getElementById('btn-nova-audiencia').onclick = () => AudienciaView.modal(true);
    document.getElementById('btn-cancelar-aud').onclick = () => AudienciaView.modal(false);

    document.getElementById('form-audiencia').onsubmit = async (e) => {
      e.preventDefault();
      
      const dataStr = document.getElementById('aud-data').value;
      const horaStr = document.getElementById('aud-hora').value;
      
      // Criamos o objeto Date garantindo que o navegador entenda como hora local
      // O uso do construtor Date com string YYYY-MM-DDTHH:mm sem sufixo 'Z' assume local
      const dataIso = new Date(`${dataStr}T${horaStr}`).toISOString();

      // Recupera ID do usuário atual para ser o "advogado_id"
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast('Usuário não autenticado', 'error');
        return;
      }
      
      // Busca ID na tabela usuarios com null check
      const { data: uData, error: userError } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (userError || !uData) {
        showToast('Usuário não encontrado no banco', 'error');
        return;
      }

      const payload = {
        processo_id: document.getElementById('aud-processo').value || null,
        data: dataIso,
        tipo: document.getElementById('aud-tipo').value,
        local: document.getElementById('aud-local').value,
        observacoes: document.getElementById('aud-obs').value || '',
        advogado_id: uData.id
      };

      try {
        await AudienciaModel.criar(payload);
        showToast('Audiência agendada!', 'success');
      } catch (error) {
        console.error(error);
        showToast('Erro ao salvar: ' + error.message, 'error');
      } finally {
        AudienciaView.modal(false);
        this.carregarDados();
      }
    };
  }
};

document.addEventListener('DOMContentLoaded', () => AudienciaController.init());