# Guia Completo do Projeto ERP-Adv (Vincor ERP)

> Documento de estudo — gerado em 17/02/2026

---

## Sumário

1. [O que é o projeto](#1-o-que-é-o-projeto)
2. [Visão geral da arquitetura](#2-visão-geral-da-arquitetura)
3. [Backend — Django](#3-backend--django)
   - [Modelos de dados](#31-modelos-de-dados)
   - [Serializers](#32-serializers)
   - [Views e ViewSets](#33-views-e-viewsets)
   - [Serviços de negócio](#34-serviços-de-negócio)
   - [Permissões](#35-permissões)
   - [Integração Asaas](#36-integração-asaas)
   - [Geração de PDFs](#37-geração-de-pdfs)
   - [URLs e roteamento](#38-urls-e-roteamento)
4. [Frontend — Next.js](#4-frontend--nextjs)
   - [Páginas](#41-páginas)
   - [Componentes](#42-componentes)
   - [Serviços (API clients)](#43-serviços-api-clients)
   - [Tipos TypeScript](#44-tipos-typescript)
   - [Contexts e Hooks](#45-contexts-e-hooks)
   - [Utilitários (lib/)](#46-utilitários-lib)
5. [Fluxos principais](#5-fluxos-principais)
   - [Autenticação e segurança](#51-autenticação-e-segurança)
   - [Multi-tenancy](#52-multi-tenancy)
   - [Sistema de comissões](#53-sistema-de-comissões)
   - [Alocação polimórfica](#54-alocação-polimórfica)
   - [Assinatura e pagamentos](#55-assinatura-e-pagamentos)
6. [Estrutura de arquivos](#6-estrutura-de-arquivos)
7. [Variáveis de ambiente](#7-variáveis-de-ambiente)
8. [Endpoints da API](#8-endpoints-da-api)

---

## 1. O que é o projeto

O **ERP-Adv** (também chamado de **Vincor ERP**) é um sistema de gestão financeira para escritórios de advocacia brasileiros. Ele resolve os problemas financeiros do dia a dia de um escritório:

- Controle de receitas e despesas (fixas, variáveis, comissionadas)
- Gestão de clientes e funcionários/parceiros
- Controle de contas bancárias e conciliação de extratos
- Gestão de custódia (dinheiro de clientes em posse do escritório)
- Relatórios financeiros (DRE, balanço, fluxo de caixa)
- Geração de PDFs de todos os relatórios
- Sistema de assinatura (SaaS) com planos mensais/anuais via Asaas

---

## 2. Visão geral da arquitetura

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js 15, App Router, TypeScript)          │
│  localhost:3000                                         │
│                                                         │
│  Páginas → Componentes → Services (Axios) → API         │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP (JWT Bearer token)
                       │ NEXT_PUBLIC_API_URL
┌──────────────────────▼──────────────────────────────────┐
│  BACKEND (Django 6 + DRF)                               │
│  localhost:8000                                         │
│                                                         │
│  URLs → Views/ViewSets → Serializers → Models → DB      │
│                         ↓                               │
│               Services (comissões, Asaas)               │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   PostgreSQL                   Asaas API
   (dados do ERP)         (gateway de pagamento
                           para assinaturas SaaS)
```

**Principais escolhas tecnológicas:**
- **JWT** para autenticação (sem sessions, sem cookies)
- **DRF DefaultRouter** para roteamento REST automático
- **Multi-tenancy por FK**: cada model tem `company` FK, sem schemas separados
- **App Router do Next.js 15** (não usa pages/ do Next antigo)
- **Mantine + Ant Design + Shadcn/Radix** coexistem no frontend

---

## 3. Backend — Django

### 3.1 Modelos de dados

Os modelos ficam em `backend/core/models/` (pacote Python — cada arquivo é um domínio e o `__init__.py` re-exporta tudo).

---

#### `identity.py` — Identidade e autenticação

**`Company`** — O escritório/empresa
```
nome, cnpj, cpf, logo (ImageField), endereco, telefone,
percentual_comissao (comissão padrão da empresa)
```
- Quando uma Company é criada, um **signal** (`post_save`) dispara automaticamente e cria um `AssinaturaEmpresa` com trial de 7 dias.

**`CustomUser`** — Usuário do sistema
```
herda AbstractUser (username, email, password, etc.)
company (FK → Company)
is_email_verified (bool)
```
- Cada usuário pertence a uma empresa. Superusers veem tudo; usuários normais veem só os dados da própria empresa.

---

#### `people.py` — Pessoas

**`Cliente`** — Clientes do escritório
```
nome, cpf_cnpj, email, telefone, aniversario,
tipo ('Fixo' | 'Avulso'),
formas_cobranca → M2M via FormaCobranca
comissoes → M2M via ClienteComissao
```

**`FormaCobranca`** — Como o cliente paga
```
cliente (FK), formato ('Mensal' | 'Êxito'),
valor_mensal, percentual_exito
```
- Formato Mensal: valor fixo por mês
- Formato Êxito: percentual sobre o que for recebido

**`ClienteComissao`** — Regra de comissão por cliente (nível 2 da hierarquia)
```
cliente (FK), funcionario (FK), percentual
unique_together: (cliente, funcionario)
```

**`Funcionario`** — Funcionários, parceiros e fornecedores
```
nome, cpf_cnpj, email, telefone, banco, agencia, conta,
tipo ('F'=Funcionário | 'P'=Parceiro | 'O'=Outro/Fornecedor),
salario_mensal
```

---

#### `revenue.py` — Receitas

**`Receita`** — Uma receita (entrada de dinheiro)
```
nome, descricao, cliente (FK), valor,
data_vencimento, data_pagamento,
tipo ('F'=Fixa | 'V'=Variável | 'E'=Êxito),
situacao ('P'=Paga | 'A'=Em Aberto | 'V'=Vencida),
comissoes → via ReceitaComissao
```
- `situacao` é calculada automaticamente pelo método `atualizar_status()` com base nas alocações (pagamentos linkados)
- A situacao não é editada diretamente — ela reflete o total alocado vs. valor da receita

**`ReceitaComissao`** — Regra de comissão por receita (nível 1 da hierarquia, maior prioridade)
```
receita (FK), funcionario (FK), percentual
unique_together: (receita, funcionario)
```

**`ReceitaRecorrente`** — Template de receita recorrente
```
nome, descricao, cliente (FK), valor, tipo,
data_inicio, data_fim, dia_vencimento (1-31),
status ('A'=Ativa | 'P'=Pausada)
```
- Não é uma receita em si — é um template que gera receitas mensalmente

**`ReceitaRecorrenteComissao`** — Comissão em receitas recorrentes
```
receita_recorrente (FK), funcionario (FK), percentual
```

---

#### `expense.py` — Despesas

**`Despesa`** — Uma despesa (saída de dinheiro)
```
nome, descricao, responsavel (FK → Funcionario), valor,
data_vencimento, data_pagamento,
tipo ('F'=Fixa | 'V'=Variável | 'C'=Comissionamento | 'R'=Reembolso),
situacao ('P'=Paga | 'A'=Em Aberto | 'V'=Vencida),
receita_origem (FK → Receita, nullable — para despesas de comissão)
```
- Despesas do tipo `'C'` são criadas automaticamente pelo serviço de comissões

**`DespesaRecorrente`** — Template de despesa recorrente
```
nome, descricao, responsavel (FK), valor, tipo,
data_inicio, data_fim, dia_vencimento, status
```

---

#### `banking.py` — Bancos e pagamentos

**`ContaBancaria`** — Conta bancária
```
company (FK), nome, descricao, saldo_atual (Decimal)
```
- `saldo_atual` é atualizado atomicamente com `F()` expressions a cada Payment criado/editado/deletado

**`Payment`** — Transação bancária neutra (entrada ou saída)
```
company (FK), conta_bancaria (FK),
tipo ('E'=Entrada | 'S'=Saída),
valor, data_pagamento, observacao
```
- Um Payment não tem significado financeiro por si só — ele ganha significado via `Allocation` (linkando a uma Receita, Despesa, Custódia ou Transferência)

**`Transfer`** — Transferência entre contas
```
company (FK), from_bank (FK), to_bank (FK),
valor, data_transferencia, descricao,
status ('P'=Pendente | 'M'=Mismatch | 'C'=Completo)
```
- Status calculado automaticamente: soma de entradas vs. saídas nas alocações

**`Allocation`** — Alocação polimórfica (coração do sistema bancário)
```
company (FK), payment (FK),
receita (FK, nullable),
despesa (FK, nullable),
custodia (FK, nullable),
transfer (FK, nullable),
valor, observacao
```
- Exatamente UMA das 4 FKs deve ser preenchida (validado em `clean()`)
- Liga um Payment a uma Receita, Despesa, Custódia ou Transferência

---

#### `custody.py` — Custódia

**`Custodia`** — Dinheiro de terceiros sob guarda do escritório
```
company (FK),
tipo ('P'=Passivo | 'A'=Ativo),
cliente (FK, nullable), funcionario (FK, nullable),
nome, descricao,
valor_total, valor_liquidado,
status ('A'=Aberto | 'P'=Parcial | 'L'=Liquidado)
```
- Passivo: dinheiro do cliente que o escritório guarda (ex: depósito judicial)
- Ativo: dinheiro que o escritório tem a receber de custódia
- Status calculado via `atualizar_status()` com base em alocações

---

#### `subscription.py` — Assinatura (sistema SaaS)

**`PlanoAssinatura`** — Definição de um plano de assinatura
```
nome, slug (unique), subtitulo, descricao,
preco_mensal, preco_anual,
max_usuarios (-1 = ilimitado),
asaas_billing_type, features (JSONField),
tem_trial (bool), ativo (bool), ordem
```
Planos existentes:
- **Essencial**: R$120/mês, 1 usuário
- **Profissional**: R$250/mês, 3 usuários (tem trial)
- **Evolution**: R$600/mês ou R$6.000/ano, ilimitado

**`AssinaturaEmpresa`** — Assinatura ativa de uma empresa (OneToOne com Company)
```
company (OneToOneField), plano (FK), ciclo ('MONTHLY'|'YEARLY'),
trial_inicio, trial_fim,
status ('trial'|'active'|'overdue'|'payment_failed'|'cancelled'|'expired'),
asaas_customer_id, asaas_subscription_id,
asaas_subscription_ids_anteriores (JSONField),
pending_plano, pending_ciclo,
proxima_cobranca, card_last_four, card_brand
```
Propriedades calculadas:
- `trial_ativo`: bool — trial_fim > hoje
- `dias_trial_restantes`: int — quanto falta do trial
- `acesso_permitido`: bool — se o usuário pode usar o sistema

**`WebhookLog`** — Log de webhooks do Asaas
```
event_type, asaas_subscription_id, asaas_payment_id,
payload (JSONField), processed (bool), error, recebido_em
```

**Signal** `criar_assinatura_trial` (post_save em Company):
- Quando uma nova empresa é criada, cria automaticamente `AssinaturaEmpresa` com status='trial' e trial_fim = hoje + 7 dias

---

### 3.2 Serializers

Ficam em `backend/core/serializers/` (pacote, mesmo padrão dos models).

Cada serializer DRF transforma um model em JSON (e vice-versa). Os principais padrões:

- **`read_only=True`** no campo `company` (sempre vem do `request.user`)
- **Nested serializers**: ex. `ReceitaSerializer` inclui `comissoes` como lista aninhada
- **SerializerMethodField**: campos calculados que não existem no model, ex. `saldo_aberto` (quanto ainda falta pagar de uma receita), `trial_ativo`, `dias_trial_restantes`

Arquivos:
```
serializers/identity.py     → CompanySerializer, CustomUserSerializer
serializers/people.py       → ClienteSerializer (com formas_cobranca + comissoes aninhados)
                              FuncionarioSerializer, FormaCobrancaSerializer, ClienteComissaoSerializer
serializers/revenue.py      → ReceitaSerializer (com comissoes aninhadas)
                              ReceitaAbertaSerializer (adiciona saldo_aberto)
                              ReceitaRecorrenteSerializer
serializers/expense.py      → DespesaSerializer, DespesaAbertaSerializer, DespesaRecorrenteSerializer
serializers/banking.py      → PaymentSerializer (com allocations_info)
                              ContaBancariaSerializer, CustodiaSerializer
                              TransferSerializer, AllocationSerializer
serializers/subscription.py → PlanoAssinaturaSerializer, AssinaturaEmpresaSerializer
```

---

### 3.3 Views e ViewSets

Ficam em `backend/core/views/` (pacote).

---

#### `mixins.py` — Base de todos os ViewSets

**`CompanyScopedViewSetMixin`** — Mixin que toda ViewSet de dados herda:
```python
permission_classes = [IsAuthenticated, IsSubscriptionActive]

def get_queryset(self):
    # Filtra pelo company do usuário logado
    # Superusers veem tudo

def perform_create(self, serializer):
    # Auto-injeta company=request.user.company na criação
```

Funções auxiliares no arquivo:
- `_is_valid_cpf()`, `_is_valid_cnpj()`, `_is_valid_cpf_cnpj()` — validação de documentos brasileiros
- `_add_one_month_safe()`, `_add_one_year_safe()` — aritmética de datas sem quebrar dia-do-mês (ex: 31 jan + 1 mês = 28/29 fev)
- `PaymentRateThrottle` — throttle por usuário para criação de payments

---

#### `identity.py`

**`CompanyViewSet`** — Admin-only. Ação customizada `me` (`GET /api/companies/me/`) retorna a empresa do usuário logado.

**`CustomUserViewSet`** — CRUD de usuários. No `perform_create()`, auto-assign `company`.

**`password_reset_request()`** — `POST /api/password-reset/` → envia email via Resend com link de reset

**`password_reset_confirm()`** — `POST /api/password-reset/confirm/` → valida token, reseta senha

**`verify_email()`** — `POST /api/verify-email/` → valida token de verificação de email, loga usuário automaticamente (retorna JWT tokens)

**`EmailVerificationTokenGenerator`** — classe customizada que herda de `PasswordResetTokenGenerator` do Django, mas exclui a senha do hash (para que o token continue válido mesmo após o usuário mudar a senha)

---

#### `people.py`

**`ClienteViewSet`** — CRUD de clientes + ação customizada:
- `@action POST gerar-comissoes/` — recebe `mes` e `ano`, chama `calcular_comissoes_mes()` e `gerar_despesas_comissao()` do serviço de comissões

**`FuncionarioViewSet`** — CRUD para funcionários (tipo F ou P)

**`FornecedorViewSet`** — CRUD para fornecedores (tipo O)

**`FavorecidoViewSet`** — CRUD para favorecidos (outro tipo O, caso especial)

---

#### `revenue.py`

**`ReceitaViewSet`**:
- `get_queryset()`: auto-atualiza receitas vencidas (A → V) antes de retornar
- `get_serializer_class()`: retorna `ReceitaAbertaSerializer` (com `saldo_aberto`) para receitas A/V, `ReceitaSerializer` para pagas
- Filtering: busca por texto, `situacao`, `cliente_id`, range de datas
- `perform_create()`: se `marcar_como_pago=true` na requisição, cria Payment + Allocation automaticamente

**`ReceitaRecorrenteViewSet`** — CRUD simples de templates recorrentes

---

#### `expense.py`

Mesmo padrão de `revenue.py`, mas para despesas.

---

#### `banking.py`

**`PaymentViewSet`**:
- `perform_create()`: atualiza `saldo_atual` da conta com `F('saldo_atual') + valor` (operação atômica, segura para concorrência)
- `perform_update/destroy()`: reverte o saldo anterior antes de aplicar o novo

**`ContaBancariaViewSet`** — CRUD de contas bancárias

**`CustodiaViewSet`** — CRUD de custódia; chama `atualizar_status()` ao mudar alocações

**`TransferViewSet`** — CRUD de transferências

**`AllocationViewSet`** — CRUD de alocações; valida que só uma FK está preenchida

---

#### `subscription.py`

**`PlanoAssinaturaViewSet`** — ReadOnly, público (sem autenticação). Lista planos ativos para a tela de `/assinar`.

**`AssinaturaViewSet`** — *Não herda* `IsSubscriptionActive` (usuário precisa acessar mesmo com assinatura vencida):
- `status_assinatura/` — GET retorna status atual da assinatura
- `assinar/` — POST com dados do cartão → chama Asaas, cria/atualiza `AssinaturaEmpresa`
- `cancelar/`, `reativar/`, `link_pagamento/`, `pagamentos/`, `atualizar_cartao/`

**`register_view()`** — `POST /api/register/` → cria Company + CustomUser sem autenticação (registro de novas empresas)

**`asaas_webhook()`** — CSRF-exempt. Processa eventos:
- `PAYMENT_RECEIVED` → status='active', atualiza proxima_cobranca
- `PAYMENT_OVERDUE` → status='overdue'
- `SUBSCRIPTION_CANCELLED` → status='cancelled'

---

#### `reports/` — Relatórios

**`dashboard_view()`** — Agrega KPIs:
- Saldo atual de todas as contas
- Receitas/despesas do mês
- Fluxo de caixa projetado
- Próximos vencimentos
- Aniversariantes do mês

**`RelatorioClienteView`**, **`RelatorioFuncionarioView`** — Relatórios detalhados por pessoa

**`RelatorioFolhaSalarialView`** — Resumo de salários por mês

**`RelatorioComissionamentoView`** — Cálculo de comissões por período

**`dre_consolidado()`** — DRE (Demonstrativo de Resultado do Exercício)

**`balanco_patrimonial()`** — Balanço patrimonial simplificado

**`relatorio_conciliacao_bancaria()`** — Pagamentos não alocados / diferenças de saldo

---

### 3.4 Serviços de negócio

`backend/core/services/commission.py`

**`calcular_comissoes_mes(company, mes, ano)`**
- Busca todas as Allocations de receitas no período (receitas que foram pagas naquele mês)
- Para cada alocação, aplica a hierarquia de comissões:
  1. Verifica se existe `ReceitaComissao` para aquela receita+funcionario → usa esse %
  2. Se não, verifica `ClienteComissao` para o cliente+funcionario → usa esse %
  3. Agrega por funcionário
- Retorna dict `{funcionario_id: {nome, valor_comissao}}`

**`gerar_despesas_comissao(company, mes, ano)`**
- Chama `calcular_comissoes_mes()`
- Para cada funcionário com comissão: cria ou atualiza `Despesa` de `tipo='C'` com `data_vencimento` = último dia do mês
- Remove despesas de comissão de funcionários que não estão mais na lista
- Retorna lista de comissões geradas

---

### 3.5 Permissões

`backend/core/permissions.py`

**`IsSubscriptionActive`** — Retorna HTTP 402 se:
- Status da assinatura é `trial` mas o trial já venceu
- Status é `overdue`, `payment_failed`, `cancelled` ou `expired`

Superusers passam sempre. Usuários sem assinatura (edge case) também são barrados.

---

### 3.6 Integração Asaas

`backend/core/asaas_service.py`

O Asaas é o gateway de pagamento brasileiro usado para cobrar as assinaturas SaaS dos clientes do Vincor. Cada chamada usa `requests.post/get` com a `ASAAS_API_KEY`.

Funções principais:
```python
criar_cliente_asaas(company)
    # Cria o cliente no Asaas com os dados da empresa

buscar_cliente_asaas_por_cpfcnpj(cpf_cnpj)
    # Verifica se já existe um cliente Asaas para esse CNPJ/CPF

atualizar_cliente_asaas(asaas_customer_id, company)
    # Atualiza dados do cliente

criar_assinatura_cartao_asaas(asaas_customer_id, plano, ciclo, credit_card_token)
    # Cria assinatura recorrente por cartão de crédito no Asaas

atualizar_cartao_assinatura(asaas_subscription_id, new_card_token)
    # Troca o cartão de uma assinatura existente

cancelar_assinatura_asaas(asaas_subscription_id)
reativar_assinatura_asaas(asaas_subscription_id)

obter_url_pagamento_assinatura(asaas_subscription_id)
    # Retorna link para página de pagamento hospedada no Asaas
```

---

### 3.7 Geração de PDFs

`backend/core/pdf_views.py` (~2.400 linhas)

Usa a biblioteca **ReportLab** para gerar PDFs diretamente no servidor. Cada view de PDF:
1. Recebe filtros via query params (datas, cliente, etc.)
2. Filtra os dados no banco
3. Constrói o PDF com tabelas, headers, footers, logo da empresa
4. Retorna `HttpResponse` com `content_type='application/pdf'`

Relatórios disponíveis em PDF:
- Receitas pagas / a receber
- Despesas pagas / a pagar
- Relatório de cliente / funcionário
- DRE, Fluxo de Caixa, Comissionamento, Balanço
- Recibo de pagamento

`backend/core/helpers/pdf.py` — Utilitários compartilhados entre os PDFs (formatação, cabeçalhos, etc.)

---

### 3.8 URLs e roteamento

`backend/core/urls.py`

O DRF `DefaultRouter` cria automaticamente as rotas CRUD para cada ViewSet registrado:
```
GET    /api/clientes/           → lista
POST   /api/clientes/           → criar
GET    /api/clientes/{id}/      → detalhe
PUT    /api/clientes/{id}/      → atualizar completo
PATCH  /api/clientes/{id}/      → atualizar parcial
DELETE /api/clientes/{id}/      → deletar
```

Além das rotas automáticas, há endpoints manuais (função-view):
- `POST /api/register/`
- `POST /api/password-reset/`
- `POST /api/password-reset/confirm/`
- `POST /api/verify-email/`
- `POST /api/asaas/webhook/?token=SECRET`
- `GET  /api/dashboard/`
- `GET  /api/relatorios/*/`
- `GET  /api/pdf/*/`

---

## 4. Frontend — Next.js

### 4.1 Páginas

`frontend/src/app/` — App Router do Next.js 15 (cada pasta com `page.tsx` é uma rota).

---

**Autenticação / Onboarding:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `page.tsx` | `/` | Login. Sidebar de branding + formulário |
| `cadastro/page.tsx` | `/cadastro` | Registro de nova empresa + usuário |
| `esqueci-senha/page.tsx` | `/esqueci-senha` | Pede email para reset de senha |
| `redefinir-senha/page.tsx` | `/redefinir-senha` | Formulário com token para definir nova senha |
| `verificar-email/page.tsx` | `/verificar-email` | Processa link do email de verificação, faz login automático |
| `email-enviado/page.tsx` | `/email-enviado` | Mensagem "verifique seu email" |

**Assinatura SaaS:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `assinar/page.tsx` | `/assinar` | Paywall: cards de planos com toggle mensal/anual |
| `assinar/pagamento/page.tsx` | `/assinar/pagamento` | Formulário de cartão de crédito + dados do titular |
| `assinatura/page.tsx` | `/assinatura` | Gerenciar assinatura atual (upgrade, cancelar, trocar cartão) |

**Dashboard:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `dashboard/page.tsx` | `/dashboard` | KPIs (saldo, receitas, despesas) + gráficos Recharts |

O dashboard exibe:
- Saldo total das contas bancárias
- Receitas vs. despesas do mês (barras)
- Fluxo de caixa projetado (linha)
- Receitas por tipo e despesas por tipo (pizza)
- Próximas receitas a receber e despesas a pagar
- Aniversariantes do mês

**Clientes e funcionários:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `clientes/page.tsx` | `/clientes` | CRUD de clientes com tabela + dialogs |
| `funcionarios/page.tsx` | `/funcionarios` | CRUD de funcionários/parceiros |
| `fornecedores/page.tsx` | `/fornecedores` | CRUD de fornecedores |

**Receitas:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `receitas/receber/page.tsx` | `/receitas/receber` | Receitas em aberto e vencidas |
| `receitas/recebidas/page.tsx` | `/receitas/recebidas` | Receitas pagas |
| `receitas-recorrentes/page.tsx` | `/receitas-recorrentes` | Templates de receita mensal |

**Despesas:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `despesas/pagar/page.tsx` | `/despesas/pagar` | Despesas em aberto e vencidas |
| `despesas/pagas/page.tsx` | `/despesas/pagas` | Despesas pagas |
| `despesas-recorrentes/page.tsx` | `/despesas-recorrentes` | Templates de despesa mensal |

**Bancos:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `bancos/page.tsx` | `/bancos` | Contas bancárias com saldos |
| `extrato/page.tsx` | `/extrato` | Import de extrato bancário + conciliação |
| `ativos/page.tsx` | `/ativos` | Custódias tipo Ativo |
| `passivos/page.tsx` | `/passivos` | Custódias tipo Passivo |

**Configurações:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `empresa/page.tsx` | `/empresa` | Dados da empresa (logo, endereço, comissão padrão) |

**Relatórios:**

| Arquivo | Rota | O que faz |
|---------|------|-----------|
| `relatorios/dre/page.tsx` | `/relatorios/dre` | DRE com filtros de período |
| `relatorios/balanco/page.tsx` | `/relatorios/balanco` | Balanço patrimonial |
| `relatorios/fluxo/page.tsx` | `/relatorios/fluxo` | Fluxo de caixa |
| `relatorios/comissoes/page.tsx` | `/relatorios/comissoes` | Comissões por funcionário |
| `relatorios/conciliacao/page.tsx` | `/relatorios/conciliacao` | Conciliação bancária |

---

**Layout e Providers:**

`layout.tsx` (root) — Define fontes (Playfair Display + Inter), Vercel Analytics, e o `<Providers>`.

`Providers.tsx` — Composição de:
- `MantineProvider` + `AntDesignConfigProvider` (temas de UI)
- `SubscriptionProvider` — carrega e expõe status da assinatura
- `SubscriptionGuard` — redireciona com base no status da assinatura:
  - `payment_failed` ou `overdue` → `/assinatura` (atualizar cartão)
  - `cancelled`, `expired` ou trial vencido → `/assinar` (escolher plano)
- `<Toaster>` do Sonner (notificações toast)

---

### 4.2 Componentes

`frontend/src/components/`

---

**`dialogs/`** — Modals de CRUD (25+ componentes)

Cada dialog segue o padrão:
1. Herda de `DialogBase.tsx` (wrapper Radix UI Dialog)
2. Recebe `isOpen`, `onClose`, e dados opcionais para edição
3. Gerencia estado do formulário internamente
4. Chama o service correspondente no submit
5. Exibe toast de sucesso/erro com Sonner

Principais dialogs:

| Componente | O que abre |
|------------|-----------|
| `ClienteDialog.tsx` | Criar/editar cliente com formas de cobrança e comissões |
| `ClienteProfileDialog.tsx` | Ver detalhes de um cliente (read-only) |
| `ReceitaDialog.tsx` | Criar/editar receita com comissões, opção de marcar como pago |
| `ReceitaRecorrenteDialog.tsx` | Criar/editar receita recorrente |
| `DespesaDialog.tsx` | Criar/editar despesa |
| `DespesaRecorrenteDialog.tsx` | Criar/editar despesa recorrente |
| `PaymentDialog.tsx` | Criar pagamento (entrada/saída) e alocar a receita/despesa/custódia/transferência |
| `FuncionarioDialog.tsx` | Criar/editar funcionário |
| `BancoDialog.tsx` | Criar/editar conta bancária |
| `CustodiaDialog.tsx` | Criar/editar custódia |
| `TransferDialog.tsx` | Criar transferência entre contas |
| `VincularLancamentoDialog.tsx` | Linkar um Payment existente a uma receita/despesa |
| `ImportExtratoDialog.tsx` | Upload de CSV/Excel do banco, detecta duplicatas |
| `ConciliacaoBancariaDialog.tsx` | Conciliar pagamentos importados |
| `DeleteConfirmationDialog.tsx` | Confirm dialog antes de deletar |
| `UpgradeDialog.tsx` | Prompt para upgrade de plano (ex: ao exportar PDF sem plano adequado) |

---

**`ui/`** — Primitivos Shadcn/Radix (18 componentes)

São componentes de UI genéricos sem lógica de negócio:
`Button`, `Card`, `Dialog`, `DropdownMenu`, `Input`, `Label`, `Popover`, `Select`, `Separator`, `Table`, `Tabs`, `Textarea`, `Checkbox`, `Command`, `AlertDialog`, `ScrollArea`, `Badge`

`StatusBadge.tsx` — Badge com cor baseada em situação (Paga = verde, Em Aberto = amarelo, Vencida = vermelho)

---

**`imports/`** — Componentes específicos do negócio

| Componente | O que faz |
|------------|-----------|
| `GenericTable.tsx` | Tabela Ant Design reutilizável com paginação, busca, ordenação e seleção de linhas |
| `PaymentsTabs.tsx` | Interface com abas para ver/gerenciar pagamentos de uma receita/despesa |
| `PaymentsTable.tsx` | Tabela de payments com informações de alocação |
| `ActionsDropdown.tsx` | Menu dropdown de ações por linha (editar, deletar, etc.) |
| `Navbar/NavbarNested.tsx` | Sidebar de navegação com seções colapsáveis |

---

**`form/`** — Wrappers de inputs de formulário

`FormInput.tsx`, `FormSelect.tsx`, `FormTextarea.tsx` — Adicionam label e mensagens de erro aos inputs base.

---

**Outros componentes:**

| Componente | O que faz |
|------------|-----------|
| `TrialBanner.tsx` | Faixa no topo da app mostrando dias restantes do trial |
| `WhatsAppButton.tsx` | Botão flutuante de WhatsApp (atualmente desabilitado) |

---

### 4.3 Serviços (API clients)

`frontend/src/services/`

Todos os services usam a mesma instância Axios configurada em `api.ts`.

---

**`api.ts`** — Configuração central do Axios:

```typescript
// Interceptor de request: adiciona token JWT
config.headers.Authorization = `Bearer ${token}`

// Interceptor de response:
// 401 → limpa tokens, redireciona para /
// 402 → lê cache de assinatura → redireciona /assinar ou /assinatura
```

O token é lido de `localStorage` (se rememberMe) ou `sessionStorage` (se não).

---

**`auth.ts`** — Autenticação:
```typescript
login(username, password, rememberMe)   // POST /api/token/
saveAuthTokens(access, refresh)         // Salva nos storages
logout()                                // Limpa tokens e cache
register(payload)                       // POST /api/register/
verifyEmail(uid, token)                 // POST /api/verify-email/
requestPasswordReset(email)             // POST /api/password-reset/
confirmPasswordReset(uid, token, pass)  // POST /api/password-reset/confirm/
```

---

**`assinatura.ts`** — Gerenciamento de assinaturas:
```typescript
getPlanos()                    // GET /api/planos/
getAssinaturaStatus()          // GET /api/assinatura/status_assinatura/
assinar(payload)               // POST /api/assinatura/assinar/
cancelarAssinatura()           // POST /api/assinatura/cancelar/
reativarAssinatura()           // POST /api/assinatura/reativar/
getLinkPagamento()             // GET /api/assinatura/link_pagamento/
getHistoricoPagamentos()       // GET /api/assinatura/pagamentos/
atualizarCartao(cardPayload)   // POST /api/assinatura/atualizar_cartao/
```

---

**Demais services** (padrão CRUD):

| Service | Entidade | Endpoints principais |
|---------|----------|---------------------|
| `clientes.ts` | Cliente | list, get, create, update, delete, gerarComissoes |
| `funcionarios.ts` | Funcionario | list, get, create, update, delete |
| `fornecedores.ts` | Fornecedor (tipo O) | list, get, create, update, delete |
| `receitas.ts` | Receita | getReceitasAbertas, getReceitasRecebidas, create, update, delete |
| `receitas-recorrentes.ts` | ReceitaRecorrente | CRUD |
| `despesas.ts` | Despesa | getDespesasAPagar, getDespesasPagas, create, update, delete |
| `despesas-recorrentes.ts` | DespesaRecorrente | CRUD |
| `pagamentos.ts` | Payment | CRUD, importExtrato, conciliarBancario |
| `bancos.ts` | ContaBancaria | CRUD |
| `custodias.ts` | Custodia | CRUD |
| `transferencias.ts` | Transfer | CRUD |
| `allocations.ts` | Allocation | CRUD |
| `empresa.ts` | Company | getMe, update |
| `relatorios.ts` | Relatórios | getDashboard, getDRE, getBalanco, etc. |
| `pdf.ts` | PDFs | Todas as rotas de PDF |

---

### 4.4 Tipos TypeScript

`frontend/src/types/`

Define as interfaces TypeScript para todas as entidades. Cada arquivo espelha os serializers do backend:

```typescript
// Exemplo: types/receitas.ts
interface Receita {
  id: number;
  nome: string;
  cliente: number;
  cliente_nome: string;  // campo extra vindo do serializer
  valor: string;         // Decimal vira string no DRF
  data_vencimento: string;  // "YYYY-MM-DD"
  situacao: 'P' | 'A' | 'V';
  // ...
}

interface ReceitaCreate {
  nome: string;
  cliente: number;
  valor: string;
  // ... só os campos que o backend aceita no POST
}
```

Arquivo especial: `types/assinatura.ts` — inclui os tipos do formulário de cartão de crédito (`CreditCardData`, `CardHolderInfo`) e o payload do Asaas.

---

### 4.5 Contexts e Hooks

---

**`contexts/SubscriptionContext.tsx`**

Provê para toda a app o status da assinatura atual:
```typescript
const { assinatura, loading, refresh } = useSubscription();
// assinatura: AssinaturaStatus | null
// loading: boolean
// refresh(): void — força recarregar do backend
```

O context:
1. Verifica se há token JWT (usuário logado)
2. Busca `/api/assinatura/status_assinatura/`
3. Cacheia em `sessionStorage` (key: `vincor_assinatura_cache`)
4. Expõe via Context API

---

**Hooks:**

| Hook | O que faz |
|------|-----------|
| `useDebounce.ts` | Debounce de 300ms para inputs de busca |
| `useDeleteConfirmation.tsx` | Gerencia estado do dialog de confirmação de delete |
| `useFormDirty.ts` | Detecta se um formulário tem mudanças não salvas |
| `useFormValidation.ts` | Validação de formulários com mensagens de erro |
| `useLoadAuxiliaryData.ts` | Pré-carrega clientes e funcionários para inputs select |
| `useUpgradeGuard.ts` | Verifica acesso a features por plano de assinatura |

**`useUpgradeGuard`** em detalhes:
```typescript
const { hasFeature, guard, guardAsync } = useUpgradeGuard();

// Verifica se tem acesso:
if (!hasFeature('pdf_export')) { mostrar UpgradeDialog }

// Wrapper que bloqueia função se não tiver feature:
const handleExportPDF = guard('pdf_export', () => {
  // só executa se tiver o plano correto
  downloadPDF();
});
```

Features controladas atualmente:
- `pdf_export`: requer plano Profissional ou Evolution (trial tem acesso completo)

---

### 4.6 Utilitários (lib/)

`frontend/src/lib/`

**`formatters.ts`** — Formatação para o padrão brasileiro:
```typescript
formatDateBR("2026-02-17")       // → "17/02/2026"
formatCurrencyBR(1234.56)        // → "R$ 1.234,56"
formatCurrencyInput(1234.56)     // → "1.234,56" (para inputs)
parseCurrencyBR("R$ 1.234,56")   // → 1234.56 (para enviar ao backend)
formatCpfCnpj("12345678901")     // → "123.456.789-01"
```

**`utils.ts`** — Utilitários gerais:
```typescript
cn(...classes)  // Tailwind merge (clsx + twMerge)
```

**`errors.ts`** — Tratamento de erros da API:
```typescript
getErrorMessage(error)          // Extrai mensagem amigável do AxiosError
handleBackendErrors(error, setErrors) // Mapeia erros de campo do DRF para o form
```

**`validation/`** — Schemas Zod para validação de cada entidade no frontend (antes de enviar para o backend).

---

## 5. Fluxos principais

### 5.1 Autenticação e segurança

```
Usuário entra em /
   ↓
POST /api/token/ com username + password
   ↓ retorna { access, refresh }
   ↓
if rememberMe → localStorage
else → sessionStorage
   ↓
Todas as requisições Axios: Authorization: Bearer <access>
   ↓
401? → clear tokens → redirect /
402? → read subscription cache → redirect /assinar ou /assinatura
```

**Verificação de email (fluxo):**
1. Novo usuário se registra em `/cadastro`
2. Backend envia email com link: `/verificar-email?uid=X&token=Y`
3. Usuário clica → `verify_email()` valida o token
4. Backend retorna tokens JWT → frontend salva e redireciona para `/dashboard`

---

### 5.2 Multi-tenancy

Toda a multi-tenancy é implementada via FK de `company`:

```python
# Todo model de dados tem:
company = models.ForeignKey(Company, on_delete=models.CASCADE)

# CompanyScopedViewSetMixin garante:
def get_queryset(self):
    return super().get_queryset().filter(company=self.request.user.company)

def perform_create(self, serializer):
    serializer.save(company=self.request.user.company)
```

Resultado: Usuários do Escritório A nunca veem dados do Escritório B, mesmo que a URL seja a mesma.

---

### 5.3 Sistema de comissões

Hierarquia de 3 níveis (primeira regra encontrada vence):

```
Nível 1 (maior prioridade): ReceitaComissao
    └── Regra específica para AQUELA receita + AQUELE funcionário

Nível 2: ClienteComissao
    └── Regra para AQUELE cliente + AQUELE funcionário

Nível 3: Não há padrão automático
    └── A empresa tem percentual_comissao, mas não é aplicado automaticamente
```

**Fluxo de geração de comissões:**
1. Usuário vai em `/clientes` → clicar "Gerar Comissões"
2. Frontend envia `POST /api/clientes/gerar-comissoes/` com `mes` e `ano`
3. Backend chama `calcular_comissoes_mes()`:
   - Busca Allocations do mês (pagamentos de receitas)
   - Para cada allocation: busca regra de comissão
   - Agrega por funcionário
4. Chama `gerar_despesas_comissao()`:
   - Cria `Despesa` de `tipo='C'` para cada funcionário com comissão
   - Despesas ficam no sistema com data_vencimento = último dia do mês
5. Essas despesas aparecem normalmente em `/despesas/pagar`

---

### 5.4 Alocação polimórfica

O `Payment` é uma transação bancária neutra. O `Allocation` é o que dá significado a ela:

```
Payment (tipo=Entrada, valor=1000, conta=Banco Itaú)
    └── Allocation (valor=1000) → Receita #42 "Honorários Cliente X"

Payment (tipo=Saída, valor=500, conta=Banco Itaú)
    └── Allocation (valor=300) → Despesa #10 "Aluguel"
    └── Allocation (valor=200) → Custodia #5 "Depósito Cliente Y"
```

Um Payment pode ter múltiplas Allocations (split). Cada Allocation aponta para exatamente UM destino (receita OU despesa OU custódia OU transferência).

Isso permite:
- Conciliação bancária (import de extrato e matching com receitas/despesas)
- Pagamentos parciais (saldo_aberto na receita)
- Transferências rastreáveis entre contas

---

### 5.5 Assinatura e pagamentos

**Ciclo de vida de uma assinatura:**

```
Empresa criada
    ↓
Signal cria AssinaturaEmpresa (status='trial', trial_fim=hoje+7)
    ↓
Trial expira → acesso bloqueado (HTTP 402) → redirect /assinar
    ↓
Usuário escolhe plano → /assinar/pagamento → preenche cartão
    ↓
POST /api/assinatura/assinar/ com { plano_slug, ciclo, credit_card, holder_info }
    ↓
Backend:
  1. criar_cliente_asaas() ou buscar_cliente_asaas_por_cpfcnpj()
  2. criar_assinatura_cartao_asaas() → Asaas cria assinatura recorrente
  3. Atualiza AssinaturaEmpresa: status='active', asaas_subscription_id=...
    ↓
Asaas cobra mensalmente/anualmente
    ↓
Webhook POST /api/asaas/webhook/?token=SECRET
  PAYMENT_RECEIVED → status='active'
  PAYMENT_OVERDUE  → status='overdue' → HTTP 402 → redirect /assinatura
  SUBSCRIPTION_CANCELLED → status='cancelled' → HTTP 402 → redirect /assinar
```

---

## 6. Estrutura de arquivos

```
ERP-Adv/
├── CLAUDE.md                    # Instruções para o Claude Code
├── GUIA_DO_PROJETO.md           # Este documento
│
├── backend/
│   ├── requirements.txt         # Dependências Python
│   ├── Procfile                 # gunicorn web: ... (produção)
│   ├── manage.py
│   ├── .env                     # Variáveis de ambiente (não commitado)
│   │
│   ├── gestao_financeira/       # Projeto Django (settings, wsgi, urls raiz)
│   │   ├── settings.py          # Configurações (DB, JWT, CORS, etc.)
│   │   ├── urls.py              # URL raiz (inclui core.urls + jwt endpoints)
│   │   └── wsgi.py
│   │
│   └── core/                    # App principal
│       ├── models/              # Modelos de dados
│       │   ├── __init__.py      # Re-exporta tudo
│       │   ├── identity.py      # Company, CustomUser
│       │   ├── people.py        # Cliente, FormaCobranca, Funcionario, ClienteComissao
│       │   ├── revenue.py       # Receita, ReceitaComissao, ReceitaRecorrente
│       │   ├── expense.py       # Despesa, DespesaRecorrente
│       │   ├── banking.py       # ContaBancaria, Payment, Transfer, Allocation
│       │   ├── custody.py       # Custodia
│       │   └── subscription.py  # PlanoAssinatura, AssinaturaEmpresa, WebhookLog
│       │
│       ├── serializers/         # DRF Serializers
│       │   ├── __init__.py
│       │   ├── identity.py
│       │   ├── people.py
│       │   ├── revenue.py
│       │   ├── expense.py
│       │   ├── banking.py
│       │   └── subscription.py
│       │
│       ├── views/               # ViewSets e views
│       │   ├── __init__.py
│       │   ├── mixins.py        # CompanyScopedViewSetMixin
│       │   ├── identity.py
│       │   ├── people.py
│       │   ├── revenue.py
│       │   ├── expense.py
│       │   ├── banking.py
│       │   ├── subscription.py
│       │   └── reports/
│       │       ├── base.py
│       │       ├── dashboard.py
│       │       ├── people.py
│       │       └── financial.py
│       │
│       ├── services/
│       │   └── commission.py    # calcular_comissoes_mes, gerar_despesas_comissao
│       │
│       ├── permissions.py       # IsSubscriptionActive
│       ├── asaas_service.py     # Integração com Asaas
│       ├── pdf_views.py         # Geração de PDFs com ReportLab (~2.400 linhas)
│       ├── urls.py              # Roteamento de toda a API
│       ├── pagination.py        # Configuração de paginação
│       ├── admin.py             # Django Admin
│       └── helpers/
│           └── pdf.py           # Utilitários de PDF
│
└── frontend/
    ├── package.json             # Dependências Node
    ├── next.config.ts           # Config Next.js
    ├── tailwind.config.ts       # Config Tailwind
    ├── tsconfig.json            # Config TypeScript
    ├── .env.local               # NEXT_PUBLIC_API_URL (não commitado)
    │
    └── src/
        ├── app/                 # Rotas (App Router)
        │   ├── layout.tsx       # Root layout (fontes, providers)
        │   ├── Providers.tsx    # MantineProvider, SubscriptionProvider, etc.
        │   ├── page.tsx         # Login (/)
        │   ├── cadastro/
        │   ├── esqueci-senha/
        │   ├── redefinir-senha/
        │   ├── verificar-email/
        │   ├── email-enviado/
        │   ├── assinar/
        │   ├── assinatura/
        │   ├── dashboard/
        │   ├── clientes/
        │   ├── funcionarios/
        │   ├── fornecedores/
        │   ├── receitas/
        │   ├── receitas-recorrentes/
        │   ├── despesas/
        │   ├── despesas-recorrentes/
        │   ├── bancos/
        │   ├── extrato/
        │   ├── ativos/
        │   ├── passivos/
        │   ├── empresa/
        │   └── relatorios/
        │
        ├── components/
        │   ├── dialogs/         # 25+ modals de CRUD
        │   ├── ui/              # Primitivos Shadcn/Radix
        │   ├── imports/         # Tabelas, Navbar, etc.
        │   └── form/            # FormInput, FormSelect, FormTextarea
        │
        ├── services/            # 20+ clients Axios
        │   ├── api.ts           # Instância Axios + interceptors
        │   ├── auth.ts
        │   ├── assinatura.ts
        │   └── ...
        │
        ├── types/               # Interfaces TypeScript
        ├── contexts/            # SubscriptionContext
        ├── hooks/               # 6 hooks customizados
        └── lib/                 # formatters, utils, errors, validation
```

---

## 7. Variáveis de ambiente

**Backend (`backend/.env`):**
```env
SECRET_KEY=django-insecure-...
ENV=development                      # ou production
ALLOWED_HOSTS=localhost,127.0.0.1

# Banco de dados (uma das duas opções):
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
# ou individuais: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Asaas (gateway de pagamento)
ASAAS_API_KEY=...
ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3   # dev
# ASAAS_BASE_URL=https://api.asaas.com/v3          # prod
ASAAS_WEBHOOK_TOKEN=...    # segredo para validar webhooks

# Email (reset de senha, verificação)
RESEND_API_KEY=...
```

**Frontend (`frontend/.env.local`):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api    # dev
# NEXT_PUBLIC_API_URL=https://api.seudominio.com/api  # prod
```

---

## 8. Endpoints da API

### ViewSets (CRUD automático via DefaultRouter)

| Prefixo | Entidade | Actions extras |
|---------|----------|----------------|
| `/api/companies/` | Company | `me` (GET/PATCH empresa do user) |
| `/api/users/` | CustomUser | — |
| `/api/clientes/` | Cliente | `gerar-comissoes` (POST) |
| `/api/funcionarios/` | Funcionario | — |
| `/api/fornecedores/` | Fornecedor | — |
| `/api/favorecidos/` | Favorecido | — |
| `/api/receitas/` | Receita | — |
| `/api/receitas-recorrentes/` | ReceitaRecorrente | — |
| `/api/despesas/` | Despesa | — |
| `/api/despesas-recorrentes/` | DespesaRecorrente | — |
| `/api/pagamentos/` | Payment | `import-extrato`, `conciliar-bancario` |
| `/api/contas-bancarias/` | ContaBancaria | — |
| `/api/custodias/` | Custodia | — |
| `/api/transferencias/` | Transfer | — |
| `/api/alocacoes/` | Allocation | — |
| `/api/planos/` | PlanoAssinatura | ReadOnly, público |
| `/api/assinatura/` | AssinaturaEmpresa | `status_assinatura`, `assinar`, `cancelar`, `reativar`, `link_pagamento`, `pagamentos`, `atualizar_cartao` |

### Auth (sem autenticação)
```
POST /api/register/                    → Criar empresa + usuário
POST /api/token/                       → Login (SimpleJWT)
POST /api/token/refresh/               → Renovar access token
POST /api/password-reset/              → Pedir reset de senha
POST /api/password-reset/confirm/      → Confirmar reset
POST /api/verify-email/                → Verificar email
POST /api/asaas/webhook/?token=SECRET  → Webhook do Asaas
```

### Relatórios JSON
```
GET /api/dashboard/
GET /api/relatorios/cliente/<id>/
GET /api/relatorios/funcionario/<id>/
GET /api/relatorios/tipo-periodo/
GET /api/relatorios/resultado-financeiro/
GET /api/relatorios/folha-salarial/
GET /api/relatorios/comissionamento/
GET /api/relatorios/resultado-mensal/
GET /api/relatorios/dre/
GET /api/relatorios/balanco/
GET /api/relatorios/conciliacao-bancaria/
```

### PDFs (retornam application/pdf)
```
GET /api/pdf/receitas-pagas/
GET /api/pdf/receitas-a-receber/
GET /api/pdf/despesas-pagas/
GET /api/pdf/despesas-a-pagar/
GET /api/pdf/cliente/<id>/
GET /api/pdf/funcionario/<id>/
GET /api/pdf/dre/
GET /api/pdf/fluxo-de-caixa/
GET /api/pdf/comissionamento/
GET /api/pdf/balanco/
GET /api/pdf/recibo-pagamento/
```

---

## Dicas para estudo

**Para entender o fluxo de uma receita:**
1. Leia `backend/core/models/revenue.py` → entenda `Receita` e `ReceitaComissao`
2. Leia `backend/core/serializers/revenue.py` → veja como vira JSON
3. Leia `backend/core/views/revenue.py` → veja como CRUD funciona
4. Leia `frontend/src/services/receitas.ts` → como frontend chama a API
5. Leia `frontend/src/components/dialogs/ReceitaDialog.tsx` → UI do formulário
6. Leia `frontend/src/app/receitas/receber/page.tsx` → a página completa

**Para entender o sistema de assinatura:**
1. `backend/core/models/subscription.py` → os 3 models + signal
2. `backend/core/permissions.py` → como o HTTP 402 é disparado
3. `backend/core/views/subscription.py` → como os endpoints funcionam
4. `backend/core/asaas_service.py` → integração com gateway
5. `frontend/src/contexts/SubscriptionContext.tsx` → estado global
6. `frontend/src/app/Providers.tsx` → `SubscriptionGuard` (redirecionamentos)
7. `frontend/src/app/assinar/page.tsx` → tela de planos
8. `frontend/src/app/assinar/pagamento/page.tsx` → formulário de cartão

**Para entender a alocação:**
1. `backend/core/models/banking.py` → `Payment`, `Allocation`, `ContaBancaria`
2. `backend/core/views/banking.py` → `PaymentViewSet` (atualização de saldo atômica)
3. `frontend/src/components/dialogs/PaymentDialog.tsx` → UI de criação de payment
4. `frontend/src/components/dialogs/VincularLancamentoDialog.tsx` → linkar pagamento existente

**Para entender comissões:**
1. `backend/core/services/commission.py` → lógica toda está aqui
2. `backend/core/views/people.py` → action `gerar-comissoes` no `ClienteViewSet`
3. `backend/core/models/people.py` → `ClienteComissao`
4. `backend/core/models/revenue.py` → `ReceitaComissao`

---

*Bom estudo! Quando voltar, qualquer dúvida é só perguntar.*
