-- Permite múltiplos responsáveis por cliente, no mesmo padrão de
-- responsaveis_audiencia / responsaveis_pericia / responsaveis_atendimento
-- / responsaveis_processo (ver sql/create_responsaveis_multiplos.sql).

create table if not exists responsaveis_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (cliente_id, usuario_id)
);

alter table responsaveis_cliente enable row level security;

create policy "leitura_autenticados" on responsaveis_cliente
  for select using (auth.role() = 'authenticated');

create policy "escrita_autenticados" on responsaveis_cliente
  for all using (auth.role() = 'authenticated');

create index if not exists idx_resp_cliente_cliente_id
  on responsaveis_cliente(cliente_id);

