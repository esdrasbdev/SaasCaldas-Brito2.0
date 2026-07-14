/*
 * Módulo Fases do Processo
 * Histórico de fases processuais — tabela fases_processo (não altera 'processos').
 */

import { supabase } from './supabase.js';

export const FASES_CATALOGO = [
  { valor: 'DISTRIBUICAO', rotulo: 'Distribuição / Petição Inicial' },
  { valor: 'CITACAO', rotulo: 'Citação / Notificação da Parte Contrária' },
  { valor: 'CONTESTACAO', rotulo: 'Contestação / Defesa' },
  { valor: 'INSTRUCAO', rotulo: 'Instrução (Produção de Provas)' },
  { valor: 'AUDIENCIA', rotulo: 'Audiência (Conciliação / Instrução / Julgamento)' },
  { valor: 'SENTENCA', rotulo: 'Sentença / Decisão' },
  { valor: 'RECURSAL', rotulo: 'Fase Recursal' },
  { valor: 'CUMPRIMENTO_SENTENCA', rotulo: 'Cumprimento de Sentença / Execução' },
  { valor: 'ARQUIVADO', rotulo: 'Arquivado / Baixado' },
  { valor: 'OUTRA', rotulo: 'Outra (ver observações)' }
];

export function rotuloFase(valor) {
  return FASES_CATALOGO.find(f => f.valor === valor)?.rotulo || 'Fase não informada';
}

export const FaseProcessoModel = {
  async listarHistorico(processoId) {
    const { data, error } = await supabase
      .from('fases_processo')
      .select('*, usuarios(nome)')
      .eq('processo_id', processoId)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async buscarAtualPorProcesso(processoId) {
    const { data, error } = await supabase
      .from('fases_processo_atual')
      .select('*')
      .eq('processo_id', processoId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  // Usado na listagem geral de processos (uma consulta só, evita N+1)
  async mapaFaseAtualPorProcessos(processoIds) {
    if (!processoIds?.length) return {};

    const { data, error } = await supabase
      .from('fases_processo_atual')
      .select('*')
      .in('processo_id', processoIds);

    if (error) throw error;

    const mapa = {};
    (data || []).forEach(f => { mapa[f.processo_id] = f; });
    return mapa;
  },

  // Histórico imutável: somente INSERT
  async registrar({ processoId, fase, observacoes, usuarioId }) {
    const { error } = await supabase.from('fases_processo').insert([{
      processo_id: processoId,
      fase,
      observacoes: observacoes || null,
      registrado_por: usuarioId || null
    }]);

    if (error) throw error;
    return true;
  }
};
