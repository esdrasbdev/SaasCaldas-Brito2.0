# Prompt.md — Rodada 3 de Correções (Análise Completa e Implementação)

## Contexto

Analise integralmente o repositório antes de realizar qualquer alteração.

**Repositório:**
https://github.com/esdrasbdev/SaasCaldas-Brito2.0.git

Esta rodada tem como objetivo corrigir problemas estruturais encontrados após a implementação das últimas funcionalidades.

É extremamente importante **não criar regressões**, **não alterar regras de negócio existentes** e **seguir exatamente o padrão arquitetural já utilizado no projeto**.

Antes de modificar qualquer arquivo:

- compreenda o fluxo completo da funcionalidade;
- identifique todos os pontos onde a funcionalidade é utilizada;
- procure funções já existentes que possam ser reutilizadas;
- mantenha o padrão de nomenclatura do projeto.

---

# PROBLEMA 01 — Corrigir definitivamente o erro 400 na alteração de senha

## Situação atual

Ao editar um usuário e alterar sua senha, algumas contas funcionam normalmente.

Outras retornam:

```
400 Bad Request
```

no navegador.

Esse erro ocorre principalmente em usuários mais antigos ou criados manualmente.

A análise do código mostrou que o endpoint atualmente utiliza:

```javascript
supabaseAdmin.auth.admin.updateUserById(...)
```

Entretanto, ele utiliza o ID armazenado na tabela:

```
public.usuarios
```

e assume que esse ID é exatamente igual ao existente em:

```
auth.users
```

Essa premissa nem sempre é verdadeira.

Alguns usuários possuem IDs sincronizados.

Outros não.

Quando existe essa divergência, o Supabase não encontra o usuário do Auth e retorna erro 400.

---

## Objetivo

A alteração de senha deve funcionar para **100% dos usuários**, independentemente de quando eles foram criados.

O sistema deve ser resiliente a inconsistências entre:

- auth.users
- public.usuarios

Sem necessidade de alterar manualmente o banco.

---

## Implementação esperada

Reescrever a lógica da rota responsável pela alteração de senha.

Fluxo esperado:

### Primeira tentativa

Utilizar normalmente o ID recebido.

Caso funcione:

- finalizar.

---

### Caso falhe

Se o Auth retornar erro de usuário inexistente ou erro relacionado ao ID:

Executar automaticamente:

1. Buscar o registro correspondente na tabela:

```
usuarios
```

2. Obter o e-mail desse usuário.

3. Localizar no Auth o usuário correspondente.

4. Recuperar o verdadeiro Auth ID.

5. Executar novamente:

```javascript
updateUserById(...)
```

utilizando o ID correto.

Todo esse processo deve ser transparente para o usuário.

Não deve existir necessidade de repetir a operação.

---

## Tratamento de erros

Criar tratamento específico para os erros mais comuns do Supabase.

Nunca retornar mensagens técnicas.

Exemplos:

### Senha curta

Mostrar:

```
A senha deve possuir pelo menos X caracteres.
```

---

### Senha igual à anterior

Mostrar:

```
A nova senha deve ser diferente da senha atual.
```

---

### Usuário não encontrado

Mostrar:

```
Não foi possível localizar este usuário.
```

---

### Erro interno

Mostrar:

```
Não foi possível alterar a senha.
Tente novamente em instantes.
```

---

## Front-end

Verificar também:

- tratamento do fetch;
- tratamento do axios (caso exista);
- exibição dos Toasts;
- tratamento de Promise rejection.

Nenhum erro técnico deve aparecer ao usuário.

Os erros devem ser apresentados de forma amigável.

---

# PROBLEMA 02 — Permitir acesso completo para ESTAGIÁRIOS em Audiências e Perícias

## Situação atual

Os usuários:

```
ESTAGIARIO
ESTAGIARIA
```

não conseguem acessar:

- Audiências
- Perícias

Entretanto conseguem acessar:

- Atendimentos

O comportamento esperado é que esses três módulos possuam exatamente a mesma política de acesso.

---

## Diagnóstico encontrado

Existem duas camadas diferentes restringindo o acesso.

### Primeira camada

```
sidebar.js
```

As opções simplesmente não aparecem no menu.

---

### Segunda camada

```
guard.js
```

Mesmo acessando a URL diretamente, o sistema redireciona o usuário.

---

## Correção

### Sidebar

Adicionar:

```
ESTAGIARIO
ESTAGIARIA
```

na lista de permissões de:

- audiencias.html
- pericias.html

Seguir exatamente o mesmo padrão utilizado no módulo:

```
atendimentos.html
```

---

### Guard

Hoje essas páginas exigem:

```javascript
requiredRole: 'ADVOGADO'
```

Alterar para o mesmo comportamento utilizado em:

```
atendimentos.html
```

Não criar nova lógica.

Reutilizar a existente.

---

## Verificações

Após alterar:

O usuário ESTAGIÁRIO deve conseguir:

- visualizar o menu;
- abrir a página;
- cadastrar;
- editar;
- visualizar registros;
- utilizar todos os recursos permitidos pelo sistema.

Não alterar nenhuma regra do backend.

Não alterar nenhuma Policy do Supabase.

Não alterar RLS.

Apenas remover a restrição indevida da interface.

---

# PROBLEMA 03 — Corrigir o componente de responsáveis no módulo Clientes

## Situação

Na tela de visualização do cliente existe um erro visual.

Ao visualizar responsáveis aparecem letras, ícones ou caracteres sobrepostos aos responsáveis selecionados.

Isso prejudica completamente a leitura.

---

## Diagnóstico

Foi identificado que o componente:

```
responsaveis-select
```

utiliza:

```css
.seletor-responsaveis::before
```

Esse pseudo-elemento permanece sendo renderizado mesmo quando o componente está em modo somente leitura.

Como consequência:

- o ícone fica sobre as tags;
- as iniciais ficam desalinhadas;
- ocorre sobreposição visual.

---

## Objetivo

O componente deve possuir dois comportamentos distintos.

### Modo edição

Manter exatamente como já funciona hoje.

Nada deve ser alterado.

O usuário continua podendo:

- pesquisar;
- adicionar;
- remover responsáveis.

---

### Modo visualização

Não deve existir:

- campo de pesquisa;
- cursor de edição;
- pseudo-elementos;
- ícones sobrepostos.

Devem aparecer apenas:

- avatar;
- nome;
- layout limpo.

---

## Revisar CSS

Analisar cuidadosamente:

```
responsaveis-select.css
```

Verificar:

- position;
- absolute;
- relative;
- pseudo-elements;
- ::before;
- z-index;
- overflow;
- display;
- flex;
- align-items;
- line-height;
- pointer-events.

Corrigir sem afetar o modo edição.

---

## Revisar JavaScript

Verificar também:

```
responsaveis-select.js
```

e confirmar que:

- nenhum elemento oculto continua sendo renderizado;
- nenhum listener permanece ativo quando o componente estiver bloqueado;
- nenhuma classe CSS incorreta é aplicada no modo visualização.

---

# Testes obrigatórios

Antes de finalizar executar uma revisão completa.

## Usuários

- Criar usuário
- Editar usuário
- Alterar senha
- Alterar senha de usuário antigo
- Alterar senha de usuário recém criado

Todos devem funcionar.

---

## Permissões

Testar login com:

- ADMIN
- ADVOGADO
- ESTAGIARIO
- ESTAGIARIA
- SECRETARIA

Verificar acesso aos módulos:

- Clientes
- Processos
- Atendimentos
- Audiências
- Perícias

Confirmar que apenas as permissões pretendidas foram alteradas.

---

## Clientes

Abrir:

Visualizar Cliente

Testar:

- sem responsáveis;
- um responsável;
- vários responsáveis.

Garantir que:

- não exista sobreposição;
- o layout permaneça alinhado;
- nenhum caractere estranho apareça.

---

## Código

Antes de concluir:

- remover código morto;
- remover comentários temporários;
- remover logs de debug;
- remover console.log;
- remover TODOs adicionados durante a implementação.

Seguir o padrão do projeto.

Não duplicar funções.

Reutilizar componentes existentes.

---

# Resultado esperado

Ao finalizar, apresentar um relatório contendo:

## Arquivos modificados

Listar todos.

---

## Alterações realizadas

Explicar detalhadamente cada alteração.

---

## Motivo técnico

Explicar por que cada alteração foi necessária.

---

## Possíveis impactos

Informar se alguma alteração influencia outros módulos.

---

## Testes realizados

Listar todos os testes executados e seus respectivos resultados.

---

## Validação final

Confirmar explicitamente que:

- ✅ alteração de senha funciona para usuários antigos e novos;
- ✅ erro 400 foi eliminado;
- ✅ estagiários possuem acesso a Audiências e Perícias;
- ✅ Atendimentos continua funcionando normalmente;
- ✅ o componente de responsáveis foi corrigido;
- ✅ nenhuma regressão foi identificada;
- ✅ aplicação inicia normalmente;
- ✅ console permanece sem novos erros.