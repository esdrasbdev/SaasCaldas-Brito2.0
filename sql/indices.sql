-- Índices para as queries mais frequentes (prompt Parte 2.1)

create index if not exists idx_audiencias_data on audiencias(data);
create index if not exists idx_audiencias_processo_id on audiencias(processo_id);
create index if not exists idx_pericias_data on pericias(data);
create index if not exists idx_pericias_processo_id on pericias(processo_id);
create index if not exists idx_processos_cliente_id on processos(cliente_id);
create index if not exists idx_processos_advogado_id on processos(advogado_id);
create index if not exists idx_atendimentos_data on atendimentos(data);
create index if not exists idx_atendimentos_cliente_id on atendimentos(cliente_id);
create index if not exists idx_publicacoes_lida on publicacoes(lida);
create index if not exists idx_publicacoes_prazo_data on publicacoes(prazo_data);

