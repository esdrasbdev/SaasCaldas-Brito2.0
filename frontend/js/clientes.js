/*
 * Módulo Clientes - Arquitetura MVC
 * Separação clara entre Dados (Supabase), Interface (DOM) e Regras de Negócio
 */

import { supabase, initSupabase, getApiUrl } from './supabase.js';

import { AuthAPI } from './auth.js';
import { showToast } from './utils.js'; // Novo sistema de avisos

// ==========================================
// 1. MODEL (Gerencia Dados e Banco)
// ==========================================
const ClienteModel = {
  async listarTodos() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    return data;
  },

  async buscarPorId(id) {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async criar(cliente) {
    const { data, error } = await supabase
      .from('clientes')
      .insert([cliente])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async atualizar(id, dados) {
    const { data, error } = await supabase
      .from('clientes')
      .update(dados)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deletar(id) {
    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  async listarDocumentos(clienteId) {
    // Busca o token atualizado da sessão para evitar erro 401
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${getApiUrl()}/documentos?cliente_id=${clienteId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 401) {
      // evita poluir UI com aviso; 401 pode ocorrer durante carregamentos assíncronos
      return [];
    }

    if (!res.ok) throw new Error('Falha ao buscar documentos');
    return await res.json();
  }
};

// ==========================================
// 2. VIEW (Gerencia o HTML e Exibição)
// ==========================================
const ClienteView = {
  elementos: {
    tabelaContainer: document.getElementById('view-tabela-container'),
    modal: document.getElementById('modal-container'),
    form: document.getElementById('form-cliente'),
    tituloModal: document.getElementById('modal-titulo'),
    btnNovo: document.getElementById('btn-novo-cliente'),
    btnCancelar: document.getElementById('btn-cancelar'),
    inputBusca: null // Criado dinamicamente
  },

  init() {
    // Renderiza estrutura base da tabela com busca
    this.elementos.tabelaContainer.innerHTML = `
      <div class="card-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>Base de Clientes</h2>
          <input type="text" id="busca-cliente" placeholder="Buscar por nome ou CPF..." style="max-width: 300px;">
        </div>
        <div class="table-responsive">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Contato</th>
                <th style="text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody id="lista-clientes-body">
              <tr><td colspan="4" class="text-center">Carregando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    this.elementos.inputBusca = document.getElementById('busca-cliente');
  },

  renderizarTabela(clientes) {
    const tbody = document.getElementById('lista-clientes-body');
    const isAdmin = AuthAPI.getRole() === 'ADMIN';

    if (!clientes || clientes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center" style="padding: 30px; color: var(--cinza-medio);">
            <i class="fa-solid fa-folder-open"></i> Nenhum cliente encontrado.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = clientes.map(c => `
      <tr>
        <td>
          <div style="display: flex; flex-direction: column;">
            <span style="font-weight: 600; color: var(--azul-escuro);">${c.nome}</span>
            <span style="font-size: 0.75rem; color: var(--cinza-medio); margin-top: 2px;">
              ${c.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
              ${c.usuarios?.nome ? `• Criado por <strong>${c.usuarios.nome.split(' ')[0]}</strong>` : ''}
            </span>
          </div>
        </td>
        <td>${c.documento || '-'}</td>
        <td>
          <div><i class="fa-solid fa-envelope" style="font-size: 0.8em;"></i> ${c.email || '-'}</div>
          <div><i class="fa-solid fa-phone" style="font-size: 0.8em;"></i> ${c.telefone || '-'}</div>
        </td>
        <td style="text-align: right;">
          <button class="btn-sm btn-view" data-id="${c.id}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
          <button class="btn-sm btn-edit" data-id="${c.id}" title="Editar"><i class="fa-solid fa-pen"></i></button>
          ${isAdmin ? `<button class="btn-sm btn-delete" data-id="${c.id}" title="Excluir" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>` : ''}
        </td>
      </tr>
    `).join('');
  },

  abrirModal(cliente = null, visualizacao = false) {
    if (visualizacao && cliente?.nome) {
      this.elementos.tituloModal.textContent = cliente.nome;
    } else {
      this.elementos.tituloModal.textContent = visualizacao ? 'Visualizar Cliente' : (cliente ? 'Editar Cliente' : 'Novo Cliente');
    }

    const tituloEl = this.elementos.tituloModal;
    tituloEl.title = cliente?.nome || '';
    tituloEl.style.cssText = `
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: calc(100% - 56px);
      display: block;
    `;

    this.elementos.form.reset();

    if (visualizacao) {
      this.elementos.form.classList.add('mode-view');
    } else {
      this.elementos.form.classList.remove('mode-view');
    }

    const modalHeader = this.elementos.modal.querySelector('.modal-header');
    const modalBody = this.elementos.modal.querySelector('.modal-body');
    const modalFooter = this.elementos.modal.querySelector('.modal-footer');

    if (modalHeader && !modalHeader.querySelector('.btn-close-modal')) {
      modalHeader.style.display = 'flex';
      modalHeader.style.justifyContent = 'space-between';
      modalHeader.style.alignItems = 'center';

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn-close-modal';
      closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      closeBtn.style.cssText = 'background:none; border:none; color:var(--cinza-medio); cursor:pointer; font-size:1.4rem; padding:5px; transition: color 0.2s;';
      closeBtn.onmouseover = () => closeBtn.style.color = '#ef4444';
      closeBtn.onmouseout = () => closeBtn.style.color = 'var(--cinza-medio)';
      closeBtn.onclick = () => this.fecharModal();
      modalHeader.appendChild(closeBtn);
    }

    const inputs = this.elementos.form.querySelectorAll('input, select');
    inputs.forEach(el => {
      el.disabled = visualizacao;
      el.classList.remove('input-error');
    });

    let containerDocs = document.getElementById('documentos-lista-container');
    if (!containerDocs) {
      containerDocs = document.createElement('div');
      containerDocs.id = 'documentos-lista-container';
    }

    if (modalBody) {
      containerDocs.innerHTML = '';
      modalBody.appendChild(containerDocs);
    }


    containerDocs.style.marginTop = '20px';
    containerDocs.style.borderTop = '2px solid var(--azul-claro)';

    const btnSalvar = this.elementos.form.querySelector('button[type="submit"]');
    if (btnSalvar) btnSalvar.style.display = visualizacao ? 'none' : 'block';

    document.getElementById('cliente-id').value = '';

    if (cliente) {
      document.getElementById('cliente-id').value = cliente.id;
      document.getElementById('cliente-nome').value = cliente.nome;
      document.getElementById('cliente-tipo').value = cliente.tipo || 'PF';
      document.getElementById('cliente-documento').value = cliente.documento || '';
      document.getElementById('cliente-rg').value = cliente.rg || '';
      document.getElementById('cliente-email').value = cliente.email || '';
      document.getElementById('cliente-telefone').value = cliente.telefone || '';

      document.getElementById('cliente-nacionalidade').value = cliente.nacionalidade || '';
      document.getElementById('cliente-estado-civil').value = cliente.estado_civil || '';
      document.getElementById('cliente-profissao').value = cliente.profissao || '';
      document.getElementById('cliente-cep').value = cliente.cep || '';
      document.getElementById('cliente-endereco').value = cliente.endereco || '';
      document.getElementById('cliente-numero').value = cliente.numero || '';
      document.getElementById('cliente-bairro').value = cliente.bairro || '';
      document.getElementById('cliente-cidade').value = cliente.cidade || '';
      document.getElementById('cliente-estado').value = cliente.estado || '';

      const advogadoSelect = document.getElementById('cliente-advogado');
      if (advogadoSelect) {
        const advId = cliente.advogado_id ?? '';
        advogadoSelect.value = String(advId);
        const hasOption = Array.from(advogadoSelect.options).some(o => String(o.value) === String(advId));
        if (!hasOption) advogadoSelect.value = '';
      }

      document.getElementById('cliente-inss-senha').value = cliente.inss_senha || '';
      document.getElementById('cliente-inss-cpf').value = cliente.documento || '';

      this.renderizarSessaoDocumentos(cliente.id, visualizacao);
      containerDocs.style.order = '99';
    } else {
      document.getElementById('cliente-inss-cpf').value = '';
      this.renderizarSessaoDocumentos(null, false);
    }

    this.elementos.modal.style.display = 'flex';
  },

  async renderizarSessaoDocumentos(clienteId, visualizacao) {
    const container = document.getElementById('documentos-lista-container');
    if (!container) return;

    container.innerHTML = '';

    if (!clienteId) {
      container.innerHTML = `
        <div style="padding-top: 15px;">
          <h3 style="font-size: 1rem; color: var(--azul-medio); margin-bottom: 10px; border-bottom: 2px solid var(--azul-claro); padding-bottom: 5px;">
            <i class="fa-solid fa-file-lines"></i> Documentos Jurídicos
          </h3>
          <div style="background: var(--azul-claro); color: var(--azul-medio); padding: 15px; border-radius: 8px; text-align: center; font-size: 0.9rem; font-weight: 500;">
            <i class="fa-solid fa-circle-info"></i> Para gerar documentos, primeiro salve os dados básicos do cliente.
          </div>
        </div>`;
      return;
    }

    this.renderizarDocumentosJuridicos(container, clienteId, visualizacao);
  },

  fecharModal() {
    this.elementos.modal.style.display = 'none';
    this.elementos.form.reset();
  },

  mostrarErro(msg) {
    showToast(msg, 'error');
  },

  // ==========================================
  // Central de Documentos Jurídicos (jsPDF download)
  // ==========================================
  renderizarDocumentosJuridicos(container, clienteId, visualizacao) {
    if (!clienteId) return;

    const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

    const dadosCliente = {
      nomeCompleto: getVal('cliente-nome'),
      cpf: getVal('cliente-documento'),
      rg: getVal('cliente-rg'),
      estadoCivil: getVal('cliente-estado-civil'),
      profissao: getVal('cliente-profissao'),
      telefone: getVal('cliente-telefone'),
      email: getVal('cliente-email'),
      endereco: [getVal('cliente-endereco'), getVal('cliente-numero'), getVal('cliente-bairro')]
        .filter(Boolean)
        .join(', '),
      cidade: getVal('cliente-cidade'),
      estado: getVal('cliente-estado'),
      cep: getVal('cliente-cep'),
      numero: getVal('cliente-numero'),
      bairro: getVal('cliente-bairro')
    };

    const modelos = [
      { chave: 'procuracao',                  icone: 'fa-solid fa-scroll',            titulo: 'Procuração' },
      { chave: 'contrato-honorarios',         icone: 'fa-solid fa-file-signature',    titulo: 'Contrato de Honorários' },
      { chave: 'declaracao-hipossuficiencia', icone: 'fa-solid fa-scale-unbalanced',  titulo: 'Decl. de Hipossuficiência' },
      { chave: 'declaracao-residencia',       icone: 'fa-solid fa-house',             titulo: 'Declaração de Residência' },
      { chave: 'termo-responsabilidade',      icone: 'fa-solid fa-shield-halved',     titulo: 'Termo de Responsabilidade' },
      { chave: 'termo-renuncio',              icone: 'fa-solid fa-file-circle-minus', titulo: 'Termo de Renúncia (JEF)' }
    ];

    const blocoId = 'documentos-juridicos-section';
    let bloco = document.getElementById(blocoId);
    if (!bloco) {
      bloco = document.createElement('div');
      bloco.id = blocoId;
      bloco.style.cssText = 'margin-top:18px; border-top:2px solid var(--azul-claro);';
      container.appendChild(bloco);
    }

    bloco.innerHTML = `
      <div style="padding-top:15px;">
        <h3 style="font-size:1rem; color:var(--cinza-escuro); margin-bottom:14px;
                   border-bottom:2px solid var(--cinza-borda); padding-bottom:6px;">
          <i class="fa-solid fa-file-lines"></i> Documentos Jurídicos
        </h3>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(240px,1fr)); gap:10px;">
          ${modelos.map(m => `
            <div style="display:flex; align-items:flex-start; justify-content:space-between;
                        padding:10px 14px; border:1px solid var(--cinza-borda);
                        border-radius:8px; background:var(--branco);">
              <div style="display:flex; align-items:flex-start; gap:10px; min-width:0;">
                <i class="${m.icone}" style="color:var(--cinza-medio); font-size:1rem; flex-shrink:0; margin-top:2px;"></i>
                <span style="font-size:0.85rem; font-weight:600; color:var(--cinza-escuro); word-break:break-word; line-height:1.35;">
                  ${m.titulo}
                </span>
              </div>
              <button
                class="btn-gj-baixar"
                data-chave="${m.chave}"
                type="button"
                title="Baixar PDF"
                style="flex-shrink:0; margin-left:10px; padding:5px 10px;
                       font-size:0.8rem; border:1px solid var(--cinza-borda);
                       border-radius:5px; background:var(--branco); cursor:pointer;
                       color:var(--cinza-escuro); display:flex; align-items:center; gap:5px;"
              >
                <i class="fa-solid fa-download"></i> PDF
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    bloco.onclick = async (ev) => {
      const btn = ev.target.closest('.btn-gj-baixar');
      if (!btn) return;

      const chave = btn.getAttribute('data-chave') || btn.dataset.chave;
      if (!chave) {
        showToast('Documento inválido para geração de PDF.', 'error');
        return;
      }

      try {
        await this.baixarDocumentoPDF(chave, dadosCliente);
      } catch (err) {
        console.error(err);
        showToast('Erro ao gerar o PDF.', 'error');
      }
    };
  },

  async baixarDocumentoPDF(chave, d) {
  // --- helpers ---
  const s = (v) => String(v ?? '').trim() || '—';
  const data = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // Dados fixos do escritório
  const ESCRITORIO = {
    nome: 'ADVOCACIA CALDAS & BRITO',
    endereco: 'Rua Antônio Alves de Lima, 563 - Juremal - Edifício Timbaúba, Apt. 04 - V. Alegre/CE, 63540-000',
    contato: '(88) 99660-0088 / 99471-9865 / 99612-5912 | caldasebrito@gmail.com'
  };

  // Advogados fixos conforme documentos reais
  const ADVOGADOS = [
    { nome: 'ANTONIO DE CALDAS COSTA SOUSA',   qualif: 'brasileiro, casado, advogado',   cpf: '050.085.533-13', oab: 'OAB/CE nº 34.307', cargo: 'CONTRATADO'  },
    { nome: 'PRISCILA COSTA DE OLIVEIRA BRITO', qualif: 'brasileira, casada, advogada',   cpf: '053.484.613-00', oab: 'OAB/CE nº 37.087', cargo: 'CONTRATADA'  },
    { nome: 'ISABEL ERICA SILVA DE OLIVEIRA',   qualif: 'brasileira, solteira, advogada', cpf: null,             oab: 'OAB/CE nº 54.670', cargo: 'CONTRATADA'  },
    { nome: 'FRANCISCO FILHO COSTA DOS ANJOS',  qualif: 'brasileiro, solteiro, advogado', cpf: '060.761.513-31', oab: 'OAB/CE nº 51.067', cargo: 'CONTRATADO'  }
  ];

  // Monta endereço completo do cliente
  const endCliente = [
    d.endereco,
    d.numero  ? `nº ${d.numero}`  : null,
    d.bairro  || null,
    d.cidade  ? `${d.cidade}/${d.estado}` : null,
    d.cep     ? `CEP ${d.cep}` : null
  ].filter(Boolean).join(', ');

  // --- init jsPDF ---
  const jsPdfLib   = window.jspdf?.jsPDF || window.jspdf || undefined;
  const JsPDFCtor  = jsPdfLib?.jsPDF ? jsPdfLib.jsPDF : jsPdfLib;
  if (typeof JsPDFCtor !== 'function') {
    showToast('Biblioteca de PDF não carregada. Verifique sua conexão.', 'error');
    return;
  }

  const carregarImagemBase64 = (url) => fetch(url)
    .then(r => {
      if (!r.ok) throw new Error(`Imagem não encontrada (${r.status}): ${url}`);
      return r.blob();
    })
    .then(blob => new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res(reader.result);
      reader.onerror = () => rej(new Error(`Falha ao carregar imagem: ${url}`));
      reader.readAsDataURL(blob);
    }));

  let LOGO_B64   = null;
  let BRASAO_B64 = null;

  [LOGO_B64, BRASAO_B64] = await Promise.all([
    carregarImagemBase64('images/timbrado_principal.png').catch(() => null),
    carregarImagemBase64('images/timbrado_rodape.png').catch(() => null)
  ]);


  const pdf    = new JsPDFCtor({ orientation: 'p', unit: 'mm', format: 'a4' });
  const PW     = pdf.internal.pageSize.getWidth();   // 210mm
  const PH     = pdf.internal.pageSize.getHeight();  // 297mm
  const MAR_LADO    = 20;   // margem lateral (igual ao Word)
  const LARGURA     = PW - MAR_LADO * 2;  // 170mm — área de texto
  const MAR_TOP     = 38;   // margem superior (igual ao Word)
  const MAR_BOTTOM  = 28;   // margem inferior (igual ao Word)

  let y        = MAR_TOP;
  const LINHA_H = 6;    // altura de linha para fonte 11pt


  // ---- primitivas de renderização ----

  const aplicarTimbrado = () => {
    // ── MARCA DAGUA (timbrado_rodape.png — imagem landscape 1118x591) ──
    // Razao real W/H = 1118/591 = 1.8917
    // Dimensoes corretas para preservar proporcao
    if (BRASAO_B64) {
      const marcaW = 95.0;
      const marcaH = 50.2;   // marcaW / 1.8917 = 50.22mm
      const marcaX = (PW - marcaW) / 2;  // centralizado
      const marcaY = MAR_TOP + ((PH - MAR_TOP - MAR_BOTTOM) - marcaH) / 2;
      pdf.addImage(BRASAO_B64, 'PNG', marcaX, marcaY, marcaW, marcaH);
    }

    // ── LOGO DO CABEÇALHO (timbrado_principal.png — imagem portrait 1266x1417) ──
    // Razao real W/H = 1266/1417 = 0.8934
    // Dimensoes corretas para preservar proporcao
    if (LOGO_B64) {
      const logoH = 28.0;
      const logoW = 25.0;    // logoH * 0.8934 = 25.01mm
      const logoX = (PW - logoW) / 2;
      const logoY = 5.0;
      const formato = LOGO_B64.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      pdf.addImage(LOGO_B64, formato, logoX, logoY, logoW, logoH);
    }

    // ── LINHA DOURADA separando cabecalho do corpo ──────────────────
    pdf.setDrawColor(180, 147, 80);
    pdf.setLineWidth(0.4);
    pdf.line(MAR_LADO, MAR_TOP - 4, PW - MAR_LADO, MAR_TOP - 4);
    pdf.setLineWidth(0.2);

    // ── RODAPÉ ──────────────────────────────────────────────────────
    const sepY  = PH - MAR_BOTTOM + 4;
    const rod1Y = PH - MAR_BOTTOM + 9;
    const rod2Y = PH - MAR_BOTTOM + 14;

    pdf.setDrawColor(180, 147, 80);
    pdf.setLineWidth(0.4);
    pdf.line(MAR_LADO, sepY, PW - MAR_LADO, sepY);
    pdf.setLineWidth(0.2);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(110, 110, 110);
    pdf.text(
      'Rua Antônio Alves de Lima, 563 - Juremal - Edifício Timbaúba, Apt. 04 - V. Alegre/CE, 63540-000',
      PW / 2,
      rod1Y,
      { align: 'center' }
    );
    pdf.text(
      '(88) 99660-0088 / 99471-9865 / 99612-5912 | caldasebrito@gmail.com',
      PW / 2,
      rod2Y,
      { align: 'center' }
    );
  };

  // Aplicar na primeira página
  aplicarTimbrado();

  const novaLinha = (h = LINHA_H) => { y += h; };

  const checarPagina = (alturaEstimada = LINHA_H) => {
    if (y + alturaEstimada > PH - MAR_BOTTOM - 12) {
      pdf.addPage();
      aplicarTimbrado();
      y = MAR_TOP;
    }
  };

  // Texto (com justificação manual quando align='justify')
  const addTexto = (texto, opts = {}) => {
    const {
      fontSize  = 11,
      bold      = false,
      italic    = false,
      align     = 'justify',
      cor       = [30, 30, 30],
      antes     = 0,
      depois    = 4,
      indent    = 0
    } = opts;

    y += antes;
    const fontStyle = bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';
    pdf.setFont('helvetica', fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...cor);

    const largDisp = LARGURA - indent;
    const xBase = MAR_LADO + indent;
    const linhas = pdf.splitTextToSize(texto, largDisp);

    linhas.forEach((linha, idx) => {
      checarPagina(LINHA_H);
      const ehUltima = idx === linhas.length - 1;

      if (align === 'justify' && !ehUltima) {
        const palavras = linha.trim().split(' ').filter(p => p.length > 0);
        if (palavras.length > 1) {
          const largTexto = pdf.getTextWidth(palavras.join(' '));
          const espacoExtra = (largDisp - largTexto) / (palavras.length - 1);
          let xPalavra = xBase;
          palavras.forEach((palavra) => {
            pdf.text(palavra, xPalavra, y);
            xPalavra += pdf.getTextWidth(palavra) + pdf.getTextWidth(' ') + espacoExtra;
          });
        } else {
          pdf.text(linha, xBase, y);
        }
      } else if (align === 'center') {
        pdf.text(linha, PW / 2, y, { align: 'center' });
      } else if (align === 'right') {
        pdf.text(linha, MAR_LADO + LARGURA, y, { align: 'right' });
      } else {
        pdf.text(linha, xBase, y);
      }

      y += LINHA_H;
    });

    y += depois;
  };

  // Parágrafo misto: array de segmentos { texto, bold?, italic? }
  const addMisto = (segmentos, opts = {}) => {
    const {
      fontSize = 11,
      cor      = [30, 30, 30],
      antes    = 0,
      depois   = 4,
      indent   = 0
    } = opts;

    y += antes;
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...cor);

    let xCursor  = MAR_LADO + indent;
    const xMax   = MAR_LADO + LARGURA;
    const xInicio = MAR_LADO + indent;

    const aplicarEstilo = (seg) => {
      const st = seg.bold && seg.italic ? 'bolditalic'
               : seg.bold   ? 'bold'
               : seg.italic ? 'italic'
               : 'normal';
      pdf.setFont('helvetica', st);
    };

    const tokens = [];
    segmentos.forEach(seg => {
      const palavras = seg.texto.split(/(\s+)/);
      palavras.forEach(p => tokens.push({ texto: p, bold: seg.bold, italic: seg.italic }));
    });

    checarPagina(LINHA_H);

    tokens.forEach(tok => {
      aplicarEstilo(tok);
      const w = pdf.getTextWidth(tok.texto);

      if (xCursor + w > xMax && tok.texto.trim() !== '') {
        y += LINHA_H;
        checarPagina(LINHA_H);
        xCursor = xInicio;
      }
      pdf.text(tok.texto, xCursor, y);
      xCursor += w;
    });

    y += LINHA_H;
    y += depois;
  };





  const addLinha = (corLinha = [200, 200, 200]) => {
    checarPagina(4);
    pdf.setDrawColor(...corLinha);
    pdf.line(MAR_LADO, y, MAR_LADO + LARGURA, y);
    y += 4;
  };

  const addAssinaturaCentro = (nome, sublabel) => {
    checarPagina(30);
    y += 12;
    const cx = PW / 2;
    pdf.setDrawColor(30, 30, 30);
    pdf.line(cx - 50, y, cx + 50, y);
    y += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(nome, cx, y, { align: 'center' });
    y += 5;
    if (sublabel) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(100, 116, 139);
      pdf.text(sublabel, cx, y, { align: 'center' });
      y += 5;
    }
    y += 8;
  };

  const addAssinaturaLR = (esq, dir) => {
    checarPagina(30);
    y += 12;
    const xE = MAR_LADO + LARGURA * 0.25;
    const xD = MAR_LADO + LARGURA * 0.75;
    pdf.setDrawColor(30, 30, 30);
    pdf.line(xE - 42, y, xE + 42, y);
    pdf.line(xD - 42, y, xD + 42, y);
    y += 5;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);

    const lE = pdf.splitTextToSize(esq.nome, 80);
    const lD = pdf.splitTextToSize(dir.nome, 80);
    const maxL = Math.max(lE.length, lD.length);
    for (let i = 0; i < maxL; i++) {
      if (lE[i]) pdf.text(lE[i], xE, y + i * 5, { align: 'center' });
      if (lD[i]) pdf.text(lD[i], xD, y + i * 5, { align: 'center' });
    }
    y += maxL * 5 + 1;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    if (esq.sub) pdf.text(esq.sub, xE, y, { align: 'center' });
    if (dir.sub) pdf.text(dir.sub, xD, y, { align: 'center' });
    y += 5;

    if (esq.cargo || dir.cargo) {
      pdf.setFont('helvetica', 'italic');
      if (esq.cargo) pdf.text(esq.cargo, xE, y, { align: 'center' });
      if (dir.cargo) pdf.text(dir.cargo, xD, y, { align: 'center' });
      y += 5;
    }
    y += 6;
  };

  const addRodapeEscritorio = () => {
    y += 6;
    addLinha([180, 180, 180]);
    addTexto(ESCRITORIO.endereco, { fontSize: 8, cor: [120, 120, 120], align: 'center', depois: 1 });
    addTexto(ESCRITORIO.contato,  { fontSize: 8, cor: [120, 120, 120], align: 'center', depois: 0 });
  };

  addTexto(ESCRITORIO.nome, { fontSize: 11, bold: true, align: 'center', cor: [60, 60, 60], depois: 2 });
  addLinha();
  novaLinha(4);

  if (chave === 'procuracao') {
    addTexto('INSTRUMENTO PARTICULAR DE PROCURAÇÃO', { fontSize: 13, bold: true, align: 'center', depois: 1 });
    addTexto('"Ad-judícia et extra"',                 { fontSize: 10, italic: true, align: 'center', depois: 8 });

    addMisto([
      { texto: 'OUTORGANTE(S): ', bold: true },
      { texto: s(d.nomeCompleto), bold: true },
      { texto: `, ${s(d.estadoCivil)}, ${s(d.profissao)},` +
               (d.rg ? ` portador(a) da Cédula de Identidade RG nº ${s(d.rg)},` : '') +
               ` inscrito(a) no CPF/MF sob o nº ${s(d.cpf)},` +
               ` residente e domiciliado(a) ${endCliente ? 'em ' + endCliente : '—'}.` }
    ], { antes: 0, depois: 6 });

    addMisto([
      { texto: 'OUTORGADO(S): ', bold: true },
      { texto: 'ANTONIO DE CALDAS COSTA SOUSA', bold: true },
      { texto: ', brasileiro, casado, advogado, inscrito na OAB/CE sob o nº 34.307; ' },
      { texto: 'PRISCILA COSTA DE OLIVEIRA BRITO', bold: true },
      { texto: ', brasileira, casada, advogada, inscrita na OAB/CE sob o nº 37.087; ' },
      { texto: 'ISABEL ERICA SILVA DE OLIVEIRA', bold: true },
      { texto: ', brasileira, solteira, inscrita na OAB/CE nº 54.670; e ' },
      { texto: 'FRANCISCO FILHO COSTA DOS ANJOS', bold: true },
      { texto: ', brasileiro, solteiro, advogado, CPF nº 060.761.513-31, OAB/CE nº 51.067,' +
               ' com escritório profissional na Rua Antonio Alves de Lima, nº 563, Juremal,' +
               ' Edifício Timbaúba (Apartamento 04), Várzea Alegre/CE.' }
    ], { antes: 0, depois: 6 });

    addMisto([
      { texto: 'PODERES: ', bold: true },
      { texto: 'Por este instrumento particular de procuração, o(a) outorgante acima qualificado(a) e abaixo' +
               ' assinado(a) nomeia e constitui como seu(s) procurador(es) o(s) outorgado(s) supraqualificado(s),' +
               ' a quem confere amplos poderes para o foro em geral, com cláusula ' },
      { texto: 'ad-judícia et extra', italic: true },
      { texto: ', em qualquer Juízo, Instância ou Tribunal, inclusive repartições públicas estaduais ou municipais' +
               ' de qualquer natureza, podendo propor contra quem de direito as ações competentes e defendê-lo(a)' +
               ' nas contrárias, seguindo umas e outras, até final decisão, postular em qualquer esfera' +
               ' administrativa usando os recursos legais e acompanhando-os, conferindo-lhe, ainda, poderes' +
               ' especiais para confessar, desistir, transigir, firmar compromisso ou acordos, receber dinheiro' +
               ' e dar quitação, agindo em conjunto ou separadamente, podendo ainda substabelecer esta a outrem,' +
               ' com ou sem reservas de iguais poderes, dando tudo por bom, firme e valioso.' }
    ], { antes: 0, depois: 8 });

    addTexto(`Várzea Alegre, ${data}.`, { depois: 16 });
    addAssinaturaCentro(s(d.nomeCompleto), `CPF: ${s(d.cpf)}`);
    addRodapeEscritorio();
  }

  else if (chave === 'contrato-honorarios') {
    addTexto('CONTRATO DE HONORÁRIOS', { fontSize: 13, bold: true, align: 'center', depois: 8 });

    addTexto(
      'Pelo presente instrumento particular, ANTONIO DE CALDAS COSTA SOUSA, brasileiro, casado, advogado,' +
      ' inscrito no CPF sob o nº 050.085.533-13, OAB/CE nº 34.307; PRISCILA COSTA DE OLIVEIRA BRITO,' +
      ' brasileira, casada, advogada, inscrita no CPF sob o nº 053.484.613-00, OAB/CE nº 37.087; e' +
      ' FRANCISCO FILHO COSTA DOS ANJOS, brasileiro, solteiro, advogado, CPF nº 060.761.513-31,' +
      ' OAB/CE nº 51.067, com escritório profissional na Rua Antonio Alves de Lima, nº 563, Juremal,' +
      ' Edifício Timbaúba (Apartamento 04), Várzea Alegre/CE, denominados CONTRATADOS,' +
      ' e de outro lado, como CONTRATANTE:',
      { depois: 4 }
    );

    addMisto([
      { texto: s(d.nomeCompleto), bold: true },
      { texto: `, ${s(d.estadoCivil)}, ${s(d.profissao)},` +
               (d.rg ? ` portador(a) do RG nº ${s(d.rg)},` : '') +
               ` inscrito(a) no CPF sob o nº ${s(d.cpf)},` +
               ` residente e domiciliado(a) ${endCliente ? 'em ' + endCliente : '—'},` }
    ], { depois: 2 });
    addTexto('ajustam o seguinte:', { depois: 6 });

    const clausulas = [
      {
        num: '1. OBJETO',
        corpo: 'Os CONTRATADOS obrigam-se a prestar os serviços profissionais advocatícios, mediante mandato,' +
               ' para atuação em processos administrativos e/ou judiciais previdenciários ou assistenciais,' +
               ' com zelo e diligência.'
      },
      {
        num: '2. HONORÁRIOS – FASE ADMINISTRATIVA',
        subitens: [
          '2.1. Benefícios Previdenciários Permanentes:\nR$ 5.000,00 (cinco mil reais), à vista;\nOU\n30% sobre 12 parcelas vincendas.',
          '2.2. Benefícios Temporários com DCB (como auxílio-doença):\n30% das parcelas vincendas.',
          '2.3. Auxílio-Acidente:\n30% sobre 12 parcelas vincendas.',
          '2.4. Benefícios sem DCB:\n30% sobre 12 parcelas vincendas.',
          '2.5. Benefício Assistencial (BPC):\nR$ 5.000,00 (cinco mil reais), à vista;\nOU\n30% sobre 12 parcelas vincendas.'
        ]
      },
      {
        num: '3. HONORÁRIOS – FASE JUDICIAL',
        subitens: [
          '3.1. Benefícios Previdenciários Permanentes (inclusive BPC/LOAS):\n30% sobre parcelas vencidas + 30% sobre 12 parcelas vincendas.',
          '3.2. Benefícios Temporários:\n30% sobre parcelas vencidas + 30% sobre parcelas vincendas.',
          '3.3. Salário-maternidade:\nR$ 2.000,00 (valor fixo), por não haver parcelas retroativas expressivas.'
        ]
      },
      {
        num: '4. RECURSOS',
        corpo: 'Em caso de interposição de recurso, será acrescido 10% sobre as parcelas vencidas,' +
               ' totalizando 40% sobre o valor obtido.'
      },
      {
        num: '5. DESPESAS',
        corpo: 'As despesas processuais ou administrativas, tais como custas, diligências, deslocamentos,' +
               ' cópias, entre outras, correrão por conta da CONTRATANTE, exceto se beneficiária da gratuidade da justiça.'
      },
      {
        num: '6. EXIGIBILIDADE DOS HONORÁRIOS',
        corpo: 'Os honorários serão exigíveis nas seguintes hipóteses:',
        subitens: [
          'a) atraso de mais de uma parcela do pagamento;',
          'b) revogação imotivada do mandato.'
        ]
      },
      {
        num: '7. OUTRAS DISPOSIÇÕES',
        subitens: [
          '- Este contrato obriga herdeiros e sucessores;',
          '- A CONTRATANTE deve comunicar qualquer mudança de endereço;',
          '- Fica eleito o foro de Várzea Alegre/CE para dirimir quaisquer dúvidas decorrentes do presente contrato.'
        ]
      }
    ];

    clausulas.forEach(cl => {
      addTexto(cl.num, { bold: true, depois: 2 });
      if (cl.corpo) addTexto(cl.corpo, { indent: 4, depois: 2 });
      if (cl.subitens) cl.subitens.forEach(si => addTexto(si, { indent: 6, depois: 2 }));
      novaLinha(2);
    });

    addTexto('E, por estarem justos e contratados, firmam o presente instrumento em duas vias de igual teor e forma.', { depois: 6 });
    addTexto(`Várzea Alegre/CE, _____ de ________________ de _________.`, { depois: 14 });

    addAssinaturaCentro(s(d.nomeCompleto), `CPF: ${s(d.cpf)} — CONTRATANTE`);

    addAssinaturaLR(
      { nome: 'ANTONIO DE CALDAS COSTA SOUSA', sub: 'OAB/CE 34.307', cargo: 'CONTRATADO' },
      { nome: 'PRISCILA COSTA DE OLIVEIRA BRITO', sub: 'OAB/CE 37.087', cargo: 'CONTRATADA' }
    );
    addAssinaturaCentro('FRANCISCO FILHO COSTA DOS ANJOS', 'OAB/CE 51.067 — CONTRATADO');

    addRodapeEscritorio();
  }

  else if (chave === 'declaracao-hipossuficiencia') {
    addTexto('DECLARAÇÃO DE HIPOSSUFICIÊNCIA', { fontSize: 13, bold: true, align: 'center', depois: 10 });

    addMisto([
      { texto: 'Eu, ' },
      { texto: s(d.nomeCompleto), bold: true },
      { texto: `, ${s(d.estadoCivil)}, ${s(d.profissao)},` +
               (d.rg ? ` portador(a) da cédula de identidade de nº ${s(d.rg)},` : '') +
               ` inscrito(a) no CPF sob o nº ${s(d.cpf)},` +
               ` residente e domiciliado(a) ${endCliente ? 'em ' + endCliente : '—'}. ` },
      { texto: 'DECLARO', bold: true },
      { texto: ' que, em razão da minha condição financeira não tenho condições de arcar com o pagamento das' +
               ' custas processuais, sob pena de implicar em prejuízo próprio e de minha família,' +
               ' nos termos do art. 5º, LXXIV, da Constituição da República e dos artigos 98 e seguintes' +
               ' da Lei nº 13.105/2015.' }
    ], { antes: 0, depois: 8 });

    addTexto(
      'Por ser a expressão da verdade, assumindo inteira responsabilidade pelas declarações acima e sob as penas' +
      ' da lei, assino a presente declaração para que produza seus devidos efeitos legais.',
      { depois: 12 }
    );

    addTexto(`Várzea Alegre/CE, ${data}.`, { depois: 16 });
    addAssinaturaCentro(s(d.nomeCompleto), `CPF: ${s(d.cpf)}`);
    addRodapeEscritorio();
  }

  else if (chave === 'declaracao-residencia') {
    addTexto('DECLARAÇÃO DE RESIDÊNCIA', { fontSize: 13, bold: true, align: 'center', depois: 10 });

    addMisto([
      { texto: 'Eu, ' },
      { texto: s(d.nomeCompleto), bold: true },
      { texto: `, ${s(d.estadoCivil)}, ${s(d.profissao)},` +
               ` inscrito(a) no CPF sob o nº ` },
      { texto: s(d.cpf), bold: true },
      { texto: ',' + (d.rg ? ` RG nº ${s(d.rg)},` : '') + ' ' },
      { texto: 'DECLARO', bold: true },
      { texto: ', para os devidos fins, que ' },
      { texto: 'resido no endereço', bold: true },
      { texto: ' abaixo descrito, sendo que o comprovante de endereço está em meu nome:' }
    ], { depois: 6 });

    addTexto(endCliente || '—', { bold: true, align: 'center', depois: 8 });

    addTexto(
      'Declaro que as informações acima são verdadeiras e assumo total responsabilidade pela veracidade' +
      ' dos dados prestados, sob as penas da lei.',
      { depois: 12 }
    );

    addTexto(`Várzea Alegre/CE, ${data}.`, { depois: 16 });
    addAssinaturaCentro(s(d.nomeCompleto), `CPF: ${s(d.cpf)}`);
    addRodapeEscritorio();
  }

  else if (chave === 'termo-responsabilidade') {
    addTexto('TERMO DE RESPONSABILIDADE', { fontSize: 13, bold: true, align: 'center', depois: 10 });

    addMisto([
      { texto: 'Eu, ' },
      { texto: s(d.nomeCompleto), bold: true },
      { texto: `, ${s(d.estadoCivil)}, ${s(d.profissao)},` +
               (d.rg ? ` RG nº ${s(d.rg)},` : '') +
               ` CPF nº ${s(d.cpf)},` +
               ` residente e domiciliado(a) ${endCliente ? 'em ' + endCliente : '—'},` +
               ' declaro, para todos os fins de direito, que:' }
    ], { depois: 6 });

    const itens = [
      'Todas as informações, documentos e declarações apresentadas ao(à) advogado(a) ANTONIO DE CALDAS COSTA SOUSA,' +
      ' OAB/CE nº 34.307, referentes à ação judicial em curso, são verdadeiras e de minha inteira responsabilidade.',

      'Reconheço que o(a) advogado(a) atua com base nas informações e documentos por mim fornecidos,' +
      ' não podendo ser responsabilizado(a) por eventuais inexatidões, omissões ou falsidades que venham' +
      ' a ser verificadas no curso do processo.',

      'Comprometo-me a entregar todos os documentos necessários e a não omitir fatos relevantes que possam' +
      ' influenciar no resultado da demanda, assumindo total responsabilidade por eventuais prejuízos' +
      ' decorrentes da falta de veracidade das informações prestadas.',

      'Declaro, ainda, estar ciente de que a prestação de informações falsas em juízo pode caracterizar' +
      ' crime de falsidade ideológica (art. 299 do Código Penal), ficando sujeito(a) às sanções civis,' +
      ' penais e processuais cabíveis.'
    ];

    itens.forEach(item => addTexto(`- ${item}`, { indent: 4, depois: 4 }));

    addTexto(
      'Por ser expressão da verdade, firmo o presente TERMO DE RESPONSABILIDADE,' +
      ' para que produza seus jurídicos e legais efeitos.',
      { depois: 12 }
    );

    addTexto(`Várzea Alegre, ${data}.`, { depois: 14 });

    addAssinaturaLR(
      { nome: s(d.nomeCompleto), sub: `CPF nº ${s(d.cpf)}` },
      { nome: 'ANTONIO DE CALDAS COSTA SOUSA', sub: 'OAB/CE nº 34.307' }
    );
    addRodapeEscritorio();
  }

  else if (chave === 'termo-renuncio') {
    addTexto('Termo de Renúncia', { fontSize: 13, bold: true, align: 'center', depois: 1 });
    addTexto('Valor excedente — Juizado Especial Federal', { fontSize: 10, italic: true, align: 'center', depois: 10 });

    addMisto([
      { texto: 'Eu, ' },
      { texto: s(d.nomeCompleto), bold: true },
      { texto: `, ${s(d.estadoCivil)}, ${s(d.profissao)},` +
               (d.rg ? ` portador(a) da Cédula de Identidade RG nº ${s(d.rg)},` : '') +
               ` inscrito(a) no CPF/MF sob o nº ${s(d.cpf)},` +
               ` residente e domiciliado(a) ${endCliente ? 'em ' + endCliente : '—'}.` +
               ' Venho por meio desta ' },
      { texto: 'RENUNCIAR', bold: true },
      { texto: ' ao valor de meu crédito que exceder a 60 salários mínimos, procedimento necessário' +
               ' para o devido ajuizamento e prosseguimento de meu pleito perante o Juizado Especial Federal.' }
    ], { depois: 10 });

    addTexto('Por ser verdade firmo o presente.', { depois: 14 });
    addTexto(`Várzea Alegre/CE, ${data}.`, { depois: 16 });
    addAssinaturaCentro(s(d.nomeCompleto), `CPF: ${s(d.cpf)}`);
    addRodapeEscritorio();
  }

  else {
    showToast('Modelo de documento não encontrado.', 'error');
    return;
  }

  const nomeArquivo = `${chave}-${s(d.nomeCompleto)}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 80) + '.pdf';

  pdf.save(nomeArquivo);
  }
};

// ==========================================
// 3. CONTROLLER (Regras e Eventos)
// ==========================================
const ClienteController = {
  dadosLocais: [], // Cache local para busca rápida

  async init() {
    ClienteView.init();
    this.bindEvents();
    await this.carregarAdvogados();
    await this.carregarDados();
  },

  async carregarAdvogados() {
    const select = document.getElementById('cliente-advogado');
    if (!select) return;

    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome')
      .in('role', ['ADMIN', 'ADVOGADO', 'ADVOGADA'])
      .eq('ativo', true)
      .order('nome');

    if (error) {
      return;
    }

    select.innerHTML = '<option value="">Selecione...</option>' +
      data.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
  },

  bindEvents() {
    ClienteView.elementos.btnNovo.addEventListener('click', () => {
      ClienteView.abrirModal();
    });

    ClienteView.elementos.btnCancelar.addEventListener('click', () => {
      ClienteView.fecharModal();
    });

    ClienteView.elementos.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.salvarCliente();
    });

    ClienteView.elementos.inputBusca.addEventListener('input', (e) => {
      const termo = e.target.value.toLowerCase();
      const filtrados = this.dadosLocais.filter(c =>
        c.nome.toLowerCase().includes(termo) ||
        (c.documento && c.documento.includes(termo))
      );
      ClienteView.renderizarTabela(filtrados);
    });

    document.getElementById('cliente-documento').addEventListener('input', (e) => {
      document.getElementById('cliente-inss-cpf').value = e.target.value;
    });

    document.getElementById('lista-clientes-body').addEventListener('click', async (e) => {
      const btnView = e.target.closest('.btn-view');
      const btnEdit = e.target.closest('.btn-edit');
      const btnDelete = e.target.closest('.btn-delete');

      if (btnView) {
        const id = btnView.dataset.id;
        const cliente = this.dadosLocais.find(c => c.id === id);
        if (cliente) ClienteView.abrirModal(cliente, true);
      }

      if (btnEdit) {
        const id = btnEdit.dataset.id;
        const cliente = this.dadosLocais.find(c => c.id === id);
        if (cliente) ClienteView.abrirModal(cliente);
      }

      if (btnDelete) {
        const id = btnDelete.dataset.id;
        if (confirm('Tem certeza? Isso apagará o histórico deste cliente.')) {
          await this.excluirCliente(id);
        }
      }
    });

    document.body.addEventListener('change', async (e) => {
      if (e.target.id === 'upload-doc-cliente') {
        const file = e.target.files[0];
        const clienteId = e.target.dataset.cliente;
        if (!file || !clienteId) return;

        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await fetch(`${getApiUrl()}/documentos/upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                nome: file.name,
                tipo: file.type,
                arquivo: reader.result,
                cliente_id: clienteId
              })
            });

            if (res.ok) {
              showToast('Arquivo anexado!', 'success');
              ClienteController.atualizarSessaoDocumentos(clienteId);
            }
          } catch (err) {
            showToast('Erro no upload', 'error');
          }
        };
        reader.readAsDataURL(file);
      }
    });

    document.body.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-del-doc');
      if (btn && confirm('Deseja excluir este documento?')) {
        const id = btn.dataset.id;
        const clienteId = btn.dataset.cliente;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`${getApiUrl()}/documentos/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          showToast('Arquivo removido', 'success');
          ClienteController.atualizarSessaoDocumentos(clienteId);
        }
      }
    });
  },

  atualizarSessaoDocumentos(clienteId) {
    ClienteView.renderizarSessaoDocumentos(clienteId, false);
  },

  async carregarDados() {
    try {
      this.dadosLocais = await ClienteModel.listarTodos();
      ClienteView.renderizarTabela(this.dadosLocais);
    } catch (error) {
      ClienteView.mostrarErro('Falha ao carregar clientes.');
    }
  },

  async salvarCliente() {
    const id = document.getElementById('cliente-id').value;

    const getVal = (eid) => {
      const el = document.getElementById(eid);
      if (!el) return null;
      const val = el.value.trim();
      return val === "" ? null : val;
    };

    const { data: { user } } = await supabase.auth.getUser();

    let usuarioIdReferencia = null;
    if (user && user.email) {
      const { data: usuarioPublico } = await supabase
        .from('usuarios')
        .select('id')
        .eq('ativo', true)
        .eq('email', user.email)
        .single();

      if (usuarioPublico) usuarioIdReferencia = usuarioPublico.id;
    }

    const payload = {
      nome: getVal('cliente-nome'),
      tipo: document.getElementById('cliente-tipo').value,
      documento: getVal('cliente-documento'),
      email: getVal('cliente-email'),
      telefone: getVal('cliente-telefone'),
      inss_senha: getVal('cliente-inss-senha'),
      rg: getVal('cliente-rg'),

      cep: getVal('cliente-cep'),
      endereco: getVal('cliente-endereco'),
      numero: getVal('cliente-numero'),
      bairro: getVal('cliente-bairro'),
      cidade: getVal('cliente-cidade'),
      estado: getVal('cliente-estado'),

      nacionalidade: getVal('cliente-nacionalidade'),
      estado_civil: getVal('cliente-estado-civil'),
      profissao: getVal('cliente-profissao'),

      advogado_id: getVal('cliente-advogado'),
      usuario_id: usuarioIdReferencia
    };

    const camposFaltantes = [];
    if (!payload.nome) camposFaltantes.push('Nome Completo');
    if (!payload.documento) camposFaltantes.push('CPF/CNPJ');

    if (camposFaltantes.length > 0) {
      const msg = camposFaltantes.join(' e ');
      showToast(`ATENÇÃO: É obrigatório preencher: ${msg}`, 'warning');

      if (!payload.nome) document.getElementById('cliente-nome').classList.add('input-error');
      if (!payload.documento) document.getElementById('cliente-documento').classList.add('input-error');

      return;
    }

    try {
      if (id) {
        const { usuario_id, ...dadosAtualizacao } = payload;
        await ClienteModel.atualizar(id, dadosAtualizacao);
      } else {
        try {
          await ClienteModel.criar(payload);
        } catch (err) {
          const isColumnMissing = err.code === '42703';
          const isFKViolation = err.code === '23503';

          if (isColumnMissing || isFKViolation || (err.message && err.message.includes('inss_senha'))) {
            const { usuario_id, inss_senha, ...dadosReduzidos } = payload;
            await ClienteModel.criar(dadosReduzidos);
          } else {
            throw err;
          }
        }
      }

      ClienteView.fecharModal();
      showToast('Cliente salvo com sucesso!', 'success');
      await this.carregarDados();
    } catch (error) {
      console.error(error);

      if (error.code === '23505' || (error.message && error.message.includes('unique'))) {
        ClienteView.mostrarErro('Este CPF/CNPJ já está cadastrado no sistema.');
      } else {
        if (error.message && error.message.includes('usuario_id')) {
          ClienteView.mostrarErro('Erro de banco de dados: Coluna usuario_id não encontrada. Contate o suporte.');
        } else {
          ClienteView.mostrarErro(`Erro ao salvar: ${error.message}`);
        }
      }
    }
  },

  async excluirCliente(id) {
    try {
      await ClienteModel.deletar(id);
      showToast('Cliente excluído.', 'success');
      await this.carregarDados();
    } catch (error) {
      console.error(error);
      ClienteView.mostrarErro('Não foi possível excluir (pode haver processos vinculados).');
    }
  }
};

// Inicializa o módulo quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
  await initSupabase();
  ClienteController.init();
});

