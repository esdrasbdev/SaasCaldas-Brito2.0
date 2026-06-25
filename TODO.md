# TODO - SaasCaldas-Brito (execução do prompt.md)

## Concluído
- [x] Bloco 1: corrigir bug de inicialização do `frontend/js/admin.js` (await initSupabase antes do `AdminController.init()`)
- [x] `frontend/admin.html`: garantir `js/env.js` carregado e ajustar ordem/indentação do script `supabase.js`
- [x] Bloco 6.1–6.3: `frontend/atendimentos.html` e `frontend/js/atendimentos.js` (campo `atend-responsavel`, carregar responsáveis ativos, payload usa responsável selecionado)
- [x] Remoção de placeholder em `frontend/audiencias.html` (input local)

## Pendente (para acabar problemas)
- [x] Bloco 6.5: em `frontend/js/atendimentos.js`, preencher `#atend-responsavel` ao abrir modo **visualizar/editar** (usar `data.usuario_id`)
- [x] Bloco 5: remover placeholders em modais de `pericias.html`, `atendimentos.html`, `clientes.html`, `processos.html` (exceto buscas)



- [x] Bloco 4: corrigir renderização/colunas da tabela de `audiencias`

## Implementação nova (Central de Documentos do Cliente)
- [x] Adicionar aba/seção de Documentos no modal de Clientes com cards e botões
- [x] Implementar Gerar/Visualizar/Baixar via template HTML + window.print()


