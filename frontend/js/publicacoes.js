/*
 * Módulo Publicações (Integração Escavador)
 * Exibição de feed de diários, prazos e alertas
 */

import { supabase } from './supabase.js';
import { AuthAPI } from './auth.js';
import { showToast } from './utils.js';

const PublicacoesView = {
  container: document.getElementById('view-publicacoes-container'),

  init() {
    this.container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Publicações & Intimações</h1>
          <p>Monitoramento automático de diários oficiais via Judit.</p>
        </div>
        <button id="btn-sincronizar" class="btn btn-primary">
          <i class="fa-solid fa-rotate"></i> Sincronizar Agora
        </button>
      </div>

      <div class="kpi-grid" style="margin-bottom: 30px;">
        <div class="kpi-card">
          <div class="kpi-icon icon-orange"><i class="fa-solid fa-clock"></i></div>
          <div><span class="kpi-value" id="kpi-prazos">0</span><span class="kpi-sub">Prazos em Aberto</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon icon-blue"><i class="fa-solid fa-newspaper"></i></div>
          <div><span class="kpi-value" id="kpi-hoje">0</span><span class="kpi-sub">Publicações Hoje</span></div>
        </div>
      </div>

      <div id="feed-publicacoes" style="display: grid; gap: 20px;">
        <div class="text-center" style="padding: 40px; color: var(--cinza-medio);">Carregando publicações...</div>
      </div>
    `;
  },

  // Função principal para desenhar os cards
  renderizarFeed(lista) {
    const feed = document.getElementById('feed-publicacoes');
    
    if (!lista || lista.length === 0) {
      feed.innerHTML = `<div class="card-section text-center"><p>Nenhuma publicação encontrada.</p></div>`;
      return;
    }

    feed.innerHTML = lista.map(pub => {
      const prazoInfo = this.gerarHtmlPrazo(pub);
      
      return `
        <div class="card-section" style="padding: 24px; border-left: 4px solid var(--azul-medio);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <div style="font-weight: 700; color: var(--azul-escuro); font-size: 1.1rem; margin-bottom: 4px;">
                <i class="fa-solid fa-gavel text-muted" style="display:inline; margin-right:8px;"></i>
                ${pub.numero_cnj || 'Sem numeração CNJ'}
              </div>
              <small class="text-muted">
                ${pub.diario} | Publicado em: ${new Date(pub.data_publicacao).toLocaleDateString('pt-BR')}
              </small>
            </div>
            <span class="status-badge" style="background: #e2e8f0; color: #475569;">
              ${pub.prazo_responsavel || 'Geral'}
            </span>
          </div>

          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; font-family: monospace; font-size: 0.9rem; color: #334155; margin-bottom: 16px; white-space: pre-wrap; max-height: 150px; overflow-y: auto;">
            ${pub.conteudo}
          </div>

          ${prazoInfo}
        </div>
      `;
    }).join('');
    
    // Atualiza KPIs simples
    if (document.getElementById('kpi-hoje')) document.getElementById('kpi-hoje').textContent = lista.filter(p => new Date(p.data_publicacao).toDateString() === new Date().toDateString()).length;
    if (document.getElementById('kpi-prazos')) document.getElementById('kpi-prazos').textContent = lista.filter(p => p.prazo_data).length;
  },

  gerarHtmlPrazo(pub) {
    if (!pub.prazo_data) {
      return `
        <div style="display: flex; gap: 12px; align-items: center; color: var(--cinza-medio);">
          <i class="fa-regular fa-calendar"></i>
          <span>Prazo não identificado automaticamente.</span>
        </div>
      `;
    }

    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    const dataLimite = new Date(pub.prazo_data);
    dataLimite.setHours(0,0,0,0);

    // Diferença em dias corridos (simplificado para exibição visual)
    const diffTime = dataLimite - hoje;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let corBadge = 'prazo-verde';
    let textoBadge = `${diffDays} dias restantes`;

    if (diffDays < 0) {
      corBadge = 'prazo-vermelho';
      textoBadge = 'VENCIDO';
    } else if (diffDays <= 2) {
      corBadge = 'prazo-vermelho';
      textoBadge = diffDays === 0 ? 'Vence HOJE' : `${diffDays} dia(s)`;
    } else if (diffDays <= 5) {
      corBadge = 'prazo-amarelo';
    }

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid var(--cinza-borda); padding: 12px; border-radius: 8px;">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="background: var(--azul-claro); padding: 8px; border-radius: 50%; color: var(--azul-medio);">
            <i class="fa-solid fa-clock"></i>
          </div>
          <div>
            <div style="font-weight: 600; color: var(--azul-escuro);">Prazo de ${pub.prazo_dias} dias úteis</div>
            <div style="font-size: 0.9rem;">Vence em: <strong>${dataLimite.toLocaleDateString('pt-BR')}</strong></div>
          </div>
        </div>
        <span class="status-badge ${corBadge}">${textoBadge}</span>
      </div>
    `;
  },

  setLoading(loading) {
    const btn = document.getElementById('btn-sincronizar');
    if (loading) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
    } else {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Sincronizar Agora';
    }
  }
};

const PublicacoesController = {
  async init() {
    // Proteção extra
    if (AuthAPI.getRole() !== 'ADMIN') {
      window.location.href = 'dashboard.html';
      return;
    }

    PublicacoesView.init();
    this.carregarDados();

    document.getElementById('btn-sincronizar').onclick = () => this.sincronizar();
  },

  async carregarDados() {
    const { data, error } = await supabase
      .from('publicacoes')
      .select('*')
      .order('data_publicacao', { ascending: false });
    
    if (error) showToast('Erro ao carregar feed: ' + error.message, 'error');
    else PublicacoesView.renderizarFeed(data);
  },

  async sincronizar() {
    PublicacoesView.setLoading(true);
    try {
      // Chama rota do backend (requer token JWT no header)
      // Como estamos no front puro, precisamos passar o token da sessão
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('http://localhost:3001/api/publicacoes/sincronizar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      // Verifica se a resposta é JSON válido antes de tentar parsear
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("O servidor retornou uma resposta inválida (provavelmente HTML de erro). Verifique o terminal do backend.");
      }

      const json = await res.json();
      if (res.ok) {
        showToast(`Sincronização completa. ${json.detalhes?.total || 0} processados.`, 'success');
        this.carregarDados();
      } else {
        // Tratamento de erro mais amigável
        const msgErro = json.error || 'Erro desconhecido';
        
        if (msgErro.includes('Token')) {
            showToast('Erro: Token do Judit ausente no backend (JUDIT_API_TOKEN)', 'error');
        } else if (msgErro.includes('Sem monitoramentos')) {
            showToast('Aviso: Nenhuma publicação encontrada na conta Judit.', 'warning');
        } 
        else showToast('Erro na sincronização: ' + msgErro, 'error');
      }
    } catch (error) {
      console.error(error);
      showToast(error.message, 'error');
    } finally {
      PublicacoesView.setLoading(false);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => PublicacoesController.init());