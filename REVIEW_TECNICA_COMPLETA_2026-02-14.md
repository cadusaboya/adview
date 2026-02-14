# Review Técnica Completa (Backend + Frontend)

Data: 2026-02-14  
Escopo solicitado:
- Revisão linha a linha de `backend/core/views.py`.
- Revisão do frontend completo (`frontend/src/**`) com validações automáticas e inspeção dos módulos críticos.

## Ambiente e validações executadas

### Backend (com `venv`)
- `source backend/venv/bin/activate && python backend/manage.py check` -> OK (0 issues)
- `source backend/venv/bin/activate && python backend/manage.py test` -> 0 testes encontrados

### Frontend
- `npm run lint` -> **falha** (2 erros em `frontend/src/app/assinatura/page.tsx`)
- `npm run build` -> build compila, mas falha no lint
- `npx tsc --noEmit` -> **falha** por arquivos `.next/types` ausentes (configuração/estado de typegen)

---

## Findings (ordenados por severidade)

## Crítico

1. CSRF trusted origins quebrado por concatenação acidental de strings  
Arquivo: `backend/gestao_financeira/settings.py:203` e `backend/gestao_financeira/settings.py:204`  
Problema: falta vírgula entre URLs, gerando uma origem inválida e quebrando a proteção esperada em produção.

2. Superfície de ataque aberta em produção (`ALLOWED_HOSTS`/CORS)  
Arquivo: `backend/gestao_financeira/settings.py:40`, `backend/gestao_financeira/settings.py:120`  
Problema: `ALLOWED_HOSTS = ["*"]` e `CORS_ALLOW_ALL_ORIGINS = True` expõem a aplicação além do necessário.

3. Webhook Asaas com autenticação em query string e `csrf_exempt`  
Arquivo: `backend/core/views.py:4495`, `backend/core/views.py:4502`  
Problema: token na URL tende a vazar em logs/proxies e não é o método mais seguro de autenticação de webhook.

---

## Alto

1. Cálculo de próxima cobrança pode gerar erro em fim de mês/ano bissexto  
Arquivo: `backend/core/views.py:4255`, `backend/core/views.py:4260`, `backend/core/views.py:4541`  
Problema: `date.replace(...)` sem ajuste de dia válido pode lançar exceção (ex.: 31 para meses de 30/28 dias, 29/02 em ano não bissexto).

2. Cadastro (`register`) sem transação atômica  
Arquivo: `backend/core/views.py:4470`, `backend/core/views.py:4475`  
Problema: se usuário falhar após criar empresa, fica empresa órfã/inconsistente.

3. Criação de `Receita`/`Despesa` com “marcar como pago” sem transação única  
Arquivo: `backend/core/views.py:438-481`, `backend/core/views.py:866-913`  
Problema: cria lançamento, payment, allocation e atualiza saldo em passos separados; falha intermediária deixa estado inconsistente.

4. Importação de extrato sem atomicidade de lote  
Arquivo: `backend/core/views.py:1647-1665`  
Problema: cria pagamentos e atualiza saldo item a item; erro parcial no meio deixa import incompleta com saldo alterado parcialmente.

5. Classificação de conciliação por conta está incorreta  
Arquivo: `backend/core/views.py:4007-4010`  
Problema: marca como “conciliado” quando há qualquer allocation (`num_allocations > 0`), mas o critério global usa conciliação total (valor alocado == valor do pagamento).

---

## Médio

1. `Company.objects.get(...)` sem tratamento em mixin  
Arquivo: `backend/core/views.py:54`  
Problema: `company_id` inválido em create pode resultar em erro 500 (deveria retornar 400).

2. Exposição de erro interno para cliente  
Arquivo: `backend/core/views.py:4141`  
Problema: retorna `Erro interno: {str(e)}` para o frontend, potencialmente vazando detalhes internos.

3. Uso de `print(...)` em produção  
Arquivo: `backend/core/views.py:1481`, `backend/core/views.py:4140`  
Problema: logging inconsistente e difícil de rastrear/estruturar.

4. Cálculo de “últimos 6 meses” por subtração de 30 dias  
Arquivo: `backend/core/views.py:2877`, `backend/core/views.py:2917`  
Problema: aproximação por 30 dias pode deslocar mês (não respeita calendário real).

5. Uso de `datetime.now()` em views com timezone habilitado  
Arquivo: `backend/core/views.py:3593`, `backend/core/views.py:3703`, `backend/core/views.py:3920`  
Problema: mistura com `timezone.now()` pode gerar inconsistência de data em ambiente com TZ.

6. Duplicidade de nome de rota Django  
Arquivo: `backend/core/urls.py:89`, `backend/core/urls.py:92`  
Problema: `name='relatorio-fluxo-de-caixa'` aparece duas vezes, quebrando `reverse()` previsível.

7. Muitos `except Exception` amplos em fluxos críticos  
Arquivo: `backend/core/views.py` (ex.: `641`, `777`, `1064`, `1200`, `4291`, `4358`, `4426`, `4569`)  
Problema: oculta causas-raiz e dificulta tratamento correto por tipo de falha.

8. Sem suíte de testes efetiva no backend  
Arquivo: `backend/core/tests.py:1`  
Problema: regressões de regra de negócio (pagamentos, conciliação, assinatura) passam sem detecção.

9. Frontend não passa lint  
Arquivo: `frontend/src/app/assinatura/page.tsx:14`, `frontend/src/app/assinatura/page.tsx:195`  
Problema: import/variável não usados bloqueiam pipeline (`next lint`/`next build`).

10. `tsc --noEmit` falha por `include` em `.next/types` sem arquivos válidos no estado atual  
Arquivo: `frontend/tsconfig.json:25`  
Problema: checagem de tipos fora do fluxo `next build` não é estável no workspace atual.

---

## Baixo / Melhoria técnica

1. Tokens no `localStorage` aumentam risco de exfiltração via XSS  
Arquivo: `frontend/src/services/api.ts:15`, `frontend/src/services/auth.ts:16-18`  
Sugestão: migrar para cookie `HttpOnly` + CSRF.

2. Em 401 remove apenas `token`, não remove `refresh_token` no interceptor  
Arquivo: `frontend/src/services/api.ts:36-37`  
Sugestão: limpar também `refresh_token` local/session.

3. Uso de `window.location.href` em fluxo Next.js (navegação hard reload)  
Arquivo: `frontend/src/services/api.ts:44`, `frontend/src/services/api.ts:52`, `frontend/src/app/page.tsx:57`, `frontend/src/app/cadastro/page.tsx:63`  
Sugestão: preferir `router.push`/`router.replace` quando em componentes client.

4. Logs de debug ainda presentes em serviços  
Arquivo: `frontend/src/services/api.ts:22-24`, `frontend/src/services/pdf.ts:164-165`, `frontend/src/services/relatorios.ts:66`, `frontend/src/services/relatorios.ts:110`, `frontend/src/services/relatorios.ts:231`  
Sugestão: padronizar logging por nível/ambiente.

5. Diversos `eslint-disable react-hooks/exhaustive-deps` no frontend  
Exemplos: `frontend/src/components/imports/PaymentsTabs.tsx:275`, `frontend/src/app/despesas/pagas/page.tsx:111`, `frontend/src/app/despesas/pagar/page.tsx:121`  
Sugestão: revisar dependências dos efeitos para evitar stale closures e bugs intermitentes.

---

## Pontos de atenção específicos do `views.py` (revisão integral)

1. O arquivo está muito grande (4.5k linhas), com múltiplas responsabilidades misturadas:
- CRUD transacional
- importação/concilição bancária
- dashboard/relatórios
- assinatura/webhook

Sugestão:
- extrair por módulos (`payments_views.py`, `reports_views.py`, `subscription_views.py`, `webhook_views.py`)
- centralizar regras financeiras em serviços de domínio com transações explícitas.

2. Fluxos financeiros (pagamentos/alocações/saldos) têm trechos robustos (`transaction.atomic` em parte de `PaymentViewSet`), mas ainda há caminhos sem atomicidade.

3. Conciliação e importação têm lógica de negócio avançada, porém com custo computacional alto e bastante lógica em memória.

---

## Prioridade de correção (ordem sugerida)

1. Corrigir segurança/configuração de produção e webhook (itens críticos).  
2. Corrigir cálculos de data de cobrança e atomicidade em cadastro/pagamentos/importação.  
3. Corrigir conciliação por conta (critério de “conciliado”).  
4. Limpar lint frontend e estabilizar typecheck.  
5. Criar testes automáticos mínimos para assinatura, importação e conciliação.

---

## Resultado final da revisão

- `backend/core/views.py`: revisado integralmente por blocos de linha.  
- `frontend/src/**`: revisado com validações automáticas e inspeção manual dos módulos críticos/maiores (serviços, dashboard, assinatura, pagamentos, cadastro, contextos/hooks).
