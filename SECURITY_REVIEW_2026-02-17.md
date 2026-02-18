# Security Review — ERP-Adv
**Data:** 2026-02-17
**Escopo:** Django REST API (backend) + Next.js (frontend)

---

## Sumário Executivo

| Severidade | Qtd | Ação |
|------------|-----|------|
| Crítico    | 3   | Agir hoje |
| Alto       | 4   | Esta semana |
| Médio      | 5   | Próximas 2 semanas |
| Baixo      | 5   | Próximo mês |

---

## CRÍTICO — Agir imediatamente

### 1. Secrets expostos no `.env` commitado no git
**Arquivo:** `backend/.env`

O arquivo `.env` está no repositório git com credenciais reais:
- `SECRET_KEY = 'django-insecure-...'` — chave fraca e marcada como insegura pelo próprio Django
- `DB_PASSWORD=juris1234` — senha simples do banco
- `ASAAS_API_KEY=...` — chave real do gateway de pagamento
- `RESEND_API_KEY=...` — chave real do serviço de email

**Impacto:** Qualquer pessoa com acesso ao repositório pode usar essas chaves para acessar o banco de dados, processar pagamentos e enviar emails em nome da empresa.

**Correção:**
1. Rotacionar TODAS as chaves imediatamente (Asaas, Resend, gerar nova SECRET_KEY)
2. Remover `.env` do histórico git com `git-filter-repo` ou `BFG Repo Cleaner`
3. Adicionar `.env` ao `.gitignore`
4. Gerar SECRET_KEY forte: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`

---

### 2. Webhook token aceito via query string (URL pública)
**Arquivo:** `backend/core/views/subscription.py`

```python
token = (
    request.headers.get('asaas-access-token')
    or request.headers.get('x-asaas-access-token')
    or request.GET.get('token', '')  # ← PROBLEMA: token na URL
)
```

O token do webhook do Asaas pode ser passado como `?token=...` na URL, o que o expõe em:
- Logs de acesso do servidor
- Histórico do browser
- Headers `Referer` ao redirecionar

**Correção:** Remover `request.GET.get('token')` e aceitar token apenas via header.

---

### 3. URL de ngrok hardcoded no `ALLOWED_HOSTS` padrão
**Arquivo:** `backend/gestao_financeira/settings.py`

```python
ALLOWED_HOSTS = _csv_env("ALLOWED_HOSTS", "localhost,127.0.0.1,creatural-aphetically-lynda.ngrok-free.dev")
```

Uma URL pública de ngrok está no valor padrão da variável de ambiente. Qualquer pessoa que veja o código pode usar essa URL para acessar o backend diretamente.

**Correção:** Remover a URL de ngrok dos padrões. O valor padrão deve ser só `localhost,127.0.0.1`.

---

## ALTO — Esta semana

### 4. JWT refresh token não é invalidado após rotação
**Arquivo:** `backend/gestao_financeira/settings.py`

```python
SIMPLE_JWT = {
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,  # ← tokens antigos continuam válidos
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}
```

Tokens antigos permanecem válidos após rotação. Se um refresh token for roubado, o atacante mantém acesso por 7 dias sem possibilidade de revogação.

**Correção:** Ativar `BLACKLIST_AFTER_ROTATION: True` (requer `djangorestframework_simplejwt.token_blacklist` instalado e migrado).

---

### 5. Username enumeration no login
**Arquivo:** `backend/gestao_financeira/urls.py`

O endpoint de login retorna mensagens diferentes dependendo se o usuário existe:
- `"Usuário não encontrado"` → usuário não existe
- `"Senha incorreta"` → usuário existe, senha errada

Isso permite que um atacante descubra quais usernames estão cadastrados via força bruta.

**Correção:** Padronizar para uma única mensagem: `"Usuário ou senha inválidos"` em ambos os casos.

---

### 6. Dados sensíveis logados
**Arquivo:** `backend/core/views/subscription.py`

```python
logger.debug(f'Asaas customer creation response body: {resp.text}')
```

O body completo da resposta do Asaas é logado, podendo expor dados de clientes e informações de pagamento nos arquivos de log.

**Correção:** Logar apenas campos seguros (transaction ID, status code). Nunca logar bodies de resposta de APIs de pagamento.

---

### 7. Serializers com `fields = '__all__'`
**Arquivos:** `backend/core/serializers/` (FuncionarioSerializer, CompanySerializer)

Qualquer campo novo adicionado ao model é automaticamente exposto na API sem revisão explícita, podendo vazar dados internos inadvertidamente.

**Correção:** Listar todos os campos explicitamente em vez de usar `__all__`.

---

## MÉDIO — Próximas 2 semanas

### 8. JWT armazenado em `localStorage`
**Arquivo:** `frontend/src/services/auth.ts`

```typescript
const storage = rememberMe ? localStorage : sessionStorage;
storage.setItem('token', access);
```

`localStorage` é acessível por qualquer JavaScript na página. Uma vulnerabilidade XSS permite roubar o token e fazer login como o usuário.

**Correção:** Migrar para cookies `HttpOnly + Secure + SameSite=Strict`. O backend emite o cookie no login e o browser o envia automaticamente — JavaScript não consegue ler.

---

### 9. Dados brutos de cartão de crédito passando pelo backend
**Arquivo:** `backend/core/views/subscription.py`

O backend recebe dados brutos de cartão de crédito antes de enviar ao Asaas, aumentando o escopo de PCI DSS e o risco em caso de comprometimento do servidor.

**Correção:** Tokenizar o cartão no frontend via SDK do Asaas e enviar apenas o token para o backend.

---

### 10. Rate limiting insuficiente
**Arquivo:** `backend/gestao_financeira/settings.py`

Throttle existe apenas em endpoints de pagamento. Os seguintes endpoints não têm limite de tentativas:
- Login
- Registro
- Recuperação de senha
- Verificação de email

**Correção:** Aplicar throttle a todos os endpoints de autenticação.

---

### 11. Upload de logo sem validação
**Arquivo:** `backend/core/models/identity.py`

```python
logo = models.ImageField(upload_to='logos/', blank=True, null=True)
```

Sem validação de tipo MIME, tamanho máximo ou dimensões. Permite upload de arquivos grandes (DoS) ou imagens maliciosas.

**Correção:** Adicionar validação no serializer: tipo de arquivo, tamanho máximo (ex: 2MB), dimensões.

---

### 12. Mensagens de erro do Asaas retornadas diretamente ao frontend
**Arquivo:** `backend/core/views/subscription.py`

```python
msg = asaas_errors[0].get('description', 'Erro no gateway de pagamento.')
return Response({'detail': msg}, status=400)
```

Mensagens internas do Asaas expostas ao usuário podem revelar detalhes sobre a infraestrutura.

**Correção:** Mapear códigos de erro do Asaas para mensagens genéricas amigáveis.

---

## BAIXO — Próximo mês

### 13. Security headers ausentes
Faltam headers HTTP de segurança importantes:
- `Content-Security-Policy` — previne XSS e injeção de scripts
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

**Correção:** Usar `django-csp` para CSP e configurar os demais headers via middleware.

---

### 14. Audit logging ausente
Não há trilha de auditoria para:
- Tentativas de login (com sucesso e falha)
- Mudanças de assinatura
- Acessos a dados financeiros sensíveis
- Operações de pagamento

**Correção:** Implementar middleware de auditoria e reter logs por pelo menos 90 dias.

---

### 15. Race condition no processamento de webhooks
**Arquivo:** `backend/core/views/subscription.py`

Dois webhooks idênticos chegando simultaneamente podem passar pela verificação de duplicata e ser processados duas vezes.

**Correção:** Usar `select_for_update()` ou constraint de unicidade no banco para garantir idempotência.

---

### 16. Expiração de token de recuperação de senha não enforçada no código
**Arquivo:** `backend/core/views/identity.py`

A expiração de 1 hora é mencionada no email mas depende do comportamento padrão do Django, não está explicitamente configurada.

**Correção:** Configurar explicitamente `PASSWORD_RESET_TIMEOUT` no `settings.py`.

---

### 17. Dados de assinatura em `sessionStorage`
**Arquivo:** `frontend/src/contexts/SubscriptionContext.tsx`

```typescript
sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
```

Status e dados da assinatura armazenados em `sessionStorage` são acessíveis via JavaScript (vulnerável a XSS).

**Correção:** Manter cache apenas em estado React (memória), não em storage do browser.

---

## O que está correto

- Sem SQL injection — ORM do Django usado corretamente em todo o código
- Sem `eval()` ou `dangerouslySetInnerHTML` no frontend
- Multi-tenancy correto — `CompanyScopedViewSetMixin` filtra por empresa em todos os ViewSets
- CSRF funcionando nos endpoints normais
- Webhook com `secrets.compare_digest` (comparação constant-time) — correto
- `IsSubscriptionActive` permission class aplicada corretamente
- Separação de ambientes via variável `ENV`

---

## Roadmap de Correção

```
Hoje (crítico):
  [ ] Rotacionar ASAAS_API_KEY, RESEND_API_KEY, SECRET_KEY
  [ ] Remover .env do histórico git
  [ ] Adicionar .env ao .gitignore
  [ ] Remover ngrok do ALLOWED_HOSTS padrão
  [ ] Webhook: aceitar token só via header

Esta semana (alto):
  [ ] Ativar BLACKLIST_AFTER_ROTATION no JWT
  [ ] Unificar mensagem de erro do login (anti-enumeration)
  [ ] Remover log do body de resposta do Asaas
  [ ] Serializers: listar campos explicitamente

Próximas 2 semanas (médio):
  [ ] Migrar JWT para cookies HttpOnly
  [ ] Tokenização de cartão no frontend
  [ ] Rate limiting em endpoints de autenticação
  [ ] Validação de upload de imagem

Próximo mês (baixo):
  [ ] Security headers (django-csp e demais)
  [ ] Audit logging middleware
  [ ] Fix race condition no webhook
  [ ] PASSWORD_RESET_TIMEOUT explícito
  [ ] Remover subscription data do sessionStorage
```

---

## Cobertura OWASP Top 10 (2021)

| Categoria | Status |
|-----------|--------|
| A01 Broken Access Control | Parcialmente OK (multi-tenancy implementado) |
| A02 Cryptographic Failures | **FALHAS** (secrets expostos, chave fraca) |
| A03 Injection | OK (ORM correto, sem raw SQL) |
| A04 Insecure Design | **FALHAS** (webhook auth, token em URL) |
| A05 Security Misconfiguration | **FALHAS** (DEBUG, ALLOWED_HOSTS, CORS) |
| A06 Vulnerable Components | Não auditado (rodar `pip audit` e `npm audit`) |
| A07 Authentication Failures | **FALHAS** (enumeration, localStorage) |
| A08 Data Integrity Failures | **FALHAS** (race condition webhook) |
| A09 Logging Failures | **FALHAS** (sem audit log, credentials logados) |
| A10 SSRF | OK (não encontrado) |
