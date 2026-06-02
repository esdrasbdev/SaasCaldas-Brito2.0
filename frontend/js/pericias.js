/*
 * Lógica para a página de Perícias
 * - Carrega perícias do banco
 * - Popula select de clientes
 * - Salva novas perícias
 */

import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js';

const formContainer = document.getElementById('form-container');
const btnNovaPericia = document.getElementById('btn-nova-pericia');
const btnCancelar = document.getElementById('btn-cancelar');
const formPericia = document.getElementById('form-pericia');
const clienteSelect = document.getElementById('cliente-select');
const listaPericias = document.getElementById('lista-pericias');

// Helper para obter valor de input, tratando string vazia como null
const getVal = (id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const val = el.value.trim();
  return val === "" ? null : val;
};

// Adiciona campos dinâmicos ao formulário via JS para garantir que existam
function ajustarCamposFormulario() {
  const formBody = formPericia.querySelector('.modal-body');
  if (!formBody) return;

  // HTML para os novos campos
  const novosCampos = `
    <div class="form-group">
      <label for="pericia-tipo">Tipo de Perícia *</label>
      <select id="pericia-tipo" required>
        <option value="Administrativa">Administrativa</option>
        <option value="Judicial">Judicial</option>
      </select>
    </div>
    <div id="campos-judiciais" style="display: none; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
      <div class="form-group"><label>Tribunal</label><input type="text" id="pericia-tribunal"></div>
      <div class="form-group"><label>Vara</label><input type="text" id="pericia-vara"></div>
    </div>
  `;
  
  // Insere no início do body do modal
  formBody.insertAdjacentHTML('afterbegin', novosCampos);

  document.getElementById('pericia-tipo').addEventListener('change', (e) => {
    const isJudicial = e.target.value === 'Judicial';
    document.getElementById('campos-judiciais').style.display = isJudicial ? 'grid' : 'none';
  });
}

// Mostra/esconde o formulário
btnNovaPericia.addEventListener('click', () => {
  formContainer.style.display = 'flex';
  // Reseta para modo edição/criação
  formPericia.reset();
  document.querySelector('#form-pericia button[type="submit"]').style.display = 'block';
  formPericia.classList.remove('mode-view'); // Garante estilo de edição
  const inputs = formPericia.querySelectorAll('input, select');
  inputs.forEach(el => el.disabled = false);

  // Garante que o modal-body tenha o grid para melhor visualização
  const modalBody = formPericia.querySelector('.modal-body');
  if (modalBody) {
    // Em vez de style.cssText, adicione uma classe CSS definida no style.css
    modalBody.classList.add('modal-grid-layout');
    
    // Dica: No seu style.css, crie:
    // .modal-grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    // .modal-grid-layout label { font-size: 0.75rem; font-weight: 600; ... }
  }
  document.getElementById('campos-judiciais').style.display = 'none';
  document.querySelector('.modal-header h2').textContent = 'Agendar Nova Perícia';
});

btnCancelar.addEventListener('click', () => {
  formContainer.style.display = 'none';
  formPericia.reset();
  document.getElementById('pericia-tipo').value = 'Administrativa'; // Reseta para o default
});

// Carrega clientes para o dropdown
async function carregarClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao carregar clientes:', error);
    return;
  }

  clienteSelect.innerHTML = '<option value="">(Opcional) Selecione...</option>';
  data.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.nome;
    clienteSelect.appendChild(option);
  });
}

// Carrega e exibe as perícias na tabela
  async function carregarPericias() {
    const isAdmin = AuthAPI.getRole() === 'ADMIN';
  
    // Force usuarios load (Antonio/Priscila)
    let { data, error } = await supabase
      .from('pericias')
      .select(`
        *,
        clientes(nome),
        usuarios(nome)
      `)
      .order('data', { ascending: true });

  // Fallback: Se falhar por relacionamento inexistente (PGRST200) ou Bad Request (400), tenta carregar sem usuário
  if (error && (error.code === 'PGRST200' || error.code === 'PGRST204' || error.message?.includes('FetchError') || !data)) {
    // console.warn('Aviso: Relação com usuários não encontrada. Carregando modo simplificado.'); // Comentado para limpar console
    const res = await supabase.from('pericias').select('*, clientes(nome)').order('data', { ascending: true });
    data = res.data;
    error = res.error;
  }

  if (error) {
    console.error('Erro ao carregar perícias:', error.message);
    listaPericias.innerHTML = `<tr><td colspan="5" class="text-center">Erro ao carregar dados.</td></tr>`;
    return;
  }

  if (data.length === 0) {
    listaPericias.innerHTML = `<tr><td colspan="5" class="text-center">Nenhuma perícia cadastrada.</td></tr>`;
    return;
  }

  listaPericias.innerHTML = data.map(p => `
    <tr>
      <td>
        <div style="font-weight: 600;">${p.clientes?.nome || '-'}</div>
        <small class="status-badge ${p.tipo === 'Judicial' ? 'prazo-amarelo' : 'icon-blue'}" style="font-size:0.6rem;">${p.tipo || 'N/A'}</small>
      </td>
      <td>
        <div>${new Date(p.data).toLocaleString('pt-BR')}</div>
        ${p.tipo === 'Judicial' ? `<small class="text-muted">${p.tribunal || ''} - ${p.vara || ''}</small>` : ''}
      </td>
      <td>${p.local}</td>
      <td>${p.perito || 'Não informado'}</td>
      <td>
        <button class="btn-sm btn-view" data-id="${p.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
        <button class="btn-sm btn-edit" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
        ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${p.id}" title="Excluir" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
      </td>
    </tr>
  `).join('');
}

// Salva uma nova perícia
formPericia.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Busca usuário logado para registrar quem criou/agendou
  const { data: { user } } = await supabase.auth.getUser();
  let usuarioId = null;
  if (user && user.email) {
    // Nota: Esta busca pode ser otimizada se o ID do usuário já estiver no req.user do backend
    // ou se o frontend já tiver o ID público em cache.
    // Por enquanto, mantemos a busca para garantir a integridade.
    // No futuro, considere passar o req.user.id do backend diretamente para o frontend.
    const { data: uData } = await supabase.from('usuarios').select('id').eq('email', user.email).single();
    if (uData) usuarioId = uData.id;
  }
  
  const tipo = getVal('pericia-tipo');
  // Vara e Tribunal não são mais obrigatórios, apenas aparecem

  const dataInput = document.getElementById('pericia-data').value;
  const horaInput = document.getElementById('pericia-hora').value;
  // Combina data e hora no formato ISO
  const dataIso = (dataInput && horaInput) ? new Date(`${dataInput}T${horaInput}`).toISOString() : null;

  const novaPericia = {
    cliente_id: getVal('cliente-select'),
    usuario_id: usuarioId,
    data: dataIso,
    tipo: tipo,
    tribunal: getVal('pericia-tribunal'),
    vara: getVal('pericia-vara'),
    local: document.getElementById('pericia-local').value,
    perito: document.getElementById('pericia-perito').value,
  };

  const { error } = await supabase.from('pericias').insert(novaPericia);

  if (error) {
    console.error('Erro ao salvar perícia:', error.message, error.details, error);
    showToast('Não foi possível salvar a perícia.', 'error');
  } else {
    showToast('Perícia agendada com sucesso!', 'success');
    formPericia.reset();
    formContainer.style.display = 'none';
    carregarPericias();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  ajustarCamposFormulario();
  carregarClientes();
  carregarPericias();
  
  // Event listener para ações
  listaPericias.addEventListener('click', async (e) => {
    const btnEdit = e.target.closest('.btn-edit');
    const btnView = e.target.closest('.btn-view');
    const btnDelete = e.target.closest('.btn-delete');

    if (btnEdit || btnView) {
      const id = (btnEdit || btnView).dataset.id;
      const { data, error } = await supabase.from('pericias').select('*').eq('id', id).single();
      
      if (error || !data) {
        showToast('Erro ao carregar', 'error');
        return;
      }

      // Populate form
      document.getElementById('cliente-select').value = data.cliente_id || '';
      const localDate = new Date(data.data).toISOString().slice(0, 16);
      document.getElementById('pericia-data').value = localDate;
      document.getElementById('pericia-local').value = data.local || '';
      document.getElementById('pericia-perito').value = data.perito || '';
      document.getElementById('pericia-tipo').value = data.tipo || 'Administrativa';
      document.getElementById('pericia-tribunal').value = data.tribunal || '';
      document.getElementById('pericia-vara').value = data.vara || '';
      document.getElementById('campos-judiciais').style.display = data.tipo === 'Judicial' ? 'grid' : 'none';

      // Mode
      const isView = btnView;
      const inputs = formPericia.querySelectorAll('input, select');
      inputs.forEach(el => el.disabled = isView);
      formPericia.classList.toggle('mode-view', isView);
      document.querySelector('#form-pericia button[type="submit"]').style.display = isView ? 'none' : 'block';
      document.querySelector('.modal-header h2').textContent = isView ? 'Detalhes da Perícia' : 'Editar Perícia';

      formContainer.style.display = 'flex';
    }

    if (btnDelete && confirm('Tem certeza?')) {
      const { error } = await supabase.from('pericias').delete().eq('id', btnDelete.dataset.id);
      showToast(error ? 'Erro ao excluir' : 'Excluída!', error ? 'error' : 'success');
      carregarPericias();
    }
  });
});