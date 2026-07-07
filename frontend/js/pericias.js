/*
 * Lógica para a página de Perícias
 * - Carrega perícias do banco
 * - Popula select de clientes
 * - Salva novas perícias
 * - Suporta múltiplos responsáveis via tabela responsaveis_pericia
 */

import { supabase, initSupabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast, formatarHora24h, formatarData } from './utils.js';
import { criarSeletorResponsaveis } from './responsaveis-select.js';

const formContainer = document.getElementById('form-container');
const btnNovaPericia = document.getElementById('btn-nova-pericia');
const btnCancelar = document.getElementById('btn-cancelar');
const formPericia = document.getElementById('form-pericia');
const clienteSelect = document.getElementById('cliente-select');
const listaPericias = document.getElementById('lista-pericias');

// Instância do seletor de responsáveis (inicializado no DOMContentLoaded)
let seletorResp = null;

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
  formPericia.reset();
  document.querySelector('#form-pericia button[type="submit"]').style.display = 'block';
  formPericia.classList.remove('mode-view');
  const inputs = formPericia.querySelectorAll('input, select');
  inputs.forEach(el => el.disabled = false);

  seletorResp?.limpar();
  seletorResp?.setDisabled(false);

  const modalBody = formPericia.querySelector('.modal-body');
  if (modalBody) {
    modalBody.classList.add('modal-grid-layout');
  }
  document.getElementById('campos-judiciais').style.display = 'none';
  document.querySelector('.modal-header h2').textContent = 'Agendar Nova Perícia';
});

btnCancelar.addEventListener('click', () => {
  formContainer.style.display = 'none';
  formPericia.reset();
  seletorResp?.limpar();
  seletorResp?.setDisabled(false);
  document.getElementById('pericia-tipo').value = 'Administrativa';
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

// Funções de filtro e renderização (ATIVA/ARQUIVADA)
function filtrarPericias(lista, termoBusca, tipoFiltro) {
  return (lista || []).filter((p) => {
    if (tipoFiltro && p.tipo !== tipoFiltro) return false;
    if (!termoBusca) return true;

    const cliente = (p.clientes?.nome || '').toLowerCase();
    const tipo = (p.tipo || '').toLowerCase();
    const local = (p.local || '').toLowerCase();
    const perito = (p.perito || '').toLowerCase();
    const dtTxt = p.data ? formatarData(p.data).toLowerCase() : '';
    const responsaveis = (p.responsaveis_pericia || [])
      .map(r => r.usuarios?.nome || '').join(' ').toLowerCase();

    return [cliente, tipo, local, perito, dtTxt, responsaveis].some((v) => v.includes(termoBusca));
  });
}

function renderizarTabelaAtivas(lista) {
  const tbody = document.getElementById('lista-pericias');
  if (!tbody) return;

  const isAdmin = AuthAPI.getRole() === 'ADMIN';

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:0;">
          <div style="min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--cinza-medio); gap:10px;">
            <i class="fa-regular fa-folder-open" style="font-size:2rem; opacity:0.4;"></i>
            <span style="font-size:0.9rem;">Nenhuma perícia encontrada.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const dataTxt = p.data ? formatarData(p.data) : '-';
    const horaTxt = p.data ? formatarHora24h(p.data) : '';

    const tipoCor = p.tipo === 'Judicial'
      ? 'background:#fef3c7; color:#92400e;'
      : 'background:#e0f2fe; color:#0284c7;';

    const responsaveis = (p.responsaveis_pericia || [])
      .map(r => r.usuarios?.nome?.split(' ')[0])
      .filter(Boolean)
      .join(', ') || '—';

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
        <td style="font-size:0.85rem;">${p.perito || 'Não informado'}
          <div style="font-size:0.75rem; color:var(--cinza-medio); margin-top:2px;">${responsaveis}</div>
        </td>
        <td style="text-align:right; width:130px;">
          <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
            <button class="btn-sm btn-view" data-id="${p.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
            <button class="btn-sm btn-edit" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${p.id}" title="Excluir" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
            <button class="btn-sm btn-arquivar" data-id="${p.id}" title="Arquivar" style="color: var(--cinza-medio);">
              <i class="fa-solid fa-box-archive"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarTabelaArquivadas(lista) {
  const tbody = document.getElementById('lista-pericias-arquivadas');
  if (!tbody) return;

  if (!lista.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">Nenhuma perícia arquivada.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const dataTxt = p.data ? formatarData(p.data) : '-';

    const tipoCor = 'background:#f1f5f9; color:#475569;';

    const responsaveis = (p.responsaveis_pericia || [])
      .map(r => r.usuarios?.nome?.split(' ')[0])
      .filter(Boolean)
      .join(', ') || '—';

    return `
      <tr>
        <td>
          <div style="font-weight:600; font-size:0.9rem;">${p.clientes?.nome || '-'}</div>
          <span class="status-badge" style="${tipoCor} font-size:0.7rem; padding:2px 8px; border-radius:12px; display:inline-block; white-space:nowrap;">Arquivada</span>
          <div style="font-size:0.75rem; color:var(--cinza-medio); margin-top:2px;">${responsaveis}</div>
        </td>
        <td style="white-space:nowrap;">
          <div style="font-size:0.9rem; font-weight:600;">${dataTxt}</div>
        </td>
        <td style="font-size:0.85rem;">${p.local || '-'}</td>
        <td style="font-size:0.85rem;">${p.perito || 'Não informado'}</td>
        <td style="text-align:right; width:90px;">
          <button class="btn-sm btn-restaurar" data-id="${p.id}" title="Restaurar">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

const aplicarFiltros = () => {
  const termoBuscaEl = document.getElementById('pericias-busca');
  const filtroTipoEl = document.getElementById('pericias-filtro-tipo');

  const termo = termoBuscaEl ? termoBuscaEl.value.trim().toLowerCase() : '';
  const tipo = filtroTipoEl ? filtroTipoEl.value : '';

  const baseAtivas = window.__listaPericiasCompleta || [];
  const baseArquivadas = window.__listaPericiasArquivadasCompleta || [];

  renderizarTabelaAtivas(filtrarPericias(baseAtivas, termo, tipo));
  renderizarTabelaArquivadas(filtrarPericias(baseArquivadas, termo, tipo));
};

// ==========================================
// MODEL + FETCH (ATIVA/ARQUIVADA)
// ==========================================
const PericiaModel = {
  async listarPorStatus(status) {
    // Relações esperadas: clientes + responsaveis_pericia(usuario_id, usuarios(nome))
    let { data, error } = await supabase
      .from('pericias')
      .select(`
        *,
        clientes(nome),
        responsaveis_pericia(usuario_id, usuarios(nome))
      `)
      .eq('status', status)
      .order('data', { ascending: true });

    // Fallback (caso relacionamento de responsaveis não exista no schema atual)
    if (error && (error.code === 'PGRST200' || error.code === 'PGRST204' || !data)) {
      const res = await supabase
        .from('pericias')
        .select('*, clientes(nome)')
        .eq('status', status)
        .order('data', { ascending: true });
      data = res.data;
      error = res.error;
    }

    if (error) throw error;
    return data || [];
  },

  async arquivar(id) {
    const { error } = await supabase
      .from('pericias')
      .update({ status: 'ARQUIVADA' })
      .eq('id', id);
    if (error) throw error;
  },

  async restaurar(id) {
    const { error } = await supabase
      .from('pericias')
      .update({ status: 'ATIVA' })
      .eq('id', id);
    if (error) throw error;
  },

  async deletar(id) {
    const { error } = await supabase.from('pericias').delete().eq('id', id);
    if (error) throw error;
  },

  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('pericias')
      .select('*, responsaveis_pericia(usuario_id, usuarios(nome))')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async carregarRelacionadosSemResponsaveis(id) {
    const { data, error } = await supabase
      .from('pericias')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  }
};

async function carregarPericiasPorStatus() {
  const [ativas, arquivadas] = await Promise.all([
    PericiaModel.listarPorStatus('ATIVA'),
    PericiaModel.listarPorStatus('ARQUIVADA')
  ]);

  window.__listaPericiasCompleta = ativas;
  window.__listaPericiasArquivadasCompleta = arquivadas;

  aplicarFiltros();
}

// Salva uma nova perícia / atualiza existente
formPericia.addEventListener('submit', async (e) => {
  e.preventDefault();

  const selecionados = seletorResp?.getSelecionados() || [];

  if (!selecionados.length) {
    showToast('Selecione ao menos um responsável.', 'error');
    return;
  }

  const periciaId = document.getElementById('pericia-id')?.value || '';
  const isEdit = !!periciaId;

  const tipo = getVal('pericia-tipo');
  const dataInput = document.getElementById('pericia-data').value;
  const horaInput = document.getElementById('pericia-hora').value;
  const dataIso = (dataInput && horaInput) ? new Date(`${dataInput}T${horaInput}:00-03:00`).toISOString() : null;

  const novaPericia = {
    cliente_id: getVal('cliente-select'),
    usuario_id: selecionados[0].id,
    data: dataIso,
    tipo: tipo,
    tribunal: getVal('pericia-tribunal'),
    vara: getVal('pericia-vara'),
    local: document.getElementById('pericia-local').value,
    perito: document.getElementById('pericia-perito').value,
  };

  let savedId = periciaId;
  let error = null;

  if (isEdit) {
    const res = await supabase.from('pericias').update(novaPericia).eq('id', periciaId);
    error = res.error;
  } else {
    const res = await supabase.from('pericias').insert(novaPericia).select().single();
    error = res.error;
    if (!error) savedId = res.data.id;
  }

  if (error) {
    console.error('Erro ao salvar perícia:', error.message, error.details, error);
    showToast('Não foi possível salvar a perícia.', 'error');
    return;
  }

  // Sincronizar responsáveis
  await supabase.from('responsaveis_pericia').delete().eq('pericia_id', savedId);
  const registrosResp = selecionados.map(u => ({ pericia_id: savedId, usuario_id: u.id }));
  const { error: errResp } = await supabase.from('responsaveis_pericia').insert(registrosResp);
  if (errResp) console.error('Erro ao salvar responsáveis da perícia:', errResp);

  showToast(isEdit ? 'Perícia atualizada com sucesso!' : 'Perícia agendada com sucesso!', 'success');
  formPericia.reset();
  formContainer.style.display = 'none';
  seletorResp?.limpar();
  carregarPericias();
});

document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggle-pericias-arquivadas');
  const bloco = document.getElementById('bloco-pericias-arquivadas');
  toggleBtn?.addEventListener('click', () => {
    const abrir = bloco.style.display === 'none';
    bloco.style.display = abrir ? 'block' : 'none';
    toggleBtn.classList.toggle('aberto', abrir);
  });

  ajustarCamposFormulario();
  await initSupabase();
  await carregarClientes();

  // Inicializar componente de responsáveis
  seletorResp = criarSeletorResponsaveis({
    inputEl: document.getElementById('pericia-responsaveis-busca'),
    dropdownEl: document.getElementById('pericia-responsaveis-dropdown'),
    tagsEl: document.getElementById('pericia-responsaveis-tags')
  });
  await seletorResp.init();

  // Cabeçalho permanece o padrão do HTML (evita divergências entre ATIVAS e ARQUIVADAS)
  await carregarPericiasPorStatus();


  // Busca local na tabela
  const termoBuscaEl = document.getElementById('pericias-busca');
  const filtroTipoEl = document.getElementById('pericias-filtro-tipo');

  termoBuscaEl?.addEventListener('input', aplicarFiltros);
  filtroTipoEl?.addEventListener('change', aplicarFiltros);

  document.getElementById('lista-pericias')?.addEventListener('click', async (e) => {

    const btnEdit = e.target.closest('.btn-edit');
    const btnView = e.target.closest('.btn-view');
    const btnDelete = e.target.closest('.btn-delete');

    if (btnEdit || btnView) {
      const id = (btnEdit || btnView).dataset.id;
      const { data, error } = await supabase
        .from('pericias')
        .select('*, responsaveis_pericia(usuario_id, usuarios(nome))')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        showToast('Erro ao carregar', 'error');
        return;
      }

      // Populate form
      document.getElementById('cliente-select').value = data.cliente_id || '';
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

      // Carregar responsáveis
      const responsaveisSelecionados = (data.responsaveis_pericia || []).map(r => ({
        id: r.usuario_id,
        nome: r.usuarios?.nome || ''
      }));
      seletorResp?.setSelecionados(responsaveisSelecionados);

      // Mode
      const isView = !!btnView;
      const inputs = formPericia.querySelectorAll('input, select');
      inputs.forEach(el => el.disabled = isView);
      seletorResp?.setDisabled(isView);
      formPericia.classList.toggle('mode-view', isView);
      document.querySelector('#form-pericia button[type="submit"]').style.display = isView ? 'none' : 'block';
      const headerH2 = document.querySelector('.modal-header h2');
      const clienteSelectEl = document.getElementById('cliente-select');
      const clienteNome = clienteSelectEl?.options?.[clienteSelectEl.selectedIndex]?.text;
      if (headerH2) {
        headerH2.textContent = isView && clienteNome && clienteNome !== 'Selecione...' && clienteNome !== '(Opcional) Selecione...'
          ? clienteNome
          : (isView ? 'Detalhes da Perícia' : 'Editar Perícia');
        headerH2.title = (isView ? clienteNome : '') || '';
      }

      // Hidden id para edição
      if (!document.getElementById('pericia-id')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'pericia-id';
        document.getElementById('form-pericia').insertBefore(hidden, document.getElementById('form-pericia').firstChild);
      }
      document.getElementById('pericia-id').value = id;

      formContainer.style.display = 'flex';
      document.getElementById('pericia-data').dispatchEvent(new Event('change'));
    }

    if (btnDelete) {
      const ok = confirm('Excluir esta perícia?');
      if (!ok) return;

      const id = btnDelete.dataset.id;
      try {
        await PericiaModel.deletar(id);
        showToast('Perícia excluída!', 'success');
        await carregarPericiasPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao excluir perícia: ' + (err?.message || err), 'error');
      }
      return;
    }

    const btnArquivar = e.target.closest('.btn-arquivar');
    if (btnArquivar) {
      const ok = confirm('Mover esta perícia para arquivadas?');
      if (!ok) return;
      try {
        await PericiaModel.arquivar(btnArquivar.dataset.id);
        showToast('Perícia arquivada!', 'success');
        await carregarPericiasPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao arquivar perícia: ' + (err?.message || err), 'error');
      }
      return;
    }

    const btnRestaurar = e.target.closest('.btn-restaurar');
    if (btnRestaurar) {
      const ok = confirm('Restaurar esta perícia para a lista de ativas?');
      if (!ok) return;
      try {
        await PericiaModel.restaurar(btnRestaurar.dataset.id);
        showToast('Perícia restaurada!', 'success');
        await carregarPericiasPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao restaurar perícia: ' + (err?.message || err), 'error');
      }
      return;
    }

  });
});