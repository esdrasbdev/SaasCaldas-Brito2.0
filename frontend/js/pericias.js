/*
 * Lógica para a página de Perícias
 * - Carrega perícias do banco
 * - Popula select de clientes
 * - Salva novas perícias
 */

import { supabase, initSupabase } from './supabase.js';

import { AuthAPI } from './auth.js';
import { showToast, formatarHora24h, formatarData } from './utils.js';

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
    window.__listaPericiasCompleta = [];
    listaPericias.innerHTML = `
      <tr>
        <td colspan="5" style="padding:0;">
          <div style="min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--cinza-medio); gap:10px;">
            <i class="fa-regular fa-folder-open" style="font-size:2rem; opacity:0.4;"></i>
            <span style="font-size:0.9rem;">Nenhuma perícia cadastrada.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  window.__listaPericiasCompleta = data;

  const termoBuscaEl = document.getElementById('pericias-busca');
  const termoBusca = termoBuscaEl ? termoBuscaEl.value.trim().toLowerCase() : '';

  const filtrar = (p) => {
    if (!termoBusca) return true;

    const cliente = (p.clientes?.nome || '').toLowerCase();
    const tipo = (p.tipo || '').toLowerCase();
    const local = (p.local || '').toLowerCase();
    const perito = (p.perito || '').toLowerCase();
    const dtTxt = p.data ? formatarData(p.data).toLowerCase() : '';

    return [cliente, tipo, local, perito, dtTxt].some(v => v.includes(termoBusca));
  };

  const listaFiltrada = data.filter(filtrar);

  listaPericias.innerHTML = listaFiltrada.map(p => {

    const dataTxt = p.data ? formatarData(p.data) : '-';
    const horaTxt = p.data ? formatarHora24h(p.data) : '';

    const tipoCor = p.tipo === 'Judicial'
      ? 'background:#fef3c7; color:#92400e;'
      : 'background:#e0f2fe; color:#0284c7;';

    return `
      <tr>
        <td>
          <div style="font-weight:600; font-size:0.9rem;">${p.clientes?.nome || '-'}</div>
          <span class="status-badge" style="${tipoCor} font-size:0.7rem; padding:2px 8px; border-radius:12px; display:inline-block; white-space:nowrap;">${p.tipo || 'N/A'}</span>
        </td>
        <td style="white-space:nowrap;">
          <div style="font-size:0.9rem; font-weight:600;">${dataTxt}</div>
          <div style="font-size:0.8rem; color:var(--cinza-medio);">${horaTxt}</div>
          ${p.tipo === 'Judicial' && (p.tribunal || p.vara)
            ? `<div style="font-size:0.75rem; color:var(--cinza-medio); margin-top:2px;">${[p.tribunal, p.vara].filter(Boolean).join(' — ')}</div>`
            : ''}
        </td>
        <td style="font-size:0.85rem;">${p.local || '-'}</td>
        <td style="font-size:0.85rem;">${p.perito || 'Não informado'}</td>
        <td style="text-align:right; width:90px;">
          <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
            <button class="btn-sm btn-view" data-id="${p.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
            <button class="btn-sm btn-edit" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${p.id}" title="Excluir" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}


// Salva uma nova perícia
formPericia.addEventListener('submit', async (e) => {
  e.preventDefault();

  const periciaId = document.getElementById('pericia-id')?.value || '';
  const isEdit = !!periciaId;


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
  // Combina data e hora e salva como ISO (compatível com campos timestamptz)
  // Se qualquer um estiver vazio, não salvamos data
  const dataIso = (dataInput && horaInput) ? new Date(`${dataInput}T${horaInput}:00-03:00`).toISOString() : null;


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

  let error = null;
  if (isEdit) {
    const res = await supabase.from('pericias').update(novaPericia).eq('id', periciaId);
    error = res.error;
  } else {
    const res = await supabase.from('pericias').insert(novaPericia);
    error = res.error;
  }


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

document.addEventListener('DOMContentLoaded', async () => {
  ajustarCamposFormulario();
  await initSupabase();
  await carregarClientes();
  await carregarPericias();


  // Busca local na tabela
  const termoBuscaEl = document.getElementById('pericias-busca');
  const btnLimpar = document.getElementById('pericias-busca-limpar');

  termoBuscaEl?.addEventListener('input', () => {
    const termo = termoBuscaEl.value.trim().toLowerCase();
    const dados = window.__listaPericiasCompleta || [];

    const filtrar = (p) => {
      if (!termo) return true;

      const cliente = (p.clientes?.nome || '').toLowerCase();
      const tipo = (p.tipo || '').toLowerCase();
      const local = (p.local || '').toLowerCase();
      const perito = (p.perito || '').toLowerCase();
      const dtTxt = p.data ? formatarData(p.data).toLowerCase() : '';

      return [cliente, tipo, local, perito, dtTxt].some(v => v.includes(termo));
    };

    const listaFiltrada = dados.filter(filtrar);

    const isAdmin = AuthAPI.getRole() === 'ADMIN';

    if (!listaFiltrada.length) {
      listaPericias.innerHTML = `
        <tr>
          <td colspan="5" style="padding:0;">
            <div style="min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--cinza-medio); gap:10px;">
              <i class="fa-regular fa-folder-open" style="font-size:2rem; opacity:0.4;"></i>
              <span style="font-size:0.9rem;">Nenhuma perícia encontrada para este filtro.</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    listaPericias.innerHTML = listaFiltrada.map(p => {
      const dataTxt = p.data ? formatarData(p.data) : '-';
      const horaTxt = p.data ? formatarHora24h(p.data) : '';

      const tipoCor = p.tipo === 'Judicial'
        ? 'background:#fef3c7; color:#92400e;'
        : 'background:#e0f2fe; color:#0284c7;';

      return `
        <tr>
          <td>
            <div style="font-weight:600; font-size:0.9rem;">${p.clientes?.nome || '-'}</div>
            <span class="status-badge" style="${tipoCor} font-size:0.7rem; padding:2px 8px; border-radius:12px; display:inline-block; white-space:nowrap;">${p.tipo || 'N/A'}</span>
          </td>
          <td style="white-space:nowrap;">
            <div style="font-size:0.9rem; font-weight:600;">${dataTxt}</div>
            <div style="font-size:0.8rem; color:var(--cinza-medio);">${horaTxt}</div>
            ${p.tipo === 'Judicial' && (p.tribunal || p.vara)
              ? `<div style="font-size:0.75rem; color:var(--cinza-medio); margin-top:2px;">${[p.tribunal, p.vara].filter(Boolean).join(' — ')}</div>`
              : ''}
          </td>
          <td style="font-size:0.85rem;">${p.local || '-'}</td>
          <td style="font-size:0.85rem;">${p.perito || 'Não informado'}</td>
          <td style="text-align:right; width:90px;">
            <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
              <button class="btn-sm btn-view" data-id="${p.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
              <button class="btn-sm btn-edit" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
              ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${p.id}" title="Excluir" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  });

  btnLimpar?.addEventListener('click', () => {
    if (termoBuscaEl) {
      termoBuscaEl.value = '';
      termoBuscaEl.dispatchEvent(new Event('input'));
    }
  });

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
      // data[type] pode vir como timestamptz/iso string; precisamos preencher input[type=date] com YYYY-MM-DD
      // Garantimos compatibilidade fazendo parsing e formatando para data local
      const dt = data.data ? new Date(data.data) : null;
      document.getElementById('pericia-data').value = dt ? dt.toLocaleDateString('pt-BR', {
        timeZone: 'America/Fortaleza'
      }).split('/').reverse().join('-') : '';
      document.getElementById('pericia-hora').value = dt ? dt.toLocaleTimeString('pt-BR', {
        timeZone: 'America/Fortaleza',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) : '';

      document.getElementById('pericia-local').value = data.local || '';
      document.getElementById('pericia-perito').value = data.perito || '';
      document.getElementById('pericia-tipo').value = data.tipo || 'Administrativa';
      document.getElementById('pericia-tribunal').value = data.tribunal || '';
      document.getElementById('pericia-vara').value = data.vara || '';
      document.getElementById('campos-judiciais').style.display = data.tipo === 'Judicial' ? 'grid' : 'none';

      // Mode
      const isView = !!btnView;
      const inputs = formPericia.querySelectorAll('input, select');
      inputs.forEach(el => el.disabled = isView);
      formPericia.classList.toggle('mode-view', isView);
      document.querySelector('#form-pericia button[type="submit"]').style.display = isView ? 'none' : 'block';
      document.querySelector('.modal-header h2').textContent = isView ? 'Detalhes da Perícia' : 'Editar Perícia';

      // Hidden id para edição
      if (!document.getElementById('pericia-id')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'pericia-id';
        document.getElementById('form-pericia').insertBefore(hidden, document.getElementById('form-pericia').firstChild);
      }
      document.getElementById('pericia-id').value = id;

      formContainer.style.display = 'flex';

      // garantir data/hora e demais campos sempre pre-selecionados
      document.getElementById('pericia-data').dispatchEvent(new Event('change'));



    }

    if (btnDelete) {
      const ok = confirm('Excluir esta perícia?');
      if (!ok) return;

      const id = btnDelete.dataset.id;
      try {
        const { error } = await supabase.from('pericias').delete().eq('id', id);
        if (error) throw error;
        showToast('Perícia excluída!', 'success');
        carregarPericias();
      } catch (err) {
        console.error(err);
        showToast('Erro ao excluir perícia: ' + (err?.message || err), 'error');
      }
      return;
    }

  });
});