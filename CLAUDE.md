# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ERP-Adv is a financial management system (ERP) for a Brazilian law firm. It consists of a Django REST API backend and a Next.js frontend.

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
```

### Environment Variables
- Frontend: `frontend/.env.local` with `NEXT_PUBLIC_API_URL`
- Backend: `backend/.env` with `SECRET_KEY`, `ENV` (development/production), and database settings (`DATABASE_URL` or individual `DB_*` vars)

## Architecture

### Backend Structure (Django)
- `gestao_financeira/` - Django project settings and root URL configuration
- `core/` - Main Django app with all business logic
  - `models.py` - All data models (17 models)
  - `views.py` - 16 ViewSets and report API views (~4,100 lines)
  - `serializers.py` - 19 DRF serializers
  - `pdf_views.py` - PDF report generation using ReportLab (~2,400 lines)
  - `urls.py` - API routing using DRF DefaultRouter (90+ endpoints)
  - `pagination.py` - Custom pagination
  - `helpers/pdf.py` - PDF generation utilities

### Backend Dependencies
- Django 6.0.1 + DRF 3.16.0
- djangorestframework_simplejwt 5.5.0 (JWT auth)
- django-cors-headers 4.7.0
- reportlab 4.4.9 (PDF generation)
- psycopg2-binary 2.9.11 (PostgreSQL)
- pillow 12.1.0 (image processing for company logo)
- gunicorn 23.0.0 + whitenoise 6.11.0 (production)
- openpyxl 3.1.2 (Excel/bank statement import)
- python-dotenv, dj-database-url

### Frontend Structure (Next.js App Router)
- `src/app/` - 23 pages using Next.js App Router
- `src/components/dialogs/` - 27 modal dialogs for CRUD operations
- `src/components/ui/` - 20 Shadcn/Radix UI components
- `src/components/reports/` - Report components
- `src/services/` - 21 API client modules using Axios
- `src/types/` - 19 TypeScript type definition files
- `src/lib/` - Utilities (formatters, errors, validation)
- `src/hooks/` - 5 custom React hooks

### Frontend Dependencies
- Next.js 15.1.11 + React 19.0.0 + TypeScript 5
- Axios 1.9.0 (HTTP client)
- Recharts 3.6.0 (dashboard charts)
- Tailwind CSS 3.4.1
- Radix UI primitives (Shadcn pattern)
- Mantine 8.0.1 + Ant Design 5.25.2
- Lucide React + Tabler Icons
- Sonner 2.0.3 (toast notifications)
- qs 6.14.0 (query string parsing)

## Domain Models (Portuguese terminology)

| Model | Purpose | Key fields |
|-------|---------|-----------|
| **Company** | Law firm/organization | name, cnpj, cpf, logo, percentual_comissao |
| **CustomUser** | Auth user | Inherits AbstractUser; company FK |
| **Cliente** | Client | nome, tipo (Fixo/Avulso), formas_cobranca, comissoes |
| **FormaCobranca** | Billing method | formato (Mensal/Êxito), valor_mensal, percentual_exito |
| **ClienteComissao** | Client-level commission rule | percentual; links Cliente + Funcionario |
| **Funcionario** | Employee/Partner/Supplier | tipo (F=Funcionário/P=Parceiro/O=Outro), salario_mensal |
| **Receita** | Revenue/Income | tipo (F/V/E), situacao (P/A/V), comissoes nested |
| **ReceitaComissao** | Revenue-specific commission | percentual; links Receita + Funcionario |
| **ReceitaRecorrente** | Recurring revenue template | dia_vencimento, data_inicio/fim, status (A/P) |
| **ReceitaRecorrenteComissao** | Recurring revenue commission | percentual |
| **Despesa** | Expense | tipo (F/V/C/R), situacao (P/A/V); optional Receita FK (for commission expenses) |
| **DespesaRecorrente** | Recurring expense template | dia_vencimento, data_inicio/fim, status |
| **Payment** | Neutral transaction | tipo (E=Entrada/S=Saída), valor, data_pagamento; links to ContaBancaria |
| **ContaBancaria** | Bank account | nome, saldo_atual |
| **Custodia** | Custody/Escrow | tipo (P=Passivo/A=Ativo), status (A/P/L), valor_total, valor_liquidado |
| **Transfer** | Inter-bank transfer | from_bank, to_bank, status (P/M/C) |
| **Allocation** | Payment allocation (polymorphic) | links Payment → Receita OR Despesa OR Custodia OR Transfer |

## Key Architectural Patterns

- **Multi-tenancy**: `CompanyScopedViewSetMixin` on all ViewSets; every model has `company` FK; users see only their company's data
- **Polymorphic Allocation**: Single `Allocation` model links a `Payment` to one of 4 types (Receita/Despesa/Custodia/Transfer)
- **Commission hierarchy (3 levels)**: Company default → Client-level (`ClienteComissao`) → Revenue-specific (`ReceitaComissao`)
- **Status auto-calculation**: Receita/Despesa situacao (P/A/V) computed from allocations; Custodia status (A/P/L) from valor_liquidado
- **Authentication**: JWT stored in localStorage (rememberMe) or sessionStorage; auto-logout on 401
- **API routing**: REST at `/api/` with DefaultRouter; reports at `/api/relatorios/`; PDFs at `/api/pdf/`

## API Endpoints

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

### Report Endpoints (JSON)
- `/api/relatorios/cliente/<id>/`, `/api/relatorios/funcionario/<id>/`
- `/api/relatorios/tipo-periodo/`, `/api/relatorios/resultado-financeiro/`
- `/api/relatorios/folha-salarial/`, `/api/relatorios/comissionamento/`
- `/api/relatorios/resultado-mensal/`, `/api/relatorios/dre/`
- `/api/relatorios/balanco/`, `/api/relatorios/conciliacao-bancaria/`

### PDF Endpoints
- `/api/pdf/receitas-pagas/`, `/api/pdf/despesas-pagas/`
- `/api/pdf/despesas-a-pagar/`, `/api/pdf/receitas-a-receber/`
- `/api/pdf/cliente/<id>/`, `/api/pdf/funcionario/<id>/`
- `/api/pdf/dre/`, `/api/pdf/fluxo-de-caixa/`
- `/api/pdf/comissionamento/`, `/api/pdf/balanco/`

## Frontend Pages

| Route | Purpose |
|-------|---------|
| `/` | Login |
| `/dashboard` | KPIs + Recharts visualizations |
| `/clientes` | Client management |
| `/funcionarios` | Employee/Partner management |
| `/receitas`, `/receitas/receber`, `/receitas/recebidas` | Revenue management |
| `/receitas-recorrentes` | Recurring revenue templates |
| `/despesas`, `/despesas/pagar`, `/despesas/pagas` | Expense management |
| `/despesas-recorrentes` | Recurring expense templates |
| `/bancos` | Bank account management |
| `/fornecedores` | Supplier management (Funcionario type=O) |
| `/ativos`, `/passivos` | Custody assets/liabilities |
| `/extrato` | Bank statement import + reconciliation |
| `/empresa` | Company settings |
| `/relatorios/dre`, `/relatorios/balanco`, `/relatorios/fluxo`, `/relatorios/comissoes`, `/relatorios/conciliacao` | Reports |

## Utilities & Formatters (src/lib/)

- `formatDateBR(date)` → DD/MM/YYYY
- `formatCurrencyBR(value)` → R$ 1.234,56
- `formatCurrencyInput(value)` / `parseCurrencyBR(value)` → input handling
- `formatCpfCnpj(value)` → CPF/CNPJ masking
- `errors.ts` → API error normalization
- `utils.ts` → cn() and general helpers

## Custom Hooks (src/hooks/)

- `useDebounce` - Debounce search/filter inputs
- `useDeleteConfirmation` - Delete confirmation state
- `useFormDirty` - Track unsaved changes
- `useFormValidation` - Form validation with error messages
- `useLoadAuxiliaryData` - Load clientes/funcionarios for select inputs

## Deployment
- Backend: Gunicorn via Procfile, whitenoise for static files
- Production uses PostgreSQL (DATABASE_URL)
- Development uses local PostgreSQL or SQLite
