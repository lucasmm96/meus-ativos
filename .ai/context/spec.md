# SPECIFICATION — Meus Ativos

## 1. Visão Geral
Aplicação web PWA para controle de carteira de renda variável (Ações e FIIs). Foca no registro de aportes, cálculo de preço médio, acompanhamento de valor de mercado (via histórico de cotações do COTAHIST) e visualização gráfica.

## 2. Funcionalidades Principais (MVP)

### 2.1. Autenticação e Sessão
- Login e Cadastro abertos via Neon Auth.
- Sessão persistente ("Lembrar de mim").
- Aviso visual persistente caso `navigator.onLine` seja falso.

### 2.2. Gestão de Transações (Aportes)
- CRUD de compras: ID do ativo, data, valor unitário e quantidade.
- Cálculo do total (`valor * quantidade`).
- Catálogo de ativos pré-definido (Ação ou FII).

### 2.3. Arquivamento de Ativos
- O usuário pode "Arquivar" um ativo (indicando que não o possui mais).
- O sistema registra a data de arquivamento na tabela relacional.
- O ativo arquivado não aparece nos gráficos de alocação atual, mas **aparece** no gráfico de evolução patrimonial até a data do arquivamento.
- O usuário pode desarquivar (basta remover o registro) ou comprar novamente (o que reativa a posição).

### 2.4. Visualizações e Gráficos (Recharts)
1.  **Cards de Resumo:** Total em Ações (R$), Total em FIIs (R$), Total Geral (R$).
2.  **Gráfico Pizza (Valor):** Proporção do valor investido. Cores: Verde (Ações) e Azul (FIIs).
3.  **Gráfico Pizza (Cotas):** Proporção da quantidade. Cores: Verde e Azul.
4.  **Gráfico Barras (Valor):** Horizontal. Valor investido por ativo. Ordenado decrescente. Verde (Ações) e Azul (FIIs).
5.  **Gráfico Barras (Cotas):** Vertical. Quantidade por ativo. Verde (Ações) e Azul (FIIs).
6.  **Gráfico de Linha (Evolução):** Evolução do patrimônio total ao longo do tempo, usando `close_price` da tabela `cotacoes`.

### 2.5. Integração de Dados Históricos
- O frontend consome a tabela `cotacoes` do Neon.
- O sistema calcula o P&L atual e o valor de mercado da carteira com base na cotação mais recente.

## 3. Fora de Escopo (MVP1)
- Registro de vendas.
- Registro de proventos/dividendos.
- Funcionamento offline.