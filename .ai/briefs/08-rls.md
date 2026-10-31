# POLÍTICAS DE RLS (Row Level Security)

- `users`: Usuário só pode SELECT/UPDATE onde `id = auth.uid()`.
- `transacoes`: Usuário só pode SELECT/INSERT/UPDATE/DELETE onde `userId = auth.uid()`.
- `arquivamentos`: Usuário só pode SELECT/INSERT/DELETE onde `userId = auth.uid()`.
- `ativos`: Leitura liberada para qualquer usuário autenticado. Escrita bloqueada (só via service role/seed).
- `cotacoes`: Leitura liberada para qualquer usuário autenticado. Escrita bloqueada (só via service role/script Python).