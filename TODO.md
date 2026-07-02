# TODO.md — Implementação das Correções (Rodada 3)

## Passo 1 — Plano confirmado
- [x] Ler prompt.md (escopo e requisitos)
- [x] Inspecionar arquivos relevantes (usuarios.js, guard.js, sidebar.js, responsaveis-select.js, style.css)
- [x] Atualizar TODO e confirmar execução




## Passo 2 — Corrigir erro 400 ao alterar senha (usuários antigos)
- [x] Atualizar `backend/routes/usuarios.js`:

  - [x] Implementar tentativa primária com updateUserById(id recebido)

  - [x] Se falhar por ID inexistente, buscar email na `public.usuarios` e localizar Auth ID via listUsers()

  - [x] Reexecutar updateUserById com Auth ID correto

  - [x] Mensagens de erro amigáveis


## Passo 3 — Permitir acesso completo a ESTAGIÁRIO em Audiências e Perícias

- [x] Atualizar `frontend/js/guard.js`:

  - [x] `audiencias.html`: requiredRole -> null
  - [x] `pericias.html`: requiredRole -> null
- [x] Atualizar `frontend/js/sidebar.js`:

  - [x] `audiencias.html`: incluir ESTAGIARIO/ESTAGIARIA

  - [x] `pericias.html`: incluir ESTAGIARIO/ESTAGIARIA


## Passo 4 — Corrigir modo visualização do componente de responsáveis
- [ ] Atualizar `frontend/css/style.css`:
  - [x] esconder `.seletor-responsaveis.is-disabled::before`



- [ ] Atualizar `frontend/js/responsaveis-select.js`:
  - [x] `setDisabled(true)` fechar dropdown e impedir interação

  - [x] evitar sobreposição/artefatos visuais no modo leitura


## Passo 5 — Validação
- [ ] Testar cenário: alterar senha (usuário antigo e novo)
- [ ] Testar cenário: estagiários acessam Audiências/Perícias via menu e URL direta
- [ ] Testar cenário: visualizar cliente com responsáveis (sem sobreposição)
- [ ] Garantir que não houve regressão em Atendimentos

