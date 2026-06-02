/*
 * Detalhe processo com audiências + perícias
 * Carrega dados relacionados (cliente, advogado)
 */

import { supabase } from './supabase.js';

const urlParams = new URLSearchParams(window.location.search);
const processoId = urlParams.get('id');

if (!processoId) {
  alert('ID do processo necessário. Retornando à lista.');
  window.location.href = 'processos.html';
  return;
}

async function carregarProcesso() {
  const { data, error } = await supabase
    .from('processos')
    .select(`
      *,
      clientes(nome),
      usuarios(nome)
    `)
    .eq('id', processoId)
    .single();
  
  if (error || !data) {
    alert('Processo não encontrado');
    return;
  }
  
  document.getElementById('numero-cnj-detalhe').textContent = data.numero_cnj;
  document.getElementById('status-detalhe').textContent = data.status;
  document.getElementById('status-detalhe').className = `status-badge status-${data.status.toLowerCase()}`;
  document.getElementById('tribunal-detalhe').textContent = data.tribunal || '-';
  document.getElementById('vara-detalhe').textContent = data.vara || '-';
  document.getElementById('cliente-nome').textContent = data.clientes?.nome || '-';
  document.getElementById('advogado-nome').textContent = data.usuarios?.nome || '-';
  document.getElementById('criado-em').textContent = new Date(data.criado_em).toLocaleDateString('pt-BR');
  
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('processo-detalhe').style.display = 'block';
  
  carregarAudiencias();
  carregarPericias();
}

async function carregarAudiencias() {
  const { data } = await supabase
    .from('audiencias')
    .select('*')
    .eq('processo_id', processoId);
  
  const container = document.getElementById('lista-audiencias');
  if (!data || data.length === 0) {
    container.innerHTML = '<p>Nenhuma audiência cadastrada</p>';
    return;
  }
  
  container.innerHTML = data.map(a => `
    <div class="evento-item">
      <div class="evento-data">${new Date(a.data).toLocaleDateString('pt-BR')}</div>
      <div class="evento-tipo">${a.tipo}</div>
      <div class="evento-local">${a.local}</div>
    </div>
  `).join('');
}

async function carregarPericias() {
  // Similar audiencias...
}

document.addEventListener('DOMContentLoaded', carregarProcesso);
