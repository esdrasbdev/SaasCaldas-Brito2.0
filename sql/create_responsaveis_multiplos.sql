-- Cria tabelas de junção para permitir múltiplos responsáveis por registro
-- em audiências, perícias, atendimentos e processos.
-- Rodar no Supabase SQL Editor (Project → SQL Editor → New query)

create table if not exists responsaveis_audiencia (
  id uuid primary key default gen_random_uuid(),
  audiencia_id uuid not null references audiencias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (audiencia_id, usuario_id)
);

create table if not exists responsaveis_pericia (
  id uuid primary key default gen_random_uuid(),
  pericia_id uuid not null references pericias(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (pericia_id, usuario_id)
);

create table if not exists responsaveis_atendimento (
  id uuid primary key default gen_random_uuid(),
  atendimento_id uuid not null references atendimentos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (atendimento_id, usuario_id)
);

create table if not exists responsaveis_processo (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processos(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  criado_em timestamptz default now(),
  unique (processo_id, usuario_id)
);

-- RLS compatível com o padrão do projeto (leitura/escrita para autenticados)
do $$
declare
  tabela text;
begin
  foreach tabela in array ARRAY[
    'responsaveis_audiencia', 'responsaveis_pericia',
    'responsaveis_atendimento', 'responsaveis_processo'
  ] loop
    execute 'alter table ' || tabela || ' enable row level security;';
    execute 'create policy "leitura_autenticados" on ' || tabela ||
            ' for select using (auth.role() = ''authenticated'');';
    execute 'create policy "escrita_autenticados" on ' || tabela ||
            ' for all using (auth.role() = ''authenticated'');';
  end loop;
end $$;

-- Índices para consultas por registro pai
create index if not exists idx_resp_audiencia_audiencia_id on responsaveis_audiencia(audiencia_id);
create index if not exists idx_resp_pericia_pericia_id on responsaveis_pericia(pericia_id);
create index if not exists idx_resp_atendimento_atendimento_id on responsaveis_atendimento(atendimento_id);
create index if not exists idx_resp_processo_processo_id on responsaveis_processo(processo_id);
