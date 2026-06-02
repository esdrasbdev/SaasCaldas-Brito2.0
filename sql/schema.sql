-- SQL Schema completo para o Sistema de Gestão Jurídica
-- Rodar NO SUPABASE → SQL Editor (New Query)
-- Cria todas as tabelas, RLS e seed dos admins Antonio/Priscila

-- Habilita uuid-ossp extension para gen_random_uuid()
create extension if not exists "uuid-ossp";

-- Tabela de usuários com roles do sistema
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  role text not null check (role in ('ADMIN','ADVOGADO','ADVOGADA','ESTAGIARIO','ESTAGIARIA','SECRETARIA')),
  ativo bool default true,
  criado_em timestamptz default now()
);

-- Tabela de clientes (PF/PJ)
create table clientes (
  id uuid primary key default gen_random_uuid(),
  tipo text check (tipo in ('PF','PJ')),
  nome text not null,
  documento text unique,
  email text,
  telefone text,
  area_juridica text,
  usuario_id uuid references usuarios(id),
  advogado_id uuid references usuarios(id),
  nacionalidade text,
  estado_civil text,
  profissao text,
  cep text,
  endereco text,
  numero text,
  bairro text,
  cidade text,
  estado text,
  inss_senha text,
  criado_em timestamptz default now()
);

-- Tabela de processos judiciais
create table processos (
  id uuid primary key default gen_random_uuid(),
  numero_cnj text unique,
  tribunal text,
  vara text,
  status text default 'ATIVO',
  cliente_id uuid references clientes(id),
  advogado_id uuid references usuarios(id),
  criado_em timestamptz default now()
);

-- Tabela de audiências vinculadas a processos
create table audiencias (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id),
  data timestamptz,
  local text,
  tipo text,
  advogado_id uuid references usuarios(id),
  observacoes text
);

-- Tabela de perícias vinculadas a processos
create table pericias (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid references processos(id),
  data timestamptz,
  tipo text check (tipo in ('Administrativa', 'Judicial')),
  tribunal text,
  vara text,
  local text,
  perito text,
  etapas jsonb default '[]'::jsonb
);

-- Tabela de atendimentos com clientes
create table atendimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id),
  usuario_id uuid references usuarios(id),
  data timestamptz,
  anotacoes text
);

-- Tabela de documentos (com Supabase Storage)
create table documentos (
  id uuid primary key default gen_random_uuid(),
  nome text,
  url text,
  tamanho int,
  tipo text,
  cliente_id uuid references clientes(id),
  processo_id uuid references processos(id),
  upload_por uuid references usuarios(id),
  criado_em timestamptz default now()
);

-- Tabela de publicações do Escavador [ADMIN ONLY]
create table publicacoes (
  id uuid primary key default gen_random_uuid(),
  id_externo text unique,
  processo_id uuid,
  numero_cnj text,
  oab text,
  nome_monitorado text,
  data_publicacao timestamptz,
  conteudo text,
  diario text,
  lida bool default false,
  tipo text,
  prazo_dias int,
  prazo_data date,
  prazo_responsavel text,
  criado_em timestamptz default now()
);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Publicacoes: só ADMIN pode ver/editar
alter table publicacoes enable row level security;
create policy "admin_only_publicacoes" on publicacoes
  using ((select role from usuarios where email = auth.jwt() ->> 'email') = 'ADMIN')
  with check ((select role from usuarios where email = auth.jwt() ->> 'email') = 'ADMIN');

-- Padrão para demais tabelas: leitura/escrita para autenticados
-- (simplificado - ajustar por role conforme necessário)

alter table usuarios enable row level security;
create policy "leitura_usuarios" on usuarios for select using (auth.role() = 'authenticated');
create policy "escrita_usuarios_admin" on usuarios for all 
  using ((select role from usuarios where email = auth.jwt() ->> 'email') = 'ADMIN');

-- Aplicar padrão autenticados para demais tabelas
do $$
declare
  tabela text;
begin
  foreach tabela in array ARRAY[
    'clientes', 'processos', 'audiencias', 'pericias', 
    'atendimentos', 'documentos'
  ] loop
    execute 'alter table ' || tabela || ' enable row level security;';
    execute 'create policy "leitura_autenticados" on ' || tabela || 
            ' for select using (auth.role() = ''authenticated'');';
    execute 'create policy "escrita_autenticados" on ' || tabela || 
            ' for all using (auth.role() = ''authenticated'');';
  end loop;
end $$;

-- ========================================
-- SEED - Usuários ADMIN iniciais
-- ========================================
-- IMPORTANTE: Use emails que já existem no Auth do Supabase

insert into usuarios (nome, email, role) values
  ('Antonio', 'antonio@escritorio.com.br', 'ADMIN'),
  ('Priscila', 'priscila@escritorio.com.br', 'ADMIN')
on conflict (email) do nothing;

-- Confirmação
select 'Schema criado com sucesso! 2 admins inseridos.' as mensagem;
select count(*) as total_tabelas from information_schema.tables 
  where table_schema = 'public' and table_name in (
    'usuarios','clientes','processos','audiencias','pericias',
    'atendimentos','documentos','publicacoes'
  );
