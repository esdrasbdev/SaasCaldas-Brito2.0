# TODO.md — SaasCaldas-Brito 2.0

- [x] Corrigir `frontend/login.html` para mensagem genérica de credenciais inválidas (sem menção a Supabase Auth) e tratar caso de usuário inativo separadamente

- [x] Atualizar `backend/seed.js` adicionando `rayssalima0507@gmail.com` (role `ESTAGIARIO`, senha `estagio123`) e garantir que não duplica `raul_limasilveira@hotmail.com`

- [x] Completar `frontend/js/processos.js` para integrar `responsaveis_processo`:
  - [x] instanciar `criarSeletorResponsaveis` no modal (proc-responsaveis-*)
  - [x] popular responsáveis em view/edit
  - [x] validar seleção no submit
  - [x] sincronizar tabela `responsaveis_processo` ao salvar
  - [x] manter `advogado_id` como primeiro responsável (se existir no schema/fluxo)
  - [x] exibir responsáveis na listagem

- [ ] Revisar/ajustar `frontend/processos.html` caso o HTML esteja duplicado/quebrado e impeça o funcionamento do modal

