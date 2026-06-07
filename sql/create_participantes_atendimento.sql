-- Cria tabela participantes_atendimento para vincular participantes a atendimentos
-- Rodar no Supabase SQL Editor (Project → SQL Editor → New query)

create table if not exists participantes_atendimento (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references atendimentos(id) on delete cascade,
  tipo text not null check (tipo in ('cliente','usuario')),
  participante_id uuid,
  nome text,
  criado_em timestamptz default now()
);

-- Habilita RLS e políticas compatíveis com o padrão do projeto
alter table participantes_atendimento enable row level security;
create policy "leitura_autenticados" on participantes_atendimento for select using (auth.role() = 'authenticated');
create policy "escrita_autenticados" on participantes_atendimento for all using (auth.role() = 'authenticated');

-- Opcional: índice para consultas por atendimento
create index if not exists idx_participantes_atendimento_atendimento_id on participantes_atendimento(atendimento_id);
