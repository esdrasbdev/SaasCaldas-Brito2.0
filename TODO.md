# TODO — Correções de Bugs e Melhorias de UI/UX (SaasCaldas-Brito 2.0)

- [x] Tarefa 1: Criar `formatarData` em `frontend/js/utils.js` e substituir exibição de datas em agenda/atendimentos/audiências/perícias.

- [x] Tarefa 2: Garantir que horas em toda interface usem `formatarHora24h` (sem AM/PM) em todos os módulos afetados.

- [x] Tarefa 3: Corrigir bug de +3 horas ao salvar/exibir horários (timezone Fortaleza/BRT) em agenda/atendimentos/audiências/perícias.

- [x] Tarefa 4: Corrigir “Assunto” em `atendimentos.js` extraindo `titulo`/obs de JSON serializado em `anotacoes` quando vindo da agenda.

- [x] Tarefa 5: Garantir mesma estrutura da tabela de atendimentos (thead/tbody) e exibição correta entre ADMIN e demais roles.
- [x] Tarefa 6: Compactar exibição de audiências e perícias (layout denso + hora separada da data) ajustando HTML gerado em JS.


- [x] Tarefa 7a/b: Ajustar CSS de padding de tabela e badges de tipo (judicial/administrativo).
- [x] Tarefa 7c: Ajustar grid do modal em `pericias.html` e `audiencias.html` (Data + Hora lado a lado com grid).

- [x] Tarefa 7d: Aplicar empty state padronizado em módulos com tabelas (quando houver vazio).

- [x] Validar checklist final do prompt (datas, horas 24h, timezone, assunto, roles, compactação, empty states).

