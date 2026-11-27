modo esperado: security

# Revisão estática de autenticação

Em um projeto real, avalie a superfície de login indicada por
`src/auth/routes.ts`. Ponto de partida: esse arquivo.

Resultado esperado: percorrer origem e efeito, classificar cada achado como
`suspeito`, `fraca confirmada em código` ou `requer runtime`, mapear CWE/ASVS/
Top 10 com versões fixadas e entregar handoff para `pentest` somente no que
exigir runtime autorizado. Sem payload e sem segredo no relatório.
