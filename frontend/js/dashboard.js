/*
 * Lógica do Dashboard (Tela Inicial)
 * Carrega KPIs e informações gerais
 */

import { supabase, initSupabase } from './supabase.js';

async function carregarDashboard() {
  // Garante inicialização do client antes de qualquer consulta
  await initSupabase();
  const hoje = new Date();
  const hora = hoje.getHours();
  
  // 1. Saudação dinâmica
  let saudacao = 'Bom dia';
  if (hora >= 12) saudacao = 'Boa tarde';
  if (hora >= 18 || hora < 5) saudacao = 'Boa noite';
  
  const elSaudacao = document.getElementById('saudacao');
  const userName = localStorage.getItem('userName');
  if (elSaudacao) {
    elSaudacao.textContent = userName ? `${saudacao}, ${userName}` : `${saudacao}, Bem-vindo(a)`;
  }

  // 2. Data formatada
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dataFormatada = hoje.toLocaleDateString('pt-BR', options);
  
  const elData = document.getElementById('data-atual');
  if (elData) elData.textContent = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  try {
    // Datas para filtros (Hoje e Prazo)
    const agora = new Date();
    const inicioDia = agora.toISOString().split('T')[0] + 'T00:00:00';
    const fimDia = agora.toISOString().split('T')[0] + 'T23:59:59';
    const hojeStr = agora.toISOString().split('T')[0];

    const daqui7Dias = new Date();
    daqui7Dias.setDate(agora.getDate() + 7);
    const daqui7DiasStr = daqui7Dias.toISOString().split('T')[0];

    // Carregamento paralelo de KPIs e Listas
    const [resProcessos, resClientes, resAudienciasHoje, resRecentes, resPrazos, resAudiencias7Dias, resPericias7Dias, resAtendimentos7Dias, resStatusProcessos] = await Promise.all([
      // KPI Processos Ativos
      supabase.from('processos').select('*', { count: 'exact', head: true }).eq('status', 'ATIVO'),

      // KPI Clientes
      supabase.from('clientes').select('*', { count: 'exact', head: true }),
      
      // KPI Audiencias Hoje
      supabase.from('audiencias').select('*', { count: 'exact', head: true }).gte('data', inicioDia).lte('data', fimDia), // Renamed to resAudienciasHoje
      
      // Lista: Últimos 7 Processos para uma visão mais ampla
      supabase.from('processos')
        .select('id, numero_cnj, status, criado_em, clientes(nome)')
        .order('criado_em', { ascending: false })
        .limit(7),

      // KPI Prazos: Conta publicações que possuem data de prazo futura ou hoje
      supabase.from('publicacoes')
        .select('*', { count: 'exact', head: true })
        .not('prazo_data', 'is', null)
        .gte('prazo_data', hojeStr),

      // Proximas Audiencias (7 dias)
      supabase.from('audiencias').select('*, clientes(nome), processos(numero_cnj)').gte('data', inicioDia).lte('data', daqui7DiasStr).order('data', { ascending: true }),

      // Proximas Pericias (7 dias)
      supabase.from('pericias').select('*, clientes(nome), processos(numero_cnj)').gte('data', inicioDia).lte('data', daqui7DiasStr).order('data', { ascending: true }),

      // Proximos Atendimentos/Reunioes (7 dias)
      supabase.from('atendimentos').select('*, clientes(nome)').gte('data', inicioDia).lte('data', daqui7DiasStr).order('data', { ascending: true }),

      // Estatisticas de Processos para Carga de Trabalho
      supabase.from('processos').select('status')
    ]);

    // Função auxiliar para atualizar KPIs sem quebrar o script se o elemento não existir no HTML
    const atualizarKPI = (id, valor) => {
      const el = document.getElementById(id);
      if (el) el.textContent = valor;
    };

    atualizarKPI('kpi-processos', resProcessos.count || 0);
    atualizarKPI('kpi-clientes', resClientes.count || 0);
    atualizarKPI('kpi-audiencias', resAudienciasHoje.count || 0);
    atualizarKPI('kpi-prazos', resPrazos.count || 0);

    // Atualiza Tabela de Recentes
    const tbody = document.getElementById('lista-recentes');
    if (resRecentes.data && resRecentes.data.length > 0) {
      tbody.innerHTML = resRecentes.data.map(p => `
        <tr>
          <td>
            <strong>${p.clientes?.nome || 'Sem cliente'}</strong>
            <span class="text-muted">${p.numero_cnj || 'S/N'}</span>
          </td>
          <td><span class="status-badge status-${p.status?.toLowerCase() || 'ativo'}">${p.status || 'ATIVO'}</span></td>
          <td>${new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
          <td><a href="processo-detalhe.html?id=${p.id}" class="btn-sm">Ver</a></td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center" style="padding: 20px; color: var(--cinza-medio);">
            <i class="fa-solid fa-folder-open" style="margin-bottom: 5px;"></i><br>
            Nenhum processo recente.
          </td>
        </tr>
      `;
    }
    
    // 4. Renderiza Proximos Eventos (7 dias)
    let proximosEventosContainer = document.getElementById('proximos-eventos-container');
    if (!proximosEventosContainer) {
      const grid = document.querySelector('.dashboard-content-grid');
      if (grid) {
        const card = document.createElement('div');
        card.className = 'card-section';
        card.innerHTML = `<h2>Próximos 7 Dias</h2><div id="proximos-eventos-container"></div>`;
        grid.appendChild(card);
        proximosEventosContainer = document.getElementById('proximos-eventos-container');
      }
    }
    
    // 5. Renderiza Carga de Trabalho (Nova Funcionalidade)
    const dashboardGrid = document.querySelector('.dashboard-content-grid');
    if (dashboardGrid && resStatusProcessos.data) {
      const stats = resStatusProcessos.data.reduce((acc, curr) => {
        acc[curr.status] = (acc[curr.status] || 0) + 1;
        return acc;
      }, {});
      
      const total = resStatusProcessos.data.length;
      renderizarCargaTrabalho(dashboardGrid, stats, total);
    }

    if (proximosEventosContainer) {
       let eventos7Dias = [];

      if (resAudiencias7Dias.data) {
        resAudiencias7Dias.data.forEach(a => eventos7Dias.push({
          tipo: 'AUDIÊNCIA',
          data: a.data,
          titulo: `Audiência: ${a.tipo || 'Geral'}`,
          cliente: a.clientes?.nome || a.processos?.clientes?.nome || 'N/A',
          processo: a.processos?.numero_cnj || 'N/A'
        }));
      }
      if (resPericias7Dias.data) {
        resPericias7Dias.data.forEach(p => eventos7Dias.push({
          tipo: 'PERÍCIA',
          data: p.data,
          titulo: `Perícia ${p.tipo || ''}: ${p.perito || 'Técnica'}`,
          cliente: p.clientes?.nome || p.processos?.clientes?.nome || 'N/A',
          processo: p.processos?.numero_cnj || 'N/A'
        }));
      }
      if (resAtendimentos7Dias.data) {
        resAtendimentos7Dias.data.forEach(r => eventos7Dias.push({
          tipo: 'REUNIÃO',
          data: r.data,
          titulo: `Reunião com ${r.clientes?.nome || 'Cliente'}`,
          cliente: r.clientes?.nome || 'N/A',
          processo: 'N/A'
        }));
      }

      // Ordena por data
      eventos7Dias.sort((a, b) => new Date(a.data) - new Date(b.data));

      if (eventos7Dias.length > 0) {
        proximosEventosContainer.innerHTML = `
          <div class="table-responsive">
            <table class="recent-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th>Cliente/Processo</th>
                </tr>
              </thead>
              <tbody>
                ${eventos7Dias.map(evt => `
                  <tr>
                    <td>${new Date(evt.data).toLocaleDateString('pt-BR')} ${new Date(evt.data).toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</td>
                    <td><span class="status-badge ${evt.tipo === 'AUDIÊNCIA' ? 'icon-blue' : (evt.tipo === 'REUNIÃO' ? 'icon-green' : 'icon-purple')}">${evt.tipo}</span> ${evt.titulo}</td>
                    <td>${evt.cliente} ${evt.processo !== 'N/A' ? `(${evt.processo})` : ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      } else {
        proximosEventosContainer.innerHTML = `<div class="card-section" style="text-align: center; padding: 20px; color: var(--cinza-medio);">Nenhum evento agendado para os próximos 7 dias.</div>`;
      }
    }

    // Limpeza de UI: Remove links de documentos do dashboard
    document.querySelectorAll('.quick-actions a, .action-card').forEach(link => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent.toLowerCase();
      if (href.includes('documentos.html') || text.includes('documentos')) {
        link.remove();
      }
    });

  } catch (error) {
    console.error('Erro carregando dashboard:', error);
  }
}

/**
 * Renderiza um resumo visual da carga de trabalho do escritório
 */
function renderizarCargaTrabalho(container, stats, total) {
  let cardWorkload = document.getElementById('card-carga-trabalho');
  if (!cardWorkload) {
    cardWorkload = document.createElement('div');
    cardWorkload.id = 'card-carga-trabalho';
    cardWorkload.className = 'card-section';
    container.prepend(cardWorkload);
  }

  const statuses = Object.keys(stats);
  const htmlBars = statuses.map(s => {
    const percent = total > 0 ? (stats[s] / total) * 100 : 0;
    return `
      <div class="workload-item">
        <div class="workload-label"><span>${s}</span><span>${stats[s]}</span></div>
        <div class="workload-bar-bg"><div class="workload-bar-fill" style="width: ${percent}%"></div></div>
      </div>
    `;
  }).join('');

  cardWorkload.innerHTML = `
    <h2>Carga de Trabalho (Processos)</h2>
    <div class="workload-container">${htmlBars}</div>
  `;
}

// Carrega apenas se estiver na página de dashboard
if (document.getElementById('kpi-processos')) {
  document.addEventListener('DOMContentLoaded', carregarDashboard);
}