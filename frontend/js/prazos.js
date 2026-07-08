 /*
 * Lógica para a página de Prazos
 * - Carrega prazos do banco (ATIVO / ARQUIVADO)
 * - Popula select de clientes e processos
 * - Salva novos prazos e sincroniza múltiplos responsáveis via responsaveis_prazo
 * - Suporta arquivar/restaurar, editar e excluir
 */

import { supabase, initSupabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast, formatarData, formatarHora24h } from './utils.js';
import { criarSeletorResponsaveis } from './responsaveis-select.js';

const formContainer = document.getElementById('form-container');
const btnNovaPrazo = document.getElementById('btn-novo-prazo');
const btnCancelar = document.getElementById('btn-cancelar');
const formPrazo = document.getElementById('form-prazo');
const clienteSelect = document.getElementById('cliente-select');
const processoSelect = document.getElementById('processo-select');

const listaPrazos = document.getElementById('lista-prazos');

let seletorResp = null;
let processosCache = [];

// Helper para obter valor de input, tratando string vazia como null
const getVal = (id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const val = el.value.trim();
  return val === "" ? null : val;
};

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
  (data || []).forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.nome;
    clienteSelect.appendChild(option);
  });
}

async function carregarProcessos() {
  const { data, error } = await supabase
    .from('processos')
    .select('id, numero_cnj, cliente_id, clientes(nome)')
    .order('numero_cnj', { ascending: true });

  if (error) {
    console.error('Erro ao carregar processos:', error);
    return;
  }

  processosCache = data || [];

  // Inicial carrega todos (processo opcional e cliente opcional)
  processoSelect.innerHTML = '<option value="">(Opcional) Selecione...</option>';
  processosCache.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;

    const clienteNome = p.clientes?.nome;
    option.textContent = `${p.numero_cnj}${clienteNome ? ` — ${clienteNome}` : ''}`;

    processoSelect.appendChild(option);
  });
}

// Filtra opções do processo com base no cliente selecionado
function atualizarProcessosPorCliente() {
  const clienteId = clienteSelect?.value || '';
  const lista = clienteId
    ? (processosCache || []).filter(p => p.cliente_id === clienteId)
    : (processosCache || []);

  const atualValue = processoSelect?.value || '';

  processoSelect.innerHTML = '<option value="">(Opcional) Selecione...</option>';
  lista.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.numero_cnj || p.id;
    processoSelect.appendChild(option);
  });

  if (atualValue && lista.some(p => p.id === atualValue)) {
    processoSelect.value = atualValue;
  } else {
    processoSelect.value = '';
  }
}

function classeUrgencia(dataPrazoStr, status) {
  if (!dataPrazoStr) return 'prazo-verde';

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  const alvo = new Date(dataPrazoStr + 'T00:00:00');
  const diffDias = Math.ceil((alvo - hoje) / 86400000);

  const vencidoComStatusAtivo = diffDias < 0 && status === 'ATIVO';
  if (vencidoComStatusAtivo) return 'prazo-vermelho';

  if (diffDias <= 2) return 'prazo-vermelho';
  if (diffDias <= 7) return 'prazo-amarelo';
  return 'prazo-verde';
}

// ------------------------------
// Filtros e renderização
// ------------------------------
function filtrarPrazos(lista, termoBusca, tipoFiltro) {
  return (lista || []).filter((p) => {
    if (tipoFiltro && p.tipo !== tipoFiltro) return false;
    if (!termoBusca) return true;

    const descricao = (p.descricao || '').toLowerCase();
    const tipo = (p.tipo || '').toLowerCase();
    const cliente = (p.clientes?.nome || '').toLowerCase();
    const processo = (p.processos?.numero_cnj || '').toLowerCase();
    const responsaveis = (p.responsaveis_prazo || [])
      .map(r => r.usuarios?.nome || '')
      .join(' ')
      .toLowerCase();

    return [descricao, tipo, cliente, processo, responsaveis].some((v) => v.includes(termoBusca));
  });
}

function renderizarTabelaAtivas(lista) {
  const tbody = document.getElementById('lista-prazos');
  if (!tbody) return;

  const isAdmin = AuthAPI.getRole() === 'ADMIN';
  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding:0;">
          <div style="min-height:180px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--cinza-medio); gap:10px;">
            <i class="fa-regular fa-folder-open" style="font-size:2rem; opacity:0.4;"></i>
            <span style="font-size:0.9rem;">Nenhum prazo encontrado.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const clienteProc = `${p.clientes?.nome || 'N/A'}${p.processos?.numero_cnj ? ` (${p.processos.numero_cnj})` : ''}`;

    const responsaveis = (p.responsaveis_prazo || [])
      .map(r => r.usuarios?.nome?.split(' ')[0])
      .filter(Boolean)
      .join(', ') || '—';

    const urgClass = classeUrgencia(p.data_prazo, p.status);

    return `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--azul-escuro); font-size:0.95rem; word-break:break-word;">${p.descricao || '-'}</div>
          <span class="prazo-badge ${urgClass}" style="display:inline-block; margin-top:6px;">${p.tipo === 'FATAL' ? 'FATAL' : (p.tipo === 'RECURSAL' ? 'RECURSAL' : 'OUTRO')}</span>
        </td>
        <td style="white-space:nowrap;">
          <div style="font-size:0.9rem; font-weight:700;">${p.data_prazo ? formatarData(p.data_prazo) : '-'}</div>
          ${p.hora ? `<div style="font-size:0.8rem; color:var(--cinza-medio); margin-top:2px;">${formatarHora24h(p.hora)}</div>` : ''}
        </td>
        <td style="font-size:0.9rem;">
          ${clienteProc}
        </td>
        <td style="font-size:0.9rem;">
          ${responsaveis}
        </td>
        <td style="text-align:right; width:130px;">
          <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center; flex-wrap:wrap;">
            <button class="btn-sm btn-view" data-id="${p.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>

            ${p.status === 'ATIVO' ? `
              <button class="btn-sm btn-cumprir" data-id="${p.id}" title="Marcar como cumprido" style="color:#0ea5e9;">
                <i class="fa-solid fa-check"></i>
              </button>
            ` : ''}

            <button class="btn-sm btn-arquivar" data-id="${p.id}" title="Arquivar" style="color: var(--cinza-medio);">
              <i class="fa-solid fa-box-archive"></i>
            </button>

            ${isAdmin ? `
              <button class="btn-sm btn-delete" data-id="${p.id}" title="Excluir" style="color:#ef4444;">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarTabelaCumpridas(lista) {
  const tbody = document.getElementById('lista-prazos-cumpridos');
  if (!tbody) return;

  const isAdmin = AuthAPI.getRole() === 'ADMIN';

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">Nenhum prazo cumprido.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const clienteProc = `${p.clientes?.nome || 'N/A'}${p.processos?.numero_cnj ? ` (${p.processos.numero_cnj})` : ''}`;

    const responsaveis = (p.responsaveis_prazo || [])
      .map(r => r.usuarios?.nome?.split(' ')[0])
      .filter(Boolean)
      .join(', ') || '—';

    return `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--azul-escuro); font-size:0.9rem; word-break:break-word;">${p.descricao || '-'}</div>
          <div style="margin-top:6px;">
            <span class="status-badge status-cumprido" style="display:inline-block; background:#22c55e; color:#fff; padding:3px 10px; border-radius:999px; font-size:0.75rem;">Cumprido</span>
          </div>
          <div style="font-size:0.75rem; color:var(--cinza-medio); margin-top:2px;">
            ${p.tipo || ''}
          </div>
        </td>
        <td style="white-space:nowrap;">
          <div style="font-size:0.9rem; font-weight:700;">${p.data_prazo ? formatarData(p.data_prazo) : '-'}</div>
          ${p.hora ? `<div style="font-size:0.8rem; color:var(--cinza-medio); margin-top:2px;">${formatarHora24h(p.hora)}</div>` : ''}
        </td>
        <td style="font-size:0.9rem;">${clienteProc}</td>
        <td style="font-size:0.9rem;">${responsaveis}</td>
        <td style="text-align:right; width:130px;">
          <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center; flex-wrap:wrap;">
            <button class="btn-sm btn-view" data-id="${p.id}" title="Editar">
              <i class="fa-solid fa-pen"></i>
            </button>

            <button class="btn-sm btn-arquivar" data-id="${p.id}" title="Arquivar" style="color: var(--cinza-medio);">
              <i class="fa-solid fa-box-archive"></i>
            </button>

            ${isAdmin ? `
              <button class="btn-sm btn-delete" data-id="${p.id}" title="Excluir" style="color:#ef4444;">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderizarTabelaArquivadas(lista) {
  const tbody = document.getElementById('lista-prazos-arquivados');
  if (!tbody) return;

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">Nenhum prazo arquivado.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = lista.map(p => {
    const clienteProc = `${p.clientes?.nome || 'N/A'}${p.processos?.numero_cnj ? ` (${p.processos.numero_cnj})` : ''}`;

    const responsaveis = (p.responsaveis_prazo || [])
      .map(r => r.usuarios?.nome?.split(' ')[0])
      .filter(Boolean)
      .join(', ') || '—';

    return `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--azul-escuro); font-size:0.9rem; word-break:break-word;">${p.descricao || '-'}</div>
          <div style="margin-top:6px;">
            <span class="status-badge status-arquivado" style="display:inline-block;">Arquivado</span>
          </div>
          <div style="font-size:0.75rem; color:var(--cinza-medio); margin-top:2px;">
            ${p.tipo || ''}
          </div>
        </td>
        <td style="white-space:nowrap;">
          <div style="font-size:0.9rem; font-weight:700;">${p.data_prazo ? formatarData(p.data_prazo) : '-'}</div>
          ${p.hora ? `<div style="font-size:0.8rem; color:var(--cinza-medio); margin-top:2px;">${formatarHora24h(p.hora)}</div>` : ''}
        </td>
        <td style="font-size:0.9rem;">${clienteProc}</td>
        <td style="font-size:0.9rem;">${responsaveis}</td>
        <td style="text-align:right; width:90px;">
          <button class="btn-sm btn-restaurar" data-id="${p.id}" title="Restaurar">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// ------------------------------
// Model / API
// ------------------------------
const PrazoModel = {
  async listarPorStatus(status) {
    let { data, error } = await supabase
      .from('prazos')
      .select(`
        *,
        clientes(nome),
        processos(numero_cnj),
        responsaveis_prazo(usuario_id, usuarios(nome))
      `)
      .eq('status', status)
      .order('data_prazo', { ascending: true });

    if (error && (error.code === 'PGRST200' || error.code === 'PGRST204' || !data)) {
      const res = await supabase
        .from('prazos')
        .select('*, clientes(nome)')
        .eq('status', status)
        .order('data_prazo', { ascending: true });
      data = res.data;
      error = res.error;
    }

    if (error) throw error;
    return data || [];
  },

  async deletar(id) {
    const { error } = await supabase.from('prazos').delete().eq('id', id);
    if (error) throw error;
  }
};

// ------------------------------
// CRUD e sincronização
// ------------------------------
async function salvarPrazo() {
  const selecionados = seletorResp?.getSelecionados?.() || [];
  if (!selecionados.length) {
    showToast('Selecione ao menos um responsável.', 'error');
    return;
  }

  const praizoId = document.getElementById('prazo-id')?.value || '';
  const isEdit = !!praizoId;

  const descricao = getVal('prazo-descricao');
  const tipo = getVal('prazo-tipo');
  const dataPrazo = getVal('prazo-data');

  if (!descricao || !tipo || !dataPrazo) {
    showToast('Preencha descrição, tipo e data do prazo.', 'error');
    return;
  }

  const horaInput = document.getElementById('prazo-hora')?.value || null;
  const observacoes = getVal('prazo-observacoes');

  const cliente_id = getVal('cliente-select');
  const processo_id = getVal('processo-select');

  const novaPrazo = {
    descricao,
    tipo,
    data_prazo: dataPrazo,
    hora: horaInput || null,
    observacoes: observacoes || null,
    cliente_id: cliente_id || null,
    processo_id: processo_id || null,
  };

  let savedId = praizoId;

  if (isEdit) {
    const res = await supabase.from('prazos').update(novaPrazo).eq('id', praizoId);
    if (res.error) throw res.error;
  } else {
    const res = await supabase.from('prazos').insert(novaPrazo).select().single();
    if (res.error) throw res.error;
    savedId = res.data.id;
  }

  // Sincroniza responsáveis
  await supabase.from('responsaveis_prazo').delete().eq('prazo_id', savedId);
  const registrosResp = selecionados.map(u => ({ prazo_id: savedId, usuario_id: u.id }));
  const { error: errResp } = await supabase.from('responsaveis_prazo').insert(registrosResp);
  if (errResp) console.error('Erro ao salvar responsáveis do prazo:', errResp);

  showToast(isEdit ? 'Prazo atualizado com sucesso!' : 'Prazo criado com sucesso!', 'success');

  formContainer.style.display = 'none';
  formPrazo.reset();
  seletorResp?.limpar();
  await carregarPrazosPorStatus();
}

async function carregarPrazosPorStatus() {
  const [ativas, cumpridas, arquivadas] = await Promise.all([
    PrazoModel.listarPorStatus('ATIVO'),
    PrazoModel.listarPorStatus('CUMPRIDO'),
    PrazoModel.listarPorStatus('ARQUIVADO')
  ]);

  window.__listaPrazosCompleta = ativas;
  window.__listaPrazosCumpridasCompleta = cumpridas;
  window.__listaPrazosArquivadasCompleta = arquivadas;

  aplicarFiltros();
}

const aplicarFiltros = () => {
  const termoBuscaEl = document.getElementById('prazos-busca');
  const tipoFiltroEl = document.getElementById('prazos-filtro-tipo');

  const termo = termoBuscaEl ? termoBuscaEl.value.trim().toLowerCase() : '';
  const tipo = tipoFiltroEl ? tipoFiltroEl.value : '';

  const baseAtivas = window.__listaPrazosCompleta || [];
  const baseCumpridas = window.__listaPrazosCumpridasCompleta || [];
  const baseArquivadas = window.__listaPrazosArquivadasCompleta || [];

  renderizarTabelaAtivas(filtrarPrazos(baseAtivas, termo, tipo));
  renderizarTabelaCumpridas(filtrarPrazos(baseCumpridas, termo, tipo));
  renderizarTabelaArquivadas(filtrarPrazos(baseArquivadas, termo, tipo));
};

// ------------------------------
// UI: abrir modal / handlers
// ------------------------------
btnNovaPrazo?.addEventListener('click', () => {
  formContainer.style.display = 'flex';
  formPrazo.reset();

  document.querySelector('#form-prazo button[type="submit"]').style.display = 'block';
  formPrazo.classList.remove('mode-view');

  const inputs = formPrazo.querySelectorAll('input, select, textarea');
  inputs.forEach(el => el.disabled = false);

  seletorResp?.limpar();
  seletorResp?.setDisabled(false);

  document.querySelector('.modal-header h2').textContent = 'Novo Prazo';
  document.getElementById('prazo-id')?.remove?.();

  // Carrega seletores
  clienteSelect.value = '';
  processoSelect.value = '';
});

btnCancelar?.addEventListener('click', () => {
  formContainer.style.display = 'none';
  formPrazo.reset();
  seletorResp?.limpar();
  seletorResp?.setDisabled(false);
  document.getElementById('prazo-id')?.remove?.();
});

formPrazo?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await salvarPrazo();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar o prazo.', 'error');
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[prazos.js] DOMContentLoaded');
  await initSupabase();

  await carregarClientes();
  await carregarProcessos();

  // Atualiza processos ao selecionar cliente
  clienteSelect?.addEventListener('change', () => {
    atualizarProcessosPorCliente();
  });

  seletorResp = criarSeletorResponsaveis({
    inputEl: document.getElementById('prazo-responsaveis-busca'),
    dropdownEl: document.getElementById('prazo-responsaveis-dropdown'),
    tagsEl: document.getElementById('prazo-responsaveis-tags')
  });

  await seletorResp.init();

  await carregarPrazosPorStatus();

  // Toggles: abrir/fechar listas de cumpridos/arquivados
  const toggleCumpridos = document.getElementById('toggle-cumpridos');
  const blocoCumpridos = document.getElementById('bloco-cumpridos');
  const toggleArquivadas = document.getElementById('toggle-arquivadas');
  const blocoArquivadas = document.getElementById('bloco-arquivadas');

  if (toggleCumpridos && blocoCumpridos) {
    toggleCumpridos.addEventListener('click', () => {
      const estaVisivel = blocoCumpridos.style.display !== 'none';
      blocoCumpridos.style.display = estaVisivel ? 'none' : 'block';
    });
  }

  if (toggleArquivadas && blocoArquivadas) {
    toggleArquivadas.addEventListener('click', () => {
      const estaVisivel = blocoArquivadas.style.display !== 'none';
      blocoArquivadas.style.display = estaVisivel ? 'none' : 'block';
    });
  }

  // Busca local
  const termoBuscaEl = document.getElementById('prazos-busca');
  const tipoFiltroEl = document.getElementById('prazos-filtro-tipo');

  termoBuscaEl?.addEventListener('input', aplicarFiltros);
  tipoFiltroEl?.addEventListener('change', aplicarFiltros);

  document.getElementById('lista-prazos')?.addEventListener('click', async (e) => {
    console.log('[prazos.js] click lista-prazos', e.target);
    const btnView = e.target.closest('.btn-view');
    const btnDelete = e.target.closest('.btn-delete');
    const btnCumprir = e.target.closest('.btn-cumprir');
    const btnArquivar = e.target.closest('.btn-arquivar');

    if (btnView) {
      const id = btnView.dataset.id;
      const { data, error } = await supabase
        .from('prazos')
        .select(`
          *,
          responsaveis_prazo(usuario_id, usuarios(nome))
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        showToast('Erro ao carregar prazo.', 'error');
        return;
      }

      // Hidden id
      if (!document.getElementById('prazo-id')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'prazo-id';
        document.getElementById('form-prazo').insertBefore(hidden, document.getElementById('form-prazo').firstChild);
      }
      document.getElementById('prazo-id').value = id;

      document.getElementById('prazo-descricao').value = data.descricao || '';
      document.getElementById('prazo-tipo').value = data.tipo || 'OUTRO';
      document.getElementById('prazo-data').value = data.data_prazo || '';
      document.getElementById('prazo-hora').value = data.hora || '';
      document.getElementById('prazo-observacoes').value = data.observacoes || '';

      // Cliente / Processo
      clienteSelect.value = data.cliente_id || '';
      if (clienteSelect.value) {
        atualizarProcessosPorCliente();
      } else {
        processoSelect.innerHTML = '<option value="">(Opcional) Selecione...</option>';
      }

      // setar somente depois do option existir
      processoSelect.value = data.processo_id || '';

      const responsaveisSelecionados = (data.responsaveis_prazo || []).map(r => ({
        id: r.usuario_id,
        nome: r.usuarios?.nome || ''
      }));

      seletorResp?.setSelecionados?.(responsaveisSelecionados);

      formContainer.style.display = 'flex';
      document.querySelector('.modal-header h2').textContent = 'Editar Prazo';
      return;
    }

    if (btnDelete) {
      const id = btnDelete.dataset.id;
      if (!confirm('Excluir este prazo?')) return;

      try {
        await PrazoModel.deletar(id);
        showToast('Prazo excluído!', 'success');
        await carregarPrazosPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao excluir prazo.', 'error');
      }
      return;
    }

    const id = btnCumprir?.dataset?.id || btnArquivar?.dataset?.id;
    if (!id) return;

    if (btnCumprir) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const apiUrl = `${getApiUrl()}/prazos/${id}/cumprir`;
        const resp = await fetch(apiUrl, {
          method: 'PATCH',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!resp.ok) throw new Error('Falha ao marcar como cumprido.');
        showToast('Prazo marcado como cumprido!', 'success');
        await carregarPrazosPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao marcar como cumprido.', 'error');
      }
      return;
    }

    if (btnArquivar) {
      if (!confirm('Arquivar este prazo?')) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const apiUrl = `${getApiUrl()}/prazos/${id}/arquivar`;
        const resp = await fetch(apiUrl, {
          method: 'PATCH',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!resp.ok) throw new Error('Falha ao arquivar.');
        showToast('Prazo arquivado!', 'success');
        await carregarPrazosPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao arquivar prazo.', 'error');
      }
    }
  });

  // Eventos para tabela de Prazos Cumpridos
  document.getElementById('lista-prazos-cumpridos')?.addEventListener('click', async (e) => {
    console.log('[prazos.js] click lista-prazos-cumpridos', e.target);
    const btnView = e.target.closest('.btn-view');
    const btnDelete = e.target.closest('.btn-delete');
    const btnArquivar = e.target.closest('.btn-arquivar');

    if (btnView) {
      const id = btnView.dataset.id;
      const { data, error } = await supabase
        .from('prazos')
        .select(`
          *,
          responsaveis_prazo(usuario_id, usuarios(nome))
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        showToast('Erro ao carregar prazo.', 'error');
        return;
      }

      // Hidden id
      if (!document.getElementById('prazo-id')) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'prazo-id';
        document.getElementById('form-prazo').insertBefore(hidden, document.getElementById('form-prazo').firstChild);
      }
      document.getElementById('prazo-id').value = id;

      document.getElementById('prazo-descricao').value = data.descricao || '';
      document.getElementById('prazo-tipo').value = data.tipo || 'OUTRO';
      document.getElementById('prazo-data').value = data.data_prazo || '';
      document.getElementById('prazo-hora').value = data.hora || '';
      document.getElementById('prazo-observacoes').value = data.observacoes || '';

      // Cliente / Processo
      clienteSelect.value = data.cliente_id || '';
      if (clienteSelect.value) {
        atualizarProcessosPorCliente();
      } else {
        processoSelect.innerHTML = '<option value="">(Opcional) Selecione...</option>';
      }

      processoSelect.value = data.processo_id || '';

      const responsaveisSelecionados = (data.responsaveis_prazo || []).map(r => ({
        id: r.usuario_id,
        nome: r.usuarios?.nome || ''
      }));

      seletorResp?.setSelecionados?.(responsaveisSelecionados);

      formContainer.style.display = 'flex';
      document.querySelector('.modal-header h2').textContent = 'Editar Prazo';
      return;
    }

    if (btnDelete) {
      const id = btnDelete.dataset.id;
      if (!confirm('Excluir este prazo?')) return;
      try {
        await PrazoModel.deletar(id);
        showToast('Prazo excluído!', 'success');
        await carregarPrazosPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao excluir prazo.', 'error');
      }
      return;
    }

    if (btnArquivar) {
      const id = btnArquivar.dataset.id;
      if (!id) return;
      if (!confirm('Arquivar este prazo?')) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const apiUrl = `${getApiUrl()}/prazos/${id}/arquivar`;
        const resp = await fetch(apiUrl, {
          method: 'PATCH',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!resp.ok) throw new Error('Falha ao arquivar.');
        showToast('Prazo arquivado!', 'success');
        await carregarPrazosPorStatus();
      } catch (err) {
        console.error(err);
        showToast('Erro ao arquivar prazo.', 'error');
      }
    }
  });

  document.getElementById('lista-prazos-arquivados')?.addEventListener('click', async (e) => {
    if (!btnRestaurar) return;

    const id = btnRestaurar.dataset.id;
    if (!id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const apiUrl = `${getApiUrl()}/prazos/${id}/restaurar`;
      const resp = await fetch(apiUrl, {
        method: 'PATCH',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!resp.ok) throw new Error('Falha ao restaurar.');
      showToast('Prazo restaurado!', 'success');
      await carregarPrazosPorStatus();
    } catch (err) {
      console.error(err);
      showToast('Erro ao restaurar prazo.', 'error');
    }
  });
});
