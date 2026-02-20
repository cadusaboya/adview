# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Reports Directory

- Save all AI-generated analysis/review reports in `reports/`.
- Do not create these report files in the repository root.

## Project Overview

ERP-Adv is a financial management system (ERP) for a Brazilian law firm. It consists of a Django REST API backend and a Next.js frontend.

**IMPORTANT: This is a Brazilian Portuguese project. All user-facing text in the frontend (labels, messages, placeholders, tooltips, button text, error messages, etc.) MUST be written in Portuguese (pt-BR). Never use English text in the UI.**

## Development Commands

### Frontend (Next.js)
```bash
cd frontend
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint
```

### Backend (Django)
```bash
cd backend
source venv/bin/activate
python manage.py runserver              # Dev server at localhost:8000
python manage.py makemigrations         # Create migrations
python manage.py migrate                # Apply migrations
python manage.py createsuperuser        # Create admin user
python manage.py reset_trial            # Management command to reset trials
```

### Environment Variables
- Frontend: `frontend/.env.local` with `NEXT_PUBLIC_API_URL`
- Backend: `backend/.env` with:
  - `SECRET_KEY`, `ENV` (development/production)
  - Database: `DATABASE_URL` or individual `DB_*` vars
  - Asaas: `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN`
  - Email: Resend API key (for password reset and email verification)

## Architecture

### Backend Structure (Django)
- `gestao_financeira/` - Django project settings and root URL configuration
- `core/` - Main Django app with all business logic
  - `models/` - Data models split by domain (package; `__init__.py` re-exports tudo)
    - `identity.py` - Company, CustomUser
    - `people.py` - Cliente, FormaCobranca, Funcionario, ClienteComissao
    - `revenue.py` - Receita, ReceitaComissao, ReceitaRecorrente, ReceitaRecorrenteComissao
    - `expense.py` - Despesa, DespesaRecorrente
    - `banking.py` - ContaBancaria, Payment, Transfer
    - `custody.py` - Custodia, Allocation
    - `subscription.py` - PlanoAssinatura, AssinaturaEmpresa, WebhookLog + signal post_save
  - `serializers/` - DRF serializers split por domínio (package; `__init__.py` re-exporta tudo)
    - `identity.py` - CompanySerializer, CustomUserSerializer
    - `people.py` - ClienteSerializer, FuncionarioSerializer, ClienteComissaoSerializer
    - `revenue.py` - ReceitaSerializer, ReceitaAbertaSerializer, ReceitaRecorrenteSerializer, ReceitaComissaoSerializer
    - `expense.py` - DespesaSerializer, DespesaAbertaSerializer, DespesaRecorrenteSerializer
    - `banking.py` - PaymentSerializer, ContaBancariaSerializer, TransferSerializer, AllocationSerializer
    - `custody.py` - CustodiaSerializer
    - `subscription.py` - PlanoAssinaturaSerializer, AssinaturaEmpresaSerializer
  - `views/` - ViewSets e views split por domínio (package; `__init__.py` re-exporta tudo)
    - `mixins.py` - CompanyScopedViewSetMixin, PaymentRateThrottle, helpers CPF/data
    - `identity.py` - CompanyViewSet, CustomUserViewSet, password_reset_request, password_reset_confirm, verify_email, register_view
    - `people.py` - ClienteViewSet, FuncionarioViewSet, FornecedorViewSet, FavorecidoViewSet
    - `revenue.py` - ReceitaViewSet, ReceitaRecorrenteViewSet
    - `expense.py` - DespesaViewSet, DespesaRecorrenteViewSet
    - `banking.py` - PaymentViewSet (+ import-extrato, conciliar-bancario), ContaBancariaViewSet, CustodiaViewSet, TransferViewSet, AllocationViewSet
    - `subscription.py` - PlanoAssinaturaViewSet, AssinaturaViewSet (+ checkout, portal), asaas_webhook
    - `reports/base.py` - BaseReportView
    - `reports/dashboard.py` - dashboard_view
    - `reports/people.py` - RelatorioClienteView, RelatorioFuncionarioView, RelatorioFolhaSalarialView, RelatorioComissionamentoView
    - `reports/financial.py` - RelatorioTipoPeriodoView, RelatorioResultadoFinanceiroView, RelatorioResultadoMensalView, dre_consolidado, balanco_patrimonial, relatorio_conciliacao_bancaria
  - `services/` - Camada de serviços (lógica de negócio desacoplada dos ViewSets)
    - `commission.py` - `calcular_comissoes_mes()`, `gerar_despesas_comissao()`
  - `permissions.py` - Custom DRF permissions (`IsSubscriptionActive`, `PaymentRequired` HTTP 402)
  - `asaas_service.py` - Asaas payment gateway integration (342 lines)
  - `pdf_views.py` - PDF report generation using ReportLab (~2,372 lines)
  - `urls.py` - API routing using DRF DefaultRouter (107 lines)
  - `pagination.py` - Custom pagination
  - `helpers/pdf.py` - PDF generation utilities
  - `management/commands/reset_trial.py` - Management command for trial resets

### Backend Dependencies
- Django 6.0.1 + DRF 3.16.0
- djangorestframework_simplejwt 5.5.0 (JWT auth; ACCESS=1 day, REFRESH=7 days, rotate=True)
- django-cors-headers 4.7.0
- reportlab 4.4.9 (PDF generation)
- psycopg2-binary 2.9.11 (PostgreSQL)
- pillow 12.1.0 (image processing for company logo)
- gunicorn 23.0.0 + whitenoise 6.11.0 (production)
- openpyxl 3.1.2 (Excel/bank statement import)
- requests 2.32.5 (HTTP client for Asaas)
- resend 2.10.0 (email service — password reset, email verification)
- django-import-export 4.3.7
- python-dotenv 1.2.1, dj-database-url, PyJWT 2.9.0
- coverage 7.8.0 (testing)

### Frontend Structure (Next.js App Router)
- `src/app/` - 29 pages using Next.js App Router
- `src/components/dialogs/` - 22 modal dialogs for CRUD operations
- `src/components/ui/` - 18 Shadcn/Radix UI components
- `src/components/` - Root components (Providers, TrialBanner, UpgradeDialog, WhatsAppButton)
- `src/services/` - 20 API client modules using Axios
- `src/types/` - 17 TypeScript type definition files
- `src/contexts/` - React contexts (`SubscriptionContext`)
- `src/lib/` - Utilities: formatters, errors, utils + `validation/` subdir with individual schemas per entity
- `src/hooks/` - 6 custom React hooks

### Frontend Dependencies
- Next.js 15.1.11 + React 19.0.0 + TypeScript 5
- Axios 1.9.0 (HTTP client)
- Recharts 3.6.0 (dashboard charts)
- Tailwind CSS 3.4.1 + tailwind-merge + tailwindcss-animate
- Radix UI primitives (Shadcn pattern) + class-variance-authority + clsx
- Mantine 8.0.1 + Ant Design 5.25.2
- Lucide React 0.511.0 + Tabler Icons 3.33.0
- Sonner 2.0.3 (toast notifications)
- qs 6.14.0 (query string parsing)
- @vercel/analytics 1.6.1

## Domain Models (Portuguese terminology)

| Model | Purpose | Key fields |
|-------|---------|-----------|
| **Company** | Law firm/organization | name, cnpj, cpf, logo, percentual_comissao, endereco, cidade, estado, telefone, email |
| **CustomUser** | Auth user | Inherits AbstractUser; company FK, is_email_verified |
| **Cliente** | Client | nome, tipo (Fixo/Avulso), cpf, email, telefone, aniversario |
| **FormaCobranca** | Billing method | formato (Mensal/Êxito), valor_mensal, percentual_exito, descricao |
| **ClienteComissao** | Client-level commission rule | percentual; links Cliente + Funcionario; unique_together |
| **Funcionario** | Employee/Partner/Supplier | tipo (F=Funcionário/P=Parceiro/O=Outro), salario_mensal, cpf, email, telefone, aniversario |
| **Receita** | Revenue/Income | tipo (F/V/E), situacao (P/A/V) auto-calc, forma_pagamento (Pix/Boleto), valor, valor_pago |
| **ReceitaComissao** | Revenue-specific commission | percentual; links Receita + Funcionario; unique_together |
| **ReceitaRecorrente** | Recurring revenue template | dia_vencimento, data_inicio/fim, status (A/P) |
| **ReceitaRecorrenteComissao** | Recurring revenue commission | percentual |
| **Despesa** | Expense | tipo (F/V/C/R), situacao (P/A/V) auto-calc, receita_origem FK (optional, commission expenses) |
| **DespesaRecorrente** | Recurring expense template | dia_vencimento, data_inicio/fim, status |
| **Payment** | Neutral transaction | tipo (E=Entrada/S=Saída), valor, data_pagamento; links to ContaBancaria |
| **ContaBancaria** | Bank account | nome, descricao, saldo_atual |
| **Custodia** | Custody/Escrow | tipo (P=Passivo/A=Ativo), status (A=Aberto/P=Parcial/L=Liquidado) auto-calc, valor_total, valor_liquidado |
| **Transfer** | Inter-bank transfer | from_bank, to_bank, status (P=Pendente/M=Mismatch/C=Completo) auto-calc |
| **Allocation** | Payment allocation (polymorphic) | links Payment → Receita OR Despesa OR Custodia OR Transfer; exactly one target |
| **PlanoAssinatura** | Subscription plan definition | nome, slug, preco_mensal, preco_anual, max_usuarios, features (JSON), ativo, ordem |
| **AssinaturaEmpresa** | Active subscription per company | OneToOne(Company), status (trial/active/overdue/payment_failed/cancelled/expired), plano FK, ciclo (MONTHLY/YEARLY), asaas_customer_id, asaas_subscription_id, card_last_four, card_brand, pending_plano/ciclo |
| **WebhookLog** | Asaas webhook event log | event_type, asaas_subscription_id, asaas_payment_id, payload (JSON), processed, error |

## Key Architectural Patterns

- **Multi-tenancy**: `CompanyScopedViewSetMixin` on all ViewSets; every model has `company` FK; users see only their company's data
- **Polymorphic Allocation**: Single `Allocation` model links a `Payment` to one of 4 types (Receita/Despesa/Custodia/Transfer); validation ensures exactly one target is linked and valor ≤ payment total
- **Commission hierarchy (3 levels)**: Company default (`percentual_comissao`) → Client-level (`ClienteComissao`) → Revenue-specific (`ReceitaComissao`)
- **Status auto-calculation**: `atualizar_status()` method on Receita, Despesa, Custodia, Transfer — triggered by Allocation save/delete
- **Authentication**: JWT stored in localStorage (rememberMe) or sessionStorage; Axios interceptor injects Bearer token; auto-logout on 401
- **Subscription enforcement**: `IsSubscriptionActive` permission class in `CompanyScopedViewSetMixin` → HTTP 402 → Axios interceptor → redirect `/assinar`; new companies get 7-day trial via `post_save` signal on Company
- **Email flow**: `resend` library for transactional email; `is_email_verified` flag on CustomUser; `verify_email` view with token
- **API routing**: REST at `/api/` with DefaultRouter; reports at `/api/relatorios/`; PDFs at `/api/pdf/`; auth at `/api/register/`, `/api/password-reset/`, `/api/verify-email/`

## API Endpoints

### Auth Routes
- `/api/register/` - New company self-registration
- `/api/password-reset/` - Password reset request (sends email via Resend)
- `/api/password-reset/confirm/` - Password reset confirmation
- `/api/verify-email/` - Email verification (token-based)

### ViewSet Routes (CRUD via DefaultRouter)
- `/api/companies/` + `me` action
- `/api/users/`
- `/api/clientes/` + `gerar-comissoes` action
- `/api/funcionarios/`, `/api/fornecedores/`, `/api/favorecidos/`
- `/api/receitas/`, `/api/receitas-recorrentes/`
- `/api/despesas/`, `/api/despesas-recorrentes/`
- `/api/pagamentos/` + `import-extrato` and `conciliar-bancario` actions
- `/api/contas-bancarias/`
- `/api/custodias/`
- `/api/transferencias/`
- `/api/alocacoes/`
- `/api/planos/` - Subscription plan listing
- `/api/assinatura/` + `checkout`, `portal` actions - Subscription management
- `/api/asaas/webhook/?token=SECRET` - Asaas payment webhook (PAYMENT_RECEIVED, PAYMENT_OVERDUE, SUBSCRIPTION_CANCELLED)

### Report Endpoints (JSON)
- `/api/dashboard/`
- `/api/relatorios/cliente/<id>/`, `/api/relatorios/funcionario/<id>/`
- `/api/relatorios/tipo-periodo/`, `/api/relatorios/resultado-financeiro/`
- `/api/relatorios/folha-salarial/`, `/api/relatorios/comissionamento/`
- `/api/relatorios/resultado-mensal/`, `/api/relatorios/dre/`
- `/api/relatorios/balanco/`, `/api/relatorios/conciliacao-bancaria/`

### PDF Endpoints
- `/api/pdf/receitas-pagas/`, `/api/pdf/despesas-pagas/`
- `/api/pdf/despesas-a-pagar/`, `/api/pdf/receitas-a-receber/`
- `/api/pdf/cliente-especifico/`, `/api/pdf/funcionario-especifico/`
- `/api/pdf/dre/`, `/api/pdf/fluxo-de-caixa/`
- `/api/pdf/comissionamento/`, `/api/pdf/balanco/`
- `/api/pdf/recibo-pagamento/`

## Frontend Pages

| Route | Purpose |
|-------|---------|
| `/` | Login |
| `/dashboard` | KPIs + Recharts visualizations |
| `/clientes` | Client management |
| `/funcionarios` | Employee/Partner management |
| `/fornecedores` | Supplier management (Funcionario type=O) |
| `/receitas`, `/receitas/receber`, `/receitas/recebidas` | Revenue management |
| `/receitas-recorrentes` | Recurring revenue templates |
| `/despesas`, `/despesas/pagar`, `/despesas/pagas` | Expense management |
| `/despesas-recorrentes` | Recurring expense templates |
| `/bancos` | Bank account management |
| `/ativos`, `/passivos` | Custody assets/liabilities |
| `/extrato` | Bank statement import + reconciliation |
| `/empresa` | Company settings |
| `/relatorios/dre`, `/relatorios/balanco`, `/relatorios/fluxo`, `/relatorios/comissoes`, `/relatorios/conciliacao` | Reports |
| `/cadastro` | New company self-registration |
| `/esqueci-senha`, `/redefinir-senha` | Password reset flow |
| `/verificar-email`, `/email-enviado` | Email verification flow |
| `/assinar` | Subscription paywall (plan selection + Asaas checkout) |
| `/assinar/pagamento` | Post-payment success/confirmation |
| `/assinatura` | Subscription management (current plan, status, portal) |

## Utilities & Formatters (src/lib/)

- `formatDateBR(date)` → DD/MM/YYYY
- `formatCurrencyBR(value)` → R$ 1.234,56
- `formatCurrencyInput(value)` / `parseCurrencyBR(value)` → input handling
- `formatCpfCnpj(value)` → CPF/CNPJ masking
- `errors.ts` → API error normalization
- `utils.ts` → cn() and general helpers
- `validation/schemas.ts` → Main schema aggregator; `validation/validators.ts` → validator helpers; `validation/backendErrors.ts` → backend error handling
- `validation/schemas/` → Individual schemas per entity: banco, cliente, custodia, despesa, despesaRecorrente, funcionario, payment, receita, receitaRecorrente, transfer

## Custom Hooks (src/hooks/)

- `useDebounce` - Debounce search/filter inputs
- `useDeleteConfirmation` - Delete confirmation state
- `useFormDirty` - Track unsaved changes
- `useFormValidation` - Form validation with error messages
- `useLoadAuxiliaryData` - Load clientes/funcionarios for select inputs
- `useUpgradeGuard` - Subscription upgrade guard/redirect

## Subscription Feature

- Plans: Essencial (R$120/mês, 1 user), Profissional (R$250/mês, 3 users), Evolution (R$600/mês or R$6.000/ano, unlimited)
- New companies: 7-day trial auto-created via `post_save` signal on Company
- Asaas sandbox: `https://sandbox.asaas.com/api/v3` / production: `https://api.asaas.com/v3`
- `AssinaturaEmpresa` tracks: status, plano, ciclo, asaas IDs, card info, pending plan changes
- Properties on model: `trial_ativo`, `dias_trial_restantes`, `acesso_permitido`
- Frontend: `SubscriptionContext` + `TrialBanner` in layout + `UpgradeDialog` component + `/assinar` paywall

## Deployment
- Backend: Gunicorn via Procfile, whitenoise for static files, Railway (`railway.toml`)
- Production uses PostgreSQL (DATABASE_URL)
- Frontend: Vercel (with `@vercel/analytics`)
- Development: local PostgreSQL; CORS allows localhost:3000 and ngrok domains
