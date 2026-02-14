# Revisão Técnica Completa — ERP-Adv
**Branch:** `create/assinaturas`
**Data:** 2026-02-14
**Escopo:** Backend Django + Frontend Next.js + Feature de Assinaturas

---

## Sumário Executivo

O sistema está **funcionalmente sólido** para as operações de ERP financeiro. A feature de assinaturas tem boa arquitetura, mas apresenta **problemas críticos de segurança e conformidade PCI** que **impedem o deploy em produção** sem correção.

| Severidade | Quantidade | Status |
|------------|-----------|--------|
| 🔴 CRÍTICO | 4 | Bloqueia produção |
| 🟠 ALTO | 10 | Deve corrigir antes de ir a produção |
| 🟡 MÉDIO | 8 | Corrigir em breve |
| 🟢 BAIXO | 8 | Backlog de qualidade |

---

## 🔴 CRÍTICO — Bloqueia Produção

### C1. `.env` com credenciais reais commitado no repositório
**Arquivo:** `backend/.env`
**Problema:** O arquivo `.env` está trackeado pelo git e contém:
- `SECRET_KEY` do Django (insegura, com prefixo `django-insecure-`)
- `DB_PASSWORD=juris1234` — senha do banco em texto claro
- `ASAAS_API_KEY` — chave real da sandbox Asaas exposta
- `ASAAS_WEBHOOK_TOKEN=qualquer_string_secreta_ex_abc123` — token fraco

**Impacto:** Qualquer pessoa com acesso ao repositório tem acesso ao banco de dados e ao gateway de pagamento.

**Ação imediata:**
1. Remover `.env` do histórico git (`git rm --cached backend/.env` + BFG Repo-Cleaner se já commitado)
2. Adicionar `backend/.env` ao `.gitignore`
3. **Rotacionar todas as credenciais expostas** (nova SECRET_KEY, nova senha DB, novas chaves Asaas)
4. Criar `backend/.env.example` com valores placeholder

---

### C2. Dados completos de cartão de crédito passam pelo backend
**Arquivo:** `frontend/src/app/assinar/pagamento/page.tsx`
**Problema:** O número completo do cartão (16 dígitos), CVV e vencimento são enviados para o backend Django antes de chegarem ao Asaas:
```typescript
await assinar({
  plano_slug: plano.slug,
  ciclo,
  billing_type: 'CREDIT_CARD',
  credit_card: { ...card, number: card.number.replace(/\s/g, '') }, // número completo!
  holder_info: holder,
});
```

**Impacto:** O backend se torna **titular de dados de cartão (PCI DSS Scope)**. Um breach expõe todos os dados. Viola PCI DSS SAQ A-EP/D.

**Correção:** Usar o SDK de criptografia client-side do Asaas para tokenizar o cartão no browser antes de enviar ao backend. O backend só deve receber o token criptografado.

---

### C3. Webhook sem verificação criptográfica de assinatura
**Arquivo:** `backend/core/views.py` (função `asaas_webhook`)
**Problema:** O webhook verifica apenas um token na query string (`?token=...`) com comparação de string simples, vulnerável a timing attacks. O header de autenticação real do Asaas não está sendo validado:
```python
token = request.GET.get('token', '')
configured_token = (django_settings.ASAAS_WEBHOOK_TOKEN or '').strip()
if token != configured_token:  # vulnerável a timing attack!
    return JsonResponse({'detail': 'Unauthorized'}, status=401)
```

**Impacto:** Qualquer atacante que descubra a URL pode enviar eventos falsos — ativar assinaturas sem pagar, cancelar assinaturas de clientes.

**Correção:**
1. Usar `secrets.compare_digest()` em vez de `!=`
2. Verificar o header de autenticação do Asaas conforme documentação oficial

---

### C4. `card_token` armazenado em plaintext no banco
**Arquivos:** `backend/core/models.py`, migration `0031_add_card_token_assinaturaempresa.py`
**Problema:** Token de cartão salvo em `CharField` sem criptografia em repouso:
```python
card_last_four = models.CharField(max_length=4, blank=True, null=True)
card_brand = models.CharField(max_length=30, blank=True, null=True)
card_token = models.CharField(max_length=200, blank=True, null=True)  # plaintext!
```

**Impacto:** PCI DSS proíbe armazenamento de tokens de cartão sem criptografia em repouso. Um dump do banco expõe todos os tokens.

**Ação imediata:**
- Avaliar se `card_token` é realmente necessário (o Asaas gerencia o token internamente pela `asaas_subscription_id`)
- Se necessário, usar `django-encrypted-fields` ou similar
- Se desnecessário, criar migration para remover o campo

---

## 🟠 ALTO — Deve corrigir antes de produção

### A1. `CORS_ALLOW_ALL_ORIGINS = True` e `ALLOWED_HOSTS = ["*"]`
**Arquivo:** `backend/gestao_financeira/settings.py`
**Problema:**
```python
CORS_ALLOW_ALL_ORIGINS = True   # qualquer origem pode fazer requests
ALLOWED_HOSTS = ["*"]            # vulnerável a Host header injection
```
**Correção:**
```python
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost').split(',')
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
```

---

### A2. Race condition na atualização do status da assinatura
**Arquivo:** `backend/core/views.py` (endpoints de assinar/webhook)
**Problema:** Duas requests simultâneas (duplo clique em "Assinar" + webhook chegando ao mesmo tempo) podem corromper o estado da assinatura — sem `select_for_update()` ou `transaction.atomic()`:
```python
assinatura = AssinaturaEmpresa.objects.get(company=request.user.company)
assinatura.asaas_subscription_id = result['id']
assinatura.save()  # sem lock!
```
**Correção:** Usar `select_for_update()` dentro de `transaction.atomic()` em todas as operações de mutação de assinatura.

---

### A3. Dados sensíveis expostos nos logs
**Arquivo:** `backend/core/asaas_service.py`
**Problema:** O `resp.text` completo é logado em caso de erro, podendo expor dados de cartão e informações de clientes:
```python
logger.error(f'Asaas credit card subscription error {resp.status_code}: {resp.text}')
logger.error(f'Asaas update card error {resp.status_code}: {resp.text}')
```
**Correção:** Logar apenas status code em `error` level; corpo da resposta apenas em `debug`:
```python
logger.error(f'Asaas card update error: HTTP {resp.status_code}')
logger.debug(f'Asaas response body: {resp.text}')
```

---

### A4. Webhook não é idempotente
**Arquivo:** `backend/core/views.py` (handler `asaas_webhook`)
**Problema:** O Asaas reenvia webhooks em caso de timeout. O handler não verifica se o evento já foi processado antes de atualizar o status. O `WebhookLog` é criado mas não consultado antes do processamento.

**Correção:** Verificar `WebhookLog` por evento+subscription_id antes de processar:
```python
already_processed = WebhookLog.objects.filter(
    event_type=event_type,
    asaas_subscription_id=subscription_id,
).exists()
if already_processed:
    return JsonResponse({'detail': 'already processed'}, status=200)
```

---

### A5. Sem validação de formato CPF/CNPJ antes de enviar ao Asaas
**Arquivo:** `backend/core/views.py` (endpoint `assinar`)
**Problema:** Verifica se CPF/CNPJ existe mas não valida o formato (dígito verificador). O Asaas rejeitará com erro genérico, dificultando diagnóstico.

**Correção:** Adicionar validação de dígito verificador antes de enviar ao Asaas.

---

### A6. Race condition no backfill da migration 0023
**Arquivo:** `backend/core/migrations/0023_backfill_assinaturas.py`
**Problema:** Loop sem lock pode criar duplicatas se o sistema estiver rodando durante a migration:
```python
for company in Company.objects.all():
    AssinaturaEmpresa.objects.get_or_create(...)  # sem atomic!
```
**Correção:**
```python
with transaction.atomic():
    for company in Company.objects.select_for_update().all():
        AssinaturaEmpresa.objects.get_or_create(...)
```

---

### A7. Reverse migration 0023 é no-op — rollback impossível
**Arquivo:** `backend/core/migrations/0023_backfill_assinaturas.py`
**Problema:**
```python
def reverse_backfill(apps, schema_editor):
    pass  # deixa dados no lugar — orphans!
```
Um `migrate core 0022` deixa registros órfãos que causarão falha no re-apply. Documentar explicitamente que é irreversível ou implementar limpeza adequada.

---

### A8. Sem rate limiting nos endpoints de pagamento
**Arquivo:** `backend/core/views.py` (endpoints `assinar`, `atualizar_cartao`)
**Problema:** Sem throttling, atacantes podem usar o sistema como proxy para card enumeration contra o Asaas.

**Correção:** Usar DRF throttling:
```python
throttle_classes = [UserRateThrottle]
throttle_scope = 'payment'  # 5/hour em settings.py
```

---

### A9. Sem validação de startup para variáveis de ambiente críticas
**Arquivo:** `backend/gestao_financeira/settings.py`
**Problema:** `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN` têm string vazia como default. O sistema pode iniciar em produção sem eles e falhar silenciosamente.

**Correção:**
```python
if os.getenv('ENV') == 'production':
    if not os.getenv('ASAAS_API_KEY'):
        raise RuntimeError('ASAAS_API_KEY obrigatório em produção')
    if not os.getenv('ASAAS_WEBHOOK_TOKEN'):
        raise RuntimeError('ASAAS_WEBHOOK_TOKEN obrigatório em produção')
```

---

### A10. Exceções do Asaas propagam sem tratamento ao cliente
**Arquivo:** `backend/core/asaas_service.py`
**Problema:** Quando a API do Asaas falha ou há timeout de rede, `resp.raise_for_status()` lança `HTTPError` não capturado pelos callers, resultando em 500 ao usuário.

**Correção:** Envolver chamadas ao Asaas em `try/except requests.RequestException` nos views e retornar 503 com mensagem amigável.

---

## 🟡 MÉDIO — Corrigir em breve

### M1. `unique=True` em `Cliente.nome` não é scoped por empresa
**Arquivo:** `backend/core/models.py` (também `Funcionario`)
**Problema:** `nome = models.CharField(max_length=255, unique=True)` é global. Dois escritórios diferentes não podem ter cliente com o mesmo nome — quebra o multi-tenancy.

**Correção:**
```python
class Meta:
    constraints = [
        models.UniqueConstraint(fields=['company', 'nome'], name='unique_cliente_per_company')
    ]
```

---

### M2. Sem índices em campos frequentemente filtrados
**Arquivo:** `backend/core/models.py`

Campos sem `db_index=True` mas usados em filtros frequentes:
- `AssinaturaEmpresa.asaas_subscription_id` — filtrado no webhook a cada evento
- `AssinaturaEmpresa.status` — filtrado em múltiplos lugares
- `Receita.data_vencimento`, `Despesa.data_vencimento` — filtros de data
- `Payment.data_pagamento`
- `WebhookLog.asaas_subscription_id`

---

### M3. Problema N+1 em serialização de Alocações
**Arquivo:** `backend/core/serializers.py`
**Problema:** `get_allocations_info()` faz query separada para cada Payment. Um extrato com 500 lançamentos = 500+ queries extras.

**Correção:** Adicionar `prefetch_related('allocations__receita', 'allocations__despesa')` no `get_queryset()` do `PagamentoViewSet`.

---

### M4. `print()` em migration de produção
**Arquivo:** `backend/core/migrations/0032_update_trial_plan_to_profissional.py`
**Problema:** `print(f"Atualizados {updated} trial(s)...")` não aparece nos logs de produção.

**Correção:** Usar `schema_editor.stdout.write()` ou `logger.info()`.

---

### M5. Sem campo de erro no `SubscriptionContext`
**Arquivo:** `frontend/src/contexts/SubscriptionContext.tsx`
**Problema:** Quando `getAssinaturaStatus()` falha, o context silenciosamente seta `assinatura = null`, podendo redirecionar o usuário para `/assinar` erroneamente.

**Correção:** Adicionar campo `error?: string` ao context value e tratar no UI.

---

### M6. Race condition no refresh do `SubscriptionContext`
**Arquivo:** `frontend/src/contexts/SubscriptionContext.tsx`
**Problema:** Múltiplas chamadas concorrentes a `refresh()` (ao montar vários componentes) podem resultar em estado inconsistente no cache.

**Correção:** Adicionar flag `isRefreshing` via `useRef` para evitar requests paralelos.

---

### M7. Procfile sem tuning de workers e timeout
**Arquivo:** `backend/Procfile`
**Atual:** `web: gunicorn gestao_financeira.wsgi`

Workers padrão (1) e timeout padrão (30s) inadequados para processamento de pagamentos.

**Correção:**
```
web: gunicorn gestao_financeira.wsgi --workers 4 --timeout 60 --access-logfile - --error-logfile -
```

---

### M8. Formato de resposta de erro inconsistente
**Arquivo:** `backend/core/views.py` (múltiplos endpoints)
**Problema:** Mistura de `{'detail': '...'}`, `{'erro': '...'}` e `{'error': '...'}`. Frontend precisa tratar múltiplos formatos.

**Correção:** Padronizar em `{'detail': '...'}` (padrão DRF).

---

## 🟢 BAIXO — Backlog de qualidade

### B1. `unique_together` deprecated
`ClienteComissao.Meta.unique_together` deve ser migrado para `UniqueConstraint` (deprecated desde Django 3.2).

### B2. Caminhos hardcoded em `Providers.tsx`
```typescript
const EXEMPT_PATHS = ['/', '/assinatura', '/assinar', '/assinar/pagamento', '/cadastro'];
```
Extrair para arquivo de constantes de rotas. Se rotas mudarem, falha silenciosa.

### B3. `getPlanos()` lida com dois formatos de resposta
```typescript
return Array.isArray(res.data) ? res.data : res.data.results;
```
O backend deve sempre retornar o mesmo formato. Remover paginação nesse endpoint ou sempre paginar.

### B4. Logging sem estrutura JSON em produção
Considerar `structlog` ou configurar Django logging com handler JSON para facilitar busca em ferramentas de observabilidade.

### B5. Token JWT em `localStorage` vulnerável a XSS
O padrão atual funciona, mas `httpOnly` cookies são mais seguros para tokens de auth. Item para revisão de segurança futura.

### B6. `WebhookLog` sem índice em `asaas_subscription_id`
Adicionar `db_index=True` no campo — é filtrado a cada verificação de idempotência.

### B7. Falta `.env.example` no repositório
Nenhum desenvolvedor novo sabe quais variáveis configurar. Criar `backend/.env.example` e `frontend/.env.local.example`.

### B8. Lógica `_add_one_month_safe` — validar edge cases
Verificar comportamento para 31 jan → deve resultar em 28/29 fev. Considerar usar `dateutil.relativedelta` para maior confiabilidade.

---

## Checklist de Deploy — Antes de ir a Produção

```
SEGURANÇA
[ ] Remover .env do histórico git (git rm --cached + BFG Repo-Cleaner se necessário)
[ ] Rotacionar: SECRET_KEY, DB_PASSWORD, ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN
[ ] Implementar tokenização client-side do cartão via SDK Asaas
[ ] Substituir comparação de webhook por secrets.compare_digest()
[ ] Configurar ALLOWED_HOSTS com domínio real
[ ] Configurar CORS_ALLOWED_ORIGINS com domínio real

VARIÁVEIS DE AMBIENTE DE PRODUÇÃO
[ ] SECRET_KEY — nova, gerada com get_random_secret_key()
[ ] DATABASE_URL — PostgreSQL de produção
[ ] ASAAS_API_KEY — chave de PRODUÇÃO (não sandbox!)
[ ] ASAAS_BASE_URL=https://api.asaas.com/v3 (produção, não sandbox!)
[ ] ASAAS_WEBHOOK_TOKEN — gerado com: python -c "import secrets; print(secrets.token_hex(32))"
[ ] ALLOWED_HOSTS=seudominio.com.br
[ ] CORS_ALLOWED_ORIGINS=https://seudominio.com.br
[ ] ENV=production

BANCO DE DADOS
[ ] python manage.py migrate (aplicar todas as 32 migrations)
[ ] Verificar que todas as AssinaturaEmpresa foram criadas (migration 0023)

FRONTEND
[ ] NEXT_PUBLIC_API_URL apontando para backend de produção
[ ] npm run build sem erros
[ ] Verificar que /assinar e /assinatura funcionam com backend real

GATEWAY DE PAGAMENTO
[ ] Configurar webhook no painel Asaas → URL de produção
[ ] Testar fluxo completo de assinatura no ambiente de produção (sandbox primeiro!)
[ ] Confirmar que ASAAS_BASE_URL está apontando para PRODUÇÃO (não sandbox!)

INFRA
[ ] SSL/HTTPS configurado (obrigatório para PCI)
[ ] python manage.py collectstatic
[ ] Ajustar Procfile com --workers e --timeout adequados
[ ] Configurar healthcheck endpoint
```

---

## Conclusão

O sistema pode ir a produção **após corrigir os 4 itens críticos** (C1-C4) e os itens de alto impacto mais relevantes (especialmente A1, A9). Os demais itens são melhorias importantes mas não bloqueiam o funcionamento básico.

**Risco mais urgente:** O `.env` commitado com credenciais reais (C1) é o problema mais crítico — independente de qualquer outra coisa, as credenciais precisam ser rotacionadas imediatamente se este repositório for acessível a outras pessoas.
