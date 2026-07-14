-- Histórico de fases processuais.
-- Tabela 100% aditiva: não altera 'processos' nem nenhuma tabela existente.
-- Cada linha é um "evento" de mudança de fase; a fase atual do processo é
-- sempre a última linha (maior criado_em) para aquele processo_id.

create table if not exists fases_processo (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  fase text not null check (fase in (
    'DISTRIBUICAO',
    'CITACAO',
    'CONTESTACAO',
    'INSTRUCAO',
    'AUDIENCIA',
    'SENTENCA',
    'RECURSAL',
    'CUMPRIMENTO_SENTENCA',
    'ARQUIVADO',
    'OUTRA'
  )),
  observacoes text,
  registrado_por uuid references usuarios(id),
  criado_em timestamptz default now()
);

-- RLS no padrão do projeto (leitura/escrita para autenticados)
alter table fases_processo enable row level security;

create policy "leitura_autenticados" on fases_processo
  for select using (auth.role() = 'authenticated');

create policy "escrita_autenticados" on fases_processo
  for all using (auth.role() = 'authenticated');

-- Índices
create index if not exists idx_fases_processo_processo_id on fases_processo(processo_id);
create index if not exists idx_fases_processo_criado_em on fases_processo(criado_em);

-- View auxiliar: fase mais recente por processo (não altera dados, é somente leitura)
create or replace view fases_processo_atual as
select distinct on (processo_id)
  processo_id,
  fase,
  observacoes,
  registrado_por,
  criado_em
from fases_processo
order by processo_id, criado_em desc;
