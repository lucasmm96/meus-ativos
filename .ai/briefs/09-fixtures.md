# FIXTURES DE TESTE (src/core/__tests__/fixtures/)

O `core-agent` deve criar um arquivo `transacoes.json` com a seguinte estrutura para testar as funções de cálculo:

```json
[
  {
    "id": "1",
    "userId": "user-1",
    "ativoTicker": "ITSA4F",
    "tickerCotacao": "ITSA4",
    "tipo": "ACAO",
    "data": "2023-09-11",
    "valorUnitario": "9.07",
    "quantidade": 22
  }
]