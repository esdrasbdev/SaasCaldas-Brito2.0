# Correções e Melhorias Necessárias no Sistema

## 1. Horários (Remover AM/PM)

Atualmente o sistema exige a seleção de horários utilizando o formato AM/PM.

### Alterações desejadas:

* Remover completamente o formato AM/PM em todos os módulos do sistema.
* Utilizar exclusivamente o padrão brasileiro de 24 horas.
* Exemplos:

  * 08:00
  * 13:30
  * 18:45
  * 23:59
* Garantir que todos os campos de horário existentes utilizem esse padrão.
* Revisar formulários, tabelas, filtros, cadastros e telas de edição para garantir consistência.

---

## 2. Melhorias no Dark Mode

O modo escuro apresenta problemas visuais e inconsistências.

### Correções necessárias:

* Revisar toda a identidade visual do Dark Mode.
* Melhorar contraste entre textos, ícones, botões e fundos.
* Corrigir componentes que ficam ilegíveis ou com cores inadequadas.
* Garantir consistência visual em todas as telas.

### Bug específico:

* Ao alterar a cor do sistema, a foto/avatar do usuário fica visualmente quebrada ou desalinhada.
* Corrigir o comportamento da foto para que:

  * mantenha o alinhamento correto;
  * respeite bordas e arredondamentos;
  * não sofra distorções;
  * funcione corretamente em qualquer tema ou cor escolhida.

---

## 3. Dados Pré-Selecionados na Edição

Ao editar registros em qualquer setor, o usuário precisa preencher novamente diversos campos.

### Alteração desejada:

* Sempre que um registro for aberto para edição:

  * carregar automaticamente todos os dados já existentes;
  * preencher os campos com os valores atuais;
  * permitir que o usuário altere apenas o que desejar.
* Aplicar essa regra em todos os módulos e setores do sistema.

---

## 4. Padronização de Datas

### Alteração desejada:

Padronizar todas as datas do sistema para o formato brasileiro:

DD/MM/AAAA

### Exemplos:

* 05/06/2026
* 21/12/2026

### Aplicar em:

* Formulários
* Tabelas
* Relatórios
* Filtros
* Modal de edição
* Exportações
* Impressões

Remover qualquer utilização de:

* MM/DD/YYYY
* YYYY-MM-DD

na interface apresentada ao usuário.

---

## 5. Correção de Duplicação ao Editar Audiências

Foi identificado um problema crítico.

### Comportamento atual:

Ao editar uma audiência, o sistema cria um novo registro em vez de atualizar o registro existente.

### Comportamento esperado:

* Ao clicar em salvar:

  * atualizar o registro existente;
  * preservar o mesmo ID;
  * não criar novos registros;
  * não gerar duplicações.

### Revisão adicional:

Verificar se esse mesmo problema ocorre em:

* Atendimentos
* Processos
* Clientes
* Audiências
* Tarefas
* Agenda
* Qualquer outro módulo com funcionalidade de edição

Caso encontrado, corrigir o fluxo para utilizar UPDATE em vez de INSERT durante a edição.

---

## 6. Correção do Bug em Atendimentos

Erro identificado:

```javascript
Auth listener attached

atendimentos.js:73
Uncaught SyntaxError: Unexpected token '<'
```

### Realizar investigação completa

Verificar especialmente:

1. Se algum endpoint está retornando HTML ao invés de JSON.

2. Se existe erro em:

```javascript
response.json()
```

quando a resposta recebida é uma página HTML.

3. Se há arquivos JavaScript sendo carregados incorretamente.

4. Se existe alguma rota inexistente retornando:

* index.html
* página de erro
* página de login

5. Verificar a linha 73 do arquivo:

```javascript
atendimentos.js
```

e identificar exatamente qual conteúdo está gerando o caractere `<`.

### Resultado esperado:

* Eliminar completamente o erro.
* Garantir que todos os retornos de API sejam tratados corretamente.
* Adicionar tratamento de erros para evitar falhas semelhantes futuramente.

---

## 7. Validação Final

Após concluir todas as alterações:

* Revisar todos os módulos.
* Executar testes de cadastro.
* Executar testes de edição.
* Executar testes de exclusão.
* Executar testes de filtros.
* Executar testes no modo claro e escuro.
* Garantir que nenhuma funcionalidade existente seja impactada.

Gerar um relatório final contendo:

* Arquivos modificados.
* Correções realizadas.
* Bugs encontrados.
* Melhorias implementadas.
* Possíveis pontos de atenção para futuras manutenções.
