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
      containerDocs.style.order = "99";
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
      cep: getVal('cliente-cep')
    };

    const modelos = [
      { chave: 'procuracao', icone: 'fa-solid fa-scroll', titulo: 'Procuração' },
      { chave: 'contrato-honorarios', icone: 'fa-solid fa-file-signature', titulo: 'Contrato de Honorários' },
      { chave: 'declaracao-hipossuficiencia', icone: 'fa-solid fa-scale-unbalanced', titulo: 'Decl. de Hipossuficiência' },
      { chave: 'declaracao-residencia', icone: 'fa-solid fa-house', titulo: 'Declaração de Residência' },
      { chave: 'autorizacao-representacao', icone: 'fa-solid fa-user-check', titulo: 'Autorização de Representação' },
      { chave: 'termo-ciencia', icone: 'fa-solid fa-eye', titulo: 'Termo de Ciência' },
      { chave: 'peticao-inicial', icone: 'fa-solid fa-gavel', titulo: 'Petição Inicial (modelo)' }
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
        <h3 style="font-size:1rem; color:var(--azul-medio); margin-bottom:14px;
                   border-bottom:2px solid var(--azul-claro); padding-bottom:6px;">
          <i class="fa-solid fa-file-lines"></i> Documentos Jurídicos
        </h3>

        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px,1fr)); gap:10px;">
          ${modelos.map(m => `
            <div style="display:flex; align-items:center; justify-content:space-between;
                        padding:10px 14px; border:1px solid var(--cinza-borda);
                        border-radius:8px; background:var(--branco);">
              <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                <i class="${m.icone}" style="color:var(--azul-medio); font-size:1rem; flex-shrink:0;"></i>
                <span style="font-size:0.85rem; font-weight:600; color:var(--azul-escuro);
                             overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${m.titulo}
                </span>
              </div>
              <button
                class="btn-gj-baixar"
                data-chave="${m.chave}"
                type="button"
                title="Baixar PDF"
                ${visualizacao ? 'disabled' : ''}
                style="flex-shrink:0; margin-left:10px; padding:5px 10px;
                       font-size:0.8rem; border:1px solid var(--cinza-borda);
                       border-radius:5px; background:var(--branco); cursor:pointer;
                       color:var(--azul-medio); display:flex; align-items:center; gap:5px;"
              >
                <i class="fa-solid fa-download"></i> PDF
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    bloco.onclick = (ev) => {
      const btn = ev.target.closest('.btn-gj-baixar');
      if (!btn) return;
      if (visualizacao) return;

      const chave = btn.getAttribute('data-chave') || btn.dataset.chave;
      if (!chave) {
        showToast('Documento inválido para geração de PDF.', 'error');
        return;
      }
      this.baixarDocumentoPDF(chave, dadosCliente);
    };
  },

  baixarDocumentoPDF(chave, d) {
    const data = new Date().toLocaleDateString('pt-BR');
    const localData = `${d.cidade || '___________'} / ${d.estado || '__'} — ${data}`;
    const rodape = 'Documento gerado automaticamente pelo sistema Advocacia Caldas & Brito.';

    const s = (v) => String(v ?? '').trim() || '—';

    const qualificacao = (d0) =>
      `${s(d0.nomeCompleto)}, CPF ${s(d0.cpf)}${d0.rg ? ', RG ' + s(d0.rg) : ''}, ` +
      `estado civil ${s(d0.estadoCivil)}, profissão ${s(d0.profissao)}, ` +
      `residente e domiciliado(a) em ${s(d0.endereco)}, ` +
      `${d0.cep ? 'CEP ' + s(d0.cep) + ', ' : ''}` +
      `cidade de ${s(d0.cidade)} / ${s(d0.estado)}, ` +
      `telefone ${s(d0.telefone)}, e-mail ${s(d0.email)}`;

    // Evita depender do carregamento UMD (window.jspdf?.jsPDF pode variar)
    const jsPdfLib = window.jspdf?.jsPDF || window.jspdf || undefined;
    const JsPDFCtor = jsPdfLib?.jsPDF ? jsPdfLib.jsPDF : jsPdfLib;

    if (typeof JsPDFCtor !== 'function') {
      showToast('Biblioteca de PDF não carregada. Verifique sua conexão.', 'error');
      return;
    }

    const docMap = {
      'procuracao': {
        titulo: 'PROCURAÇÃO',
        secoes: [
          { tipo: 'paragrafo', texto:
            `Pelo presente instrumento particular de procuração, ${qualificacao(d)}, ` +
            `doravante denominado(a) OUTORGANTE, nomeia e constitui seu(sua) bastante procurador(a) ` +
            `o(a) advogado(a) infra-assinado(a), doravante denominado(a) OUTORGADO(A), ` +
            `para o fim de representá-lo(a) perante quaisquer Juízos, Tribunais, repartições públicas ` +
            `e demais órgãos, podendo praticar todos os atos necessários ao fiel cumprimento do presente mandato, ` +
            `incluindo receber citação, confessar, desistir, transigir, firmar compromissos e substabelecer.`
          },
          { tipo: 'paragrafo', texto: `Local e data: ${localData}.` },
          { tipo: 'assinatura', linhas: [
            { label: s(d.nomeCompleto), sublabel: `CPF: ${s(d.cpf)}`, lado: 'esquerdo' },
            { label: 'Advogado(a) Responsável', sublabel: 'OAB: _______________', lado: 'direito' }
          ]},
          { tipo: 'rodape', texto: rodape }
        ]
      },

      'contrato-honorarios': {
        titulo: 'CONTRATO DE HONORÁRIOS ADVOCATÍCIOS',
        secoes: [
          { tipo: 'paragrafo', texto:
            `Pelo presente instrumento particular, de um lado, como CONTRATANTE, ${qualificacao(d)};`
          },
          { tipo: 'paragrafo', texto:
            `E, de outro lado, como CONTRATADO(A), o(a) advogado(a) responsável pelo escritório Advocacia Caldas & Brito, devidamente inscrito(a) na OAB;`
          },
          { tipo: 'paragrafo', texto:
            `Têm entre si justo e acordado o presente contrato de prestação de serviços advocatícios, ` +
            `pelas cláusulas e condições seguintes:`
          },
          { tipo: 'paragrafo', texto:
            `CLÁUSULA 1ª — OBJETO: Prestação de serviços advocatícios relacionados a demandas judiciais e/ou administrativas de interesse do(a) CONTRATANTE.`
          },
          { tipo: 'paragrafo', texto:
            `CLÁUSULA 2ª — HONORÁRIOS: O valor e a forma de pagamento serão definidos conforme proposta específica, ` +
            `ficando vedada qualquer alteração sem anuência das partes por escrito.`
          },
          { tipo: 'paragrafo', texto:
            `CLÁUSULA 3ª — CIÊNCIA: O(A) CONTRATANTE declara estar ciente dos termos ajustados ` +
            `e autoriza o prosseguimento dos atos necessários.`
          },
          { tipo: 'paragrafo', texto: `Local e data: ${localData}.` },
          { tipo: 'assinatura', linhas: [
            { label: s(d.nomeCompleto), sublabel: `CPF: ${s(d.cpf)}`, lado: 'esquerdo' },
            { label: 'Advogado(a) Responsável', sublabel: 'OAB: _______________', lado: 'direito' }
          ]},
          { tipo: 'rodape', texto: rodape }
        ]
      },

      'declaracao-hipossuficiencia': {
        titulo: 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA',
        secoes: [
          { tipo: 'paragrafo', texto:
            `Eu, ${qualificacao(d)}, DECLARO, para os devidos fins de direito e sob as penas da lei, que não possuo condições ` +
            `financeiras de arcar com as custas e despesas processuais sem prejuízo do meu sustento e/ou de minha família.`
          },
          { tipo: 'paragrafo', texto:
            `Assim, requeiro os benefícios da GRATUIDADE DA JUSTIÇA, nos termos do art. 98 e seguintes ` +
            `do Código de Processo Civil e da Lei nº 1.060/50.`
          },
          { tipo: 'paragrafo', texto:
            `Declaro ainda que as informações acima prestadas são verdadeiras, assumindo integral responsabilidade civil e criminal por qualquer falsidade.`
          },
          { tipo: 'paragrafo', texto: `Local e data: ${localData}.` },
          { tipo: 'assinatura', linhas: [
            { label: s(d.nomeCompleto), sublabel: `CPF: ${s(d.cpf)}`, lado: 'centro' }
          ]},
          { tipo: 'rodape', texto: rodape }
        ]
      },

      'declaracao-residencia': {
        titulo: 'DECLARAÇÃO DE RESIDÊNCIA',
        secoes: [
          { tipo: 'paragrafo', texto:
            `Eu, ${s(d.nomeCompleto)}, CPF ${s(d.cpf)}${d.rg ? ', RG ' + s(d.rg) : ''}, ` +
            `estado civil ${s(d.estadoCivil)}, profissão ${s(d.profissao)}, ` +
            `DECLARO, para os devidos fins de direito e sob as penas da lei, que sou residente e domiciliado(a) no seguinte endereço:`
          },
          { tipo: 'paragrafo', texto:
            `${s(d.endereco)}${d.cep ? ' — CEP ' + s(d.cep) : ''}\nCidade: ${s(d.cidade)} / Estado: ${s(d.estado)}`
          },
          { tipo: 'paragrafo', texto:
            `Declaro ainda que as informações acima são verdadeiras e assumo total responsabilidade pela veracidade dos dados prestados.`
          },
          { tipo: 'paragrafo', texto: `Local e data: ${localData}.` },
          { tipo: 'assinatura', linhas: [
            { label: s(d.nomeCompleto), sublabel: `CPF: ${s(d.cpf)}`, lado: 'centro' }
          ]},
          { tipo: 'rodape', texto: rodape }
        ]
      },

      'autorizacao-representacao': {
        titulo: 'AUTORIZAÇÃO DE REPRESENTAÇÃO',
        secoes: [
          { tipo: 'paragrafo', texto:
            `Eu, ${qualificacao(d)}, AUTORIZO o(a) advogado(a) responsável pelo escritório Advocacia Caldas & Brito a praticar ` +
            `todos os atos necessários à condução e acompanhamento do(s) meu(s) interesse(s) junto aos órgãos judiciais, administrativos e/ou previdenciários competentes.`
          },
          { tipo: 'paragrafo', texto:
            `A presente autorização abrange, de forma não exaustiva: assinatura de documentos, apresentação de petições, requerimentos e recursos, acompanhamento de processos, acesso a informações processuais e previdenciárias, e demais atos correlatos.`
          },
          { tipo: 'paragrafo', texto: `Local e data: ${localData}.` },
          { tipo: 'assinatura', linhas: [
            { label: s(d.nomeCompleto), sublabel: `CPF: ${s(d.cpf)}`, lado: 'esquerdo' },
            { label: 'Advogado(a) Responsável', sublabel: 'OAB: _______________', lado: 'direito' }
          ]},
          { tipo: 'rodape', texto: rodape }
        ]
      },

      'termo-ciencia': {
        titulo: 'TERMO DE CIÊNCIA',
        secoes: [
          { tipo: 'paragrafo', texto:
            `Eu, ${qualificacao(d)}, DECLARO estar plenamente ciente das informações prestadas pelo escritório ` +
            `Advocacia Caldas & Brito, em especial sobre:`
          },
          { tipo: 'lista', itens: [
            'Os objetivos, estratégias e etapas do procedimento jurídico adotado;',
            'Os documentos necessários e as responsabilidades a cargo do(a) cliente;',
            'Os possíveis prazos, riscos, custos e desdobramentos do caso;',
            'A ausência de garantia de resultado, tendo em vista a natureza litigiosa dos atos jurídicos.'
          ]},
          { tipo: 'paragrafo', texto:
            `Declaro ainda ter recebido orientação adequada e que todas as dúvidas foram esclarecidas antes da assinatura do presente termo.`
          },
          { tipo: 'paragrafo', texto: `Local e data: ${localData}.` },
          { tipo: 'assinatura', linhas: [
            { label: s(d.nomeCompleto), sublabel: `CPF: ${s(d.cpf)}`, lado: 'esquerdo' },
            { label: 'Advogado(a) Responsável', sublabel: 'OAB: _______________', lado: 'direito' }
          ]},
          { tipo: 'rodape', texto: rodape }
        ]
      },

      'peticao-inicial': {
        titulo: 'PETIÇÃO INICIAL (MODELO)',
        secoes: [
          { tipo: 'paragrafo', texto:
            'Excelentíssimo(a) Senhor(a) Juiz(a) de Direito da ___ Vara de _________'
          },
          { tipo: 'paragrafo', texto:
            `${s(d.nomeCompleto)}, CPF ${s(d.cpf)}${d.rg ? ', RG ' + s(d.rg) : ''}, ` +
            `estado civil ${s(d.estadoCivil)}, profissão ${s(d.profissao)}, ` +
            `residente e domiciliado(a) em ${s(d.endereco)}, CEP ${s(d.cep)}, ` +
            `cidade de ${s(d.cidade)} / ${s(d.estado)}, ` +
            `por meio de seu(sua) advogado(a), vem, respeitosamente, à presença de Vossa Excelência ` +
            `propor a presente AÇÃO em face de (Réu — preencher), pelos fatos e fundamentos a seguir expostos.`
          },
          { tipo: 'paragrafo', texto: 'I. DOS FATOS' },
          { tipo: 'paragrafo', texto: '(Descrever os fatos de forma cronológica e objetiva, indicando datas e documentos pertinentes.)' },
          { tipo: 'paragrafo', texto: 'II. DO DIREITO' },
          { tipo: 'paragrafo', texto: '(Indicar os fundamentos legais e jurisprudenciais aplicáveis ao caso.)' },
          { tipo: 'paragrafo', texto: 'III. DOS PEDIDOS' },
          { tipo: 'lista', itens: [
            '(Pedido principal — descrever);',
            '(Pedido subsidiário ou alternativo, se houver);',
            'A condenação do réu ao pagamento de custas e honorários advocatícios;',
            'A produção de todas as provas em direito admitidas.'
          ]},
          { tipo: 'paragrafo', texto: `Dá-se à causa o valor de R$ ____________ (___________________________).` },
          { tipo: 'paragrafo', texto: `Local e data: ${localData}.` },
          { tipo: 'assinatura', linhas: [
            { label: 'Advogado(a) Responsável', sublabel: 'OAB: _______________', lado: 'centro' }
          ]},
          { tipo: 'rodape', texto: rodape }
        ]
      }
    };

    const doc = docMap[chave];
    if (!doc) {
      showToast('Modelo de documento não encontrado.', 'error');
      return;
    }

    // Gera construtor do jsPDF de forma compatível com diferentes bindings
    const jsPdfLib = window.jspdf?.jsPDF || window.jspdf || undefined;
    const JsPDFCtor = jsPdfLib?.jsPDF ? jsPdfLib.jsPDF : jsPdfLib;

    const pdf = new JsPDFCtor({ orientation: 'p', unit: 'mm', format: 'a4' });


    const margem = 20;
    const largura = pdf.internal.pageSize.getWidth() - margem * 2;
    let y = margem;

    const addTexto = (texto, opcoes = {}) => {
      const {
        fontSize = 11,
        fontStyle = 'normal',
        align = 'justify',
        cor = [30, 30, 30],
        espacoAntes = 0,
        espacoDepois = 5
      } = opcoes;

      y += espacoAntes;
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', fontStyle);
      pdf.setTextColor(...cor);

      const linhas = pdf.splitTextToSize(texto, largura);
      linhas.forEach(linha => {
        if (y + 6 > pdf.internal.pageSize.getHeight() - margem) {
          pdf.addPage();
          y = margem;
        }
        pdf.text(linha, margem, y, { align: align === 'justify' ? 'left' : align });
        y += 6;
      });
      y += espacoDepois;
    };

    const addLinha = () => {
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margem, y, margem + largura, y);
      y += 4;
    };

    addTexto('ADVOCACIA CALDAS & BRITO', {
      fontSize: 10,
      fontStyle: 'normal',
      align: 'center',
      cor: [100, 100, 100],
      espacoDepois: 2
    });
    addLinha();
    y += 4;

    addTexto(doc.titulo, {
      fontSize: 14,
      fontStyle: 'bold',
      align: 'center',
      cor: [15, 23, 42],
      espacoAntes: 2,
      espacoDepois: 10
    });

    doc.secoes.forEach(secao => {
      switch (secao.tipo) {
        case 'paragrafo':
          addTexto(secao.texto, { espacoAntes: 2, espacoDepois: 4 });
          break;

        case 'lista':
          secao.itens.forEach((item, i) => {
            addTexto(`${i + 1}. ${item}`, { espacoAntes: 1, espacoDepois: 2 });
          });
          y += 2;
          break;

        case 'assinatura': {
          y += 14;
          const linhas = secao.linhas;

          if (linhas.length === 1 && linhas[0].lado === 'centro') {
            const cx = pdf.internal.pageSize.getWidth() / 2;
            pdf.setDrawColor(30, 30, 30);
            pdf.line(cx - 45, y, cx + 45, y);
            y += 5;
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(15, 23, 42);
            pdf.text(linhas[0].label, cx, y, { align: 'center' });
            y += 5;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            pdf.setTextColor(100, 116, 139);
            pdf.text(linhas[0].sublabel, cx, y, { align: 'center' });
            y += 10;
          } else if (linhas.length === 2) {
            const meioPagina = pdf.internal.pageSize.getWidth() / 2;
            const xEsq = margem + (meioPagina - margem) / 2;
            const xDir = meioPagina + (pdf.internal.pageSize.getWidth() - margem - meioPagina) / 2;

            [[xEsq, linhas[0]], [xDir, linhas[1]]].forEach(([cx2]) => {
              pdf.setDrawColor(30, 30, 30);
              pdf.line(cx2 - 45, y, cx2 + 45, y);
            });
            y += 5;

            [[xEsq, linhas[0]], [xDir, linhas[1]]].forEach(([cx2, l]) => {
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(15, 23, 42);
              pdf.text(l.label, cx2, y, { align: 'center' });
            });
            y += 5;

            [[xEsq, linhas[0]], [xDir, linhas[1]]].forEach(([cx2, l]) => {
              pdf.setFont('helvetica', 'normal');
              pdf.setFontSize(9);
              pdf.setTextColor(100, 116, 139);
              pdf.text(l.sublabel, cx2, y, { align: 'center' });
            });
            y += 10;
          }
          break;
        }

        case 'rodape':
          y += 6;
          addLinha();
          addTexto(secao.texto, {
            fontSize: 8,
            cor: [148, 163, 184],
            align: 'center',
            espacoAntes: 2,
            espacoDepois: 0
          });
          break;
      }
    });

    const nomeArquivo = `${chave}-${s(d.nomeCompleto)}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
      .slice(0, 80) + '.pdf';

    // Abre o PDF no navegador (evita download automático)
    const blobUrl = pdf.output('bloburl');
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
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

