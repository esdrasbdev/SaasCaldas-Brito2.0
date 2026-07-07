-- Adiciona status de arquivamento para audiências e perícias

alter table audiencias
  add column if not exists status text not null default 'ATIVA'
  check (status in ('ATIVA','ARQUIVADA'));

alter table pericias
  add column if not exists status text not null default 'ATIVA'
  check (status in ('ATIVA','ARQUIVADA'));

create index if not exists idx_audiencias_status on audiencias(status);
create index if not exists idx_pericias_status on pericias(status);

