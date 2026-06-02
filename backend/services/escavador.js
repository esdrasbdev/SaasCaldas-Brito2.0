/*
 * Serviço de Integração com API JUDIT e Cálculo de Prazos
 */
const supabase = require('../supabase');
const EmailService = require('./email');

// Configurações
const API_URL = 'https://api.judit.io/v1';
const API_TOKEN = process.env.JUDIT_API_TOKEN || process.env.ESCAVADOR_API_TOKEN;

// Delay helper para evitar Rate Limiting (bloqueio da API por muitas requisições)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Lista de OABs mapeadas para responsáveis (do .env)
// Ex: CE34307=Antonio,CE37087=Priscila
// Suporta JUDIT_OAB_LIST ou ESCAVADOR_OAB_LIST (fallback)
const ENV_LIST = process.env.JUDIT_OAB_LIST || process.env.ESCAVADOR_OAB_LIST || '';
const OAB_MAP = ENV_LIST.split(',').reduce((acc, item) => {
  const [oab, resp] = item.split('=');
  if (oab && resp) acc[oab.trim()] = resp.trim();
  return acc;
}, {});

// Validação de configuração inicial
if (Object.keys(OAB_MAP).length === 0) {
  console.warn('⚠️ AVISO: Nenhuma OAB configurada em JUDIT_OAB_LIST no .env.');
}

const JuditService = {
  // 1. Busca publicações na API Oficial (Mockado se não tiver token)
  async buscarPublicacoes() {
    if (!API_TOKEN) {
      console.warn('⚠️ Token do Judit (JUDIT_API_TOKEN) ausente. Rodando em MODO MOCK (Simulação).');
      await this.simularPublicacaoMock();
      return { success: true, total: 1, message: 'Dados Mockados Gerados' };
    }

    let totalProcessadas = 0;
    let falhas = 0;

    try {
      console.log(`🔍 Iniciando busca no Judit para ${Object.keys(OAB_MAP).length} OABs configuradas...`);
      
      for (const [oab, responsavel] of Object.entries(OAB_MAP)) {
        try {
          console.log(`running: Buscando publicações para ${oab} (${responsavel})...`);
          const sucesso = await this.buscarPublicacoesPorOab(oab, responsavel);
          if (sucesso) {
            totalProcessadas++;
          } else {
            falhas++;
          }
          
          // Inteligência de Rate Limiting: 
          // Evita bloqueio da conta Judit por excesso de chamadas em sequência
          await delay(1500); 
        } catch (e) {
          console.error(`❌ Erro crítico na OAB ${oab}:`, e.message);
          falhas++;
          // Continua para a próxima OAB mesmo se uma falhar
        }
      }

      if (falhas > 0) {
        console.warn(`⚠️ Sincronização concluída com ${falhas} falhas pontuais.`);
      }

    } catch (error) {
      console.error('Erro geral no Judit Service:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true, total: totalProcessadas };
  },

  async buscarPublicacoesPorOab(oab, responsavel) {
      try {
        // Exemplo de payload de busca do Judit (ajuste conforme a documentação exata da versão contratada)
        const response = await fetch(`${API_URL}/search`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'api-key': API_TOKEN 
            },
            body: JSON.stringify({
              query: { match: { "oab": oab } },
              page: 1,
              per_page: 10
            })
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API Judit respondeu com erro ${response.status}: ${errorBody || response.statusText}`);
        }
        
        const json = await response.json();
        // Judit geralmente retorna { data: [...] } ou { results: [...] }
        const publicacoes = json.data || json.results || [];
        console.log(`   ↳ ${publicacoes.length} publicações encontradas para ${oab}.`);

        for (const pub of publicacoes) {
            await this.processarPublicacao(pub, oab, responsavel);
        }
        return true;
      } catch (error) {
        console.error(`❌ Falha na conexão/busca da OAB ${oab}:`, error.message);
        return false;
      }
  },

  // MOCK: Gera uma publicação falsa para testar o sistema sem pagar API
  async simularPublicacaoMock() {
    console.log('🎲 [MOCK JUDIT] Gerando cenários de teste (Modo Gratuito)...');
    
    const cenarios = [
      { dias: 15, texto: 'apresentar réplica no prazo de 15 (quinze) dias úteis', tipo: 'Prazo Comum' },
      { dias: 5, texto: 'manifestar-se sobre documentos no prazo de 5 (cinco) dias', tipo: 'Urgente' },
      { dias: null, texto: 'Sentença de homologação de acordo. Arquive-se.', tipo: 'Informativo' }
    ];

    const oabs = Object.keys(OAB_MAP);
    // Se não tiver OAB configurada no .env, usa uma genérica
    if (oabs.length === 0) oabs.push('OAB-TESTE');

    // Gera uma publicação para cada cenário
    for (let i = 0; i < cenarios.length; i++) {
      const cenario = cenarios[i];
      // Alterna entre as OABs (Antonio/Priscila) para distribuir as publicações
      const oabAtual = oabs[i % oabs.length]; 
      const respAtual = OAB_MAP[oabAtual] || 'Sistema';

      const publicacaoFake = {
        id: Math.floor(Math.random() * 1000000) + i, 
        process_number: `00${Math.floor(Math.random() * 89999) + 10000}-0${i}.2024.8.06.0001`, 
        crawled_at: new Date().toISOString(),
        diario_nome: 'DJCE (Simulação Grátis)',
        title: `Publicação Simulada - ${cenario.tipo}`,
        description: `
          [SIMULAÇÃO] Publicação de teste para validar o sistema.
          Processo nº ${i + 1} da lista.
          Teor: Fica intimado o advogado a ${cenario.texto}, sob pena de preclusão.
        `
      };

      await this.processarPublicacao(publicacaoFake, oabAtual, respAtual);
    }
  },

  // 2. Processa uma única publicação recebida (API ou Webhook)
  async processarPublicacao(pub, oabOrigem, responsavelDefinido) {
    // Extração de dados básicos
    // Adaptação para campos comuns do Judit (description, body, content)
    const conteudo = pub.description || pub.body || pub.content || pub.conteudo || '';
    const dataPub = pub.crawled_at || pub.date || pub.data_publicacao || new Date().toISOString();
    // Judit costuma usar 'process_number' ou 'cnj'
    const numeroProcesso = pub.process_number || pub.numero_processo || pub.cnj || 'S/N';
    
    // Tenta extrair prazo
    const prazoDias = this.extrairPrazoDoDiario(conteudo);
    const prazoData = prazoDias ? this.calcularPrazo(dataPub, prazoDias) : null;

    // Prepara objeto para o banco
    const payload = {
      id_externo: String(pub.id),
      numero_cnj: numeroProcesso,
      oab: oabOrigem,
      nome_monitorado: pub.monitoramento_nome || 'Monitoramento Judit',
      data_publicacao: dataPub,
      conteudo: conteudo,
      diario: pub.diario_nome || pub.source || 'Diário de Justiça',
      tipo: 'JUDIT_PUB',
      prazo_dias: prazoDias,
      prazo_data: prazoData,
      prazo_responsavel: responsavelDefinido || 'admin', // Default
      lida: false
    };

    // Busca ID do cliente dono do processo, se existir
    let emailCliente = null;
    
    // Limpeza básica do CNJ para aumentar chance de match (remove pontos e traços se necessário)
    // O Escavador já manda formatado, mas é bom garantir consistência no futuro.
    // Tenta vincular a um processo existente no nosso banco
    if (payload.numero_cnj) {
        const { data: proc } = await supabase
            .from('processos')
            .select('id, clientes(email)')
            .eq('numero_cnj', payload.numero_cnj) // Importante: CNJ deve estar formatado igual
            .single();
        
        if (proc) {
          payload.processo_id = proc.id;
          if (proc.clientes && proc.clientes.email) {
            emailCliente = proc.clientes.email;
          }
        }
    }

    // Salva no Supabase (Upsert para evitar duplicatas pelo ID externo)
    const { error, data: savedPub } = await supabase
        .from('publicacoes')
        .upsert(payload, { onConflict: 'id_externo' })
        .select() // Retorna o dado salvo para confirmar se é novo
        .single();

    if (error) {
      console.error('Erro ao salvar publicação:', error.message);
    } else {
      console.log(`✅ Publicação salva/atualizada: ${payload.numero_cnj}`);

      // Se salvou com sucesso e temos e-mail do cliente, envia alerta
      // Verificamos se foi inserção comparando created_at (opcional) ou simplesmente enviamos
      if (emailCliente) {
        console.log(`📩 Enviando alerta para cliente: ${emailCliente}`);
        await EmailService.enviarAlertaPublicacao(emailCliente, payload);
      }
    }
  },

  // 3. Lógica de Regex para achar "Prazo de X dias"
  extrairPrazoDoDiario(texto) {
    if (!texto) return null;
    const textoLower = texto.toLowerCase();
    
    // Ex: "prazo de 15 dias" ou "prazo legal de 5 (cinco) dias"
    const regex = /no\s+prazo\s+de\s+(\d+)\s+(?:\([^)]+\)\s+)?(?:dias|dias\s+úteis)/i;
    const match = regex.exec(textoLower);
    
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    return null;
  },

  // 4. Calculadora de Dias Úteis (Pula Sábado e Domingo)
  calcularPrazo(dataInicio, diasUteis) {
    let data = new Date(dataInicio);
    let diasRestantes = diasUteis;

    while (diasRestantes > 0) {
      // Avança 1 dia
      data.setDate(data.getDate() + 1);
      
      const diaSemana = data.getDay();
      // 0 = Domingo, 6 = Sábado
      if (diaSemana !== 0 && diaSemana !== 6) {
        diasRestantes--;
      }
      // Feriados precisariam de uma lista extra, por enquanto focamos em fds
    }

    return data.toISOString().split('T')[0]; // Retorna YYYY-MM-DD
  }
};

module.exports = JuditService;