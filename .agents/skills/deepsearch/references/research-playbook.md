# Roteiro de decomposição da pesquisa

Use este checklist para transformar uma pergunta grande em subquestões
respondíveis. Não é um formulário para preencher às cegas: marque o que a
tarefa realmente exige e justifique o que ficou de fora.

## Eixos de decomposição

1. **Definição e fronteiras.** O que é, o que não é, quais termos o ecossistema
   usa. Diferencie conceitos parecidos antes de comparar produtos.
2. **Versão e compatibilidade.** Stack, versão instalada, matriz de suporte,
   mudanças entre versões. Sem versão, a recomendação não é acionável.
3. **Arquitetura.** Componentes, responsabilidades, fronteiras de rede e
   ownership. Onde cada parte roda e quem a opera.
4. **Contratos.** Nomes de método, parâmetros, defaults, payloads, códigos de
   resposta, formatos de token. Aqui a fonte precisa ser aberta, não deduzida.
5. **Segurança.** Autenticação, autorização, segredos, rotação de chaves,
   isolamento entre tenants, exposição de PII em logs.
6. **Operação.** Configuração, deploy, observabilidade, escala, timeouts,
   retries, falha parcial e recuperação.
7. **Dados e migração.** Modelo persistido, compatibilidade retroativa,
   rollout, rollback e Dual-write quando houver mais de um sistema.
8. **Testes.** O que dá para testar sem ambiente real, o que exige integração,
   quais mocks são perigosos e que evidência prova que funcionou.
9. **Alternativas.** Pelo menos uma opção descartada com o motivo. Sem
   alternativa, a recomendação parece única quando não é.
10. **Lacunas.** O que não dá para saber sem rodar, sem acesso ou sem
    experimento. Vira pergunta aberta, nunca fato.

## Exemplo aplicado — SSO + control plane de identity + Spring Boot

- O que significa SSO neste contexto: OIDC, SAML, OAuth2, LDAP ou sessão
  compartilhada? Qual fluxo é suportado pela versão do Spring Security?
- Control plane de identity é diretório, provedor de identidade, broker,
  camada de provisionamento ou govança de acesso? Quem é a fonte da verdade?
- Qual versão de Spring Boot e Spring Security está no projeto? A API de
  Authorization Server mudou entre versões?
- Session vs JWT vs opaque token; quem valida, quem renova, quem revoga.
- JWKS, rotação de chaves, clock skew, `iss`/`aud`, escopo e claims.
- SCIM ou outro mecanismo de provisionamento; desativação de usuário;
  propagação para aplicações consumidoras.
- Multitenancy: tenant por domínio, por claim, por header ou por banco?
- Observabilidade: o que logar sem vazar token ou PII; métricas de login e
  falha de autorização.
- Testes: como simular IdP sem depender de ambiente externo; o que cobrir com
  integração real.
- Migração: como coexistir com o login atual e reverter se a integração
  falhar.

## Quando uma subquestão terminou

Ela termina em um destes estados:

- **Fonte oficial aberta** para a versão relevante, com URL e data.
- **Changelog/RFC/issue** explicando depreciação, motivação ou validade.
- **Inferência rotulada** com alvo concreto de verificação.

Se nenhum dos três aconteceu, continue buscando ou diga explicitamente que a
ferramenta não está disponível. Não encerre com "provavelmente".

## Divergência entre fontes

Quando duas fontes discordam, a documentação oficial da versão em uso vence.
Registre a divergência com as duas URLs e a data: a contradição costuma revelar
uma mudança de versão, um default diferentes ou um artigo desatualizado.
