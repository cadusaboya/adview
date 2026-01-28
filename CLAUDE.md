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
  - `models.py` - Data models (Company, CustomUser, Cliente, Funcionario, Receita, Despesa, Payment, ContaBancaria)
  - `views.py` - ViewSets and API views using Django REST Framework
  - `serializers.py` - DRF serializers
  - `pdf_views.py` - PDF report generation using ReportLab
  - `urls.py` - API routing using DRF DefaultRouter

### Frontend Structure (Next.js App Router)
- `src/app/` - Pages using Next.js App Router
  - `page.tsx` - Login/dashboard
  - `clientes/`, `funcionarios/`, `receitas/`, `despesas/`, `bancos/`, `fornecedores/`, `relatorios/` - Feature pages
- `src/components/` - React components
  - `ui/` - Reusable UI components (shadcn/ui pattern with Radix primitives)
  - `dialogs/` - Modal dialogs for CRUD operations
- `src/services/` - API client modules using Axios
  - `api.ts` - Axios instance with JWT interceptor
  - Individual service files per entity (clientes.ts, receitas.ts, etc.)
- `src/types/` - TypeScript type definitions per entity
- `src/lib/` - Utilities (cn() for classnames, formatters, error handling)

### Key Patterns
- **Multi-tenancy**: All models have a `company` foreign key; users belong to a company
- **Authentication**: JWT via SimpleJWT; tokens stored in localStorage
- **Payment tracking**: Receitas/Despesas have related Payment records; status auto-updates based on payments
- **API routing**: REST endpoints at `/api/` with ViewSets (e.g., `/api/clientes/`, `/api/receitas/`)
- **Reports**: JSON report endpoints at `/api/relatorios/` and PDF endpoints at `/api/pdf/`

### Domain Models (Portuguese terminology)
- **Company** - Law firm/organization
- **Cliente** - Client (Fixo=recurring, Avulso=one-time)
- **Funcionario** - Employee/Partner/Supplier
- **Receita** - Revenue/Income
- **Despesa** - Expense
- **Payment** - Payment record (links to Receita or Despesa)
- **ContaBancaria** - Bank account

## Deployment
- Backend: Gunicorn via Procfile, whitenoise for static files
- Production uses PostgreSQL (DATABASE_URL)
- Development uses local PostgreSQL or SQLite
