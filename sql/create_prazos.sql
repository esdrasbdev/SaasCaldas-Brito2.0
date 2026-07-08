-- Cria tabela de prazos manuais (fatal, recursal, outros) e sua tabela de
-- junção de múltiplos responsáveis. Rodar no Supabase SQL Editor.

create table if not exists prazos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  tipo text not null check (tipo in ('FATAL', 'RECURSAL', 'OUTRO')),
  data_prazo date not null,
  hora time,
  observacoes text,
  cliente_id uuid references clientes(id),
  processo_id uuid references processos(id),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'CUMPRIDO', 'ARQUIVADO')),
  criado_por uuid references usuarios(id),
  criado_em timestamptz default now()
);

create table if not exists responsaveis_prazo (
  id uuid primary key default gen_random_uuid(),
  prazo_id uuid not null references prazos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (prazo_id, usuario_id)
);

-- RLS no padrão do projeto (leitura/escrita para autenticados)
alter table prazos enable row level security;
create policy "leitura_autenticados" on prazos
  for select using (auth.role() = 'authenticated');
create policy "escrita_autenticados" on prazos
  for all using (auth.role() = 'authenticated');

alter table responsaveis_prazo enable row level security;
create policy "leitura_autenticados" on responsaveis_prazo
  for select using (auth.role() = 'authenticated');
create policy "escrita_autenticados" on responsaveis_prazo
  for all using (auth.role() = 'authenticated');

-- Índices
create index if not exists idx_prazos_data_prazo on prazos(data_prazo);
create index if not exists idx_prazos_status on prazos(status);
create index if not exists idx_prazos_cliente_id on prazos(cliente_id);
create index if not exists idx_prazos_processo_id on prazos(processo_id);
create index if not exists idx_resp_prazo_prazo_id on responsaveis_prazo(prazo_id);
