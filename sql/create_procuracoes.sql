create table if not exists procuracoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) not null,
  documento_id uuid references documentos(id), -- vínculo com o arquivo (PDF/upload) em Vercel Blob
  status text not null default 'ATIVA' check (status in ('ATIVA','PENDENTE','VENCIDA')),
  data_emissao date not null default current_date,
  data_vencimento date,
  criado_por uuid references usuarios(id),
  criado_em timestamptz default now()
);

alter table procuracoes enable row level security;

create policy "leitura_autenticados" on procuracoes for select using (auth.role() = 'authenticated');
create policy "escrita_autenticados" on procuracoes for all using (auth.role() = 'authenticated');

