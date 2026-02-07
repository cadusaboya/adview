# ERP-Adv Codebase Analysis Report

**Date:** 2026-02-07
**Scope:** Django Backend + Next.js Frontend
**Purpose:** Identify performance issues, UI/UX problems, inconsistencies, and potential bugs

---

## Table of Contents

1. [Performance Optimizations](#1-performance-optimizations)
2. [UI Improvements](#2-ui-improvements)
3. [UX Improvements](#3-ux-improvements)
4. [Pattern Inconsistencies](#4-pattern-inconsistencies)
5. [Potential Bugs](#5-potential-bugs)
6. [Priority Summary](#6-priority-summary)

---

## 1. Performance Optimizations

### 1.1 Backend N+1 Query Issues

#### CRITICAL: PaymentSerializer.get_allocations_info() - N+1 Queries
**File:** `/backend/core/serializers.py` (lines 390-419)
**Impact:** Critical - Every payment triggers multiple database queries for allocations and related entities

**Problem:**
```python
def get_allocations_info(self, obj):
    allocations = obj.allocations.all()  # Query 1
    return [{
        ...
        'receita': {
            'id': alloc.receita.id,  # N queries for each receita
            'nome': alloc.receita.nome,
            'cliente': alloc.receita.cliente.nome  # N+1 queries for cliente
        } if alloc.receita else None,
        ...
    } for alloc in allocations]
```

**Solution:**
Add `prefetch_related` and `select_related` in the ViewSet's `get_queryset`:
```python
def get_queryset(self):
    return super().get_queryset().prefetch_related(
        Prefetch(
            'allocations',
            queryset=Allocation.objects.select_related(
                'receita__cliente',
                'despesa__responsavel',
                'custodia__cliente',
                'custodia__funcionario',
                'transfer__from_bank',
                'transfer__to_bank'
            )
        )
    )
```

---

#### HIGH: AllocationSerializer N+1 in get_*_info methods
**File:** `/backend/core/serializers.py` (lines 655-710)
**Impact:** High - Each SerializerMethodField triggers individual queries

**Problem:** Methods `get_payment_info`, `get_receita_info`, `get_despesa_info`, `get_custodia_info`, `get_transfer_info` all access related objects without prefetching.

**Solution:** Add proper prefetch in `AllocationViewSet.get_queryset()`:
```python
def get_queryset(self):
    return super().get_queryset().select_related(
        'payment__conta_bancaria',
        'receita__cliente',
        'despesa__responsavel',
        'custodia__cliente',
        'custodia__funcionario',
        'transfer__from_bank',
        'transfer__to_bank'
    )
```

---

#### HIGH: TransferSerializer N+1 in get_valor_saida/get_valor_entrada
**File:** `/backend/core/serializers.py` (lines 538-550)
**Impact:** High - Each transfer triggers 2 aggregate queries

**Problem:**
```python
def get_valor_saida(self, obj):
    total = obj.allocations.filter(payment__tipo='S').aggregate(total=Sum('valor'))['total']
    return total or Decimal('0.00')
```

**Solution:** Use annotations in the ViewSet:
```python
def get_queryset(self):
    return super().get_queryset().annotate(
        valor_saida=Coalesce(
            Sum('allocations__valor', filter=Q(allocations__payment__tipo='S')),
            Decimal('0.00')
        ),
        valor_entrada=Coalesce(
            Sum('allocations__valor', filter=Q(allocations__payment__tipo='E')),
            Decimal('0.00')
        )
    )
```

---

#### MEDIUM: Conciliar Bancario - Multiple Aggregate Queries in Loop
**File:** `/backend/core/views.py` (lines 1826-2090)
**Impact:** Medium-High - O(n*m) queries in the reconciliation algorithm

**Problem:** For each payment, the code iterates over receitas/despesas/custodias and calls aggregate queries inside nested loops:
```python
for payment in payments_sem_alocacao:  # N payments
    for receita in receitas_abertas:  # M receitas
        total_alocado = receita.allocations.aggregate(...)['total']  # Query per iteration!
```

**Solution:** Pre-calculate all totals using a single annotated query:
```python
receitas_abertas = Receita.objects.filter(...).annotate(
    total_alocado=Coalesce(Sum('allocations__valor'), Decimal('0.00'))
)
```

---

#### MEDIUM: ClienteSerializer - Missing select_related for comissionado
**File:** `/backend/core/serializers.py` (lines 45-110)
**Impact:** Medium - N+1 when listing clients with comissionado

**Problem:** `get_comissionado` method accesses `obj.comissionado` without prefetching.

**Solution:** In `ClienteViewSet.get_queryset()`:
```python
def get_queryset(self):
    return super().get_queryset().select_related('comissionado').prefetch_related('formas_cobranca')
```

---

### 1.2 Frontend Performance Issues

#### HIGH: Unnecessary API Calls on Page Load
**File:** `/frontend/src/app/receitas/receber/page.tsx` (lines 102-111)
**Impact:** High - Loads all 1000 clients on every page mount

**Problem:**
```typescript
useEffect(() => {
    (async () => {
        const res = await getClientes({ page_size: 1000 });
        setClientes(res.results);
    })();
}, []);
```

**Solution:** Lazy load clients only when opening the report modal:
```typescript
const loadClientes = useCallback(async () => {
    if (clientesLoaded) return;
    const res = await getClientes({ page_size: 1000 });
    setClientes(res.results);
    setClientesLoaded(true);
}, [clientesLoaded]);

// Call only when modal opens
const handleOpenReportModal = async () => {
    await loadClientes();
    setOpenRelatorioModal(true);
};
```

---

#### HIGH: ReceitaDialog/DespesaDialog - Multiple API calls on mount
**File:** `/frontend/src/components/dialogs/ReceitaDialog.tsx` (lines 110-120)
**Impact:** High - 3 API calls every time dialog opens

**Problem:**
```typescript
useEffect(() => {
    getBancos({ page_size: 1000 }).then((res) => setBancos(...));
    getFuncionarios({ page_size: 1000 }).then((res) => setFuncionarios(...));
    getClientes({ page_size: 1000 }).then((res) => setClientes(...));
}, []);
```

**Solution:**
1. Create a shared context or hook for auxiliary data
2. Cache data in React Query or SWR
3. Only fetch when dialog actually opens (conditional on `open` prop)

```typescript
useEffect(() => {
    if (!open) return;

    Promise.all([
        getBancos({ page_size: 1000 }),
        getFuncionarios({ page_size: 1000 }),
        getClientes({ page_size: 1000 })
    ]).then(([bancosRes, funcRes, clientesRes]) => {
        setBancos(bancosRes.results);
        setFuncionarios(funcRes.results);
        setClientes(clientesRes.results);
    });
}, [open]);
```

---

#### MEDIUM: Clientes Page - Hidden Profile Dialog Pattern
**File:** `/frontend/src/app/clientes/page.tsx` (lines 410-420)
**Impact:** Medium - Creates N hidden dialogs, potential memory/DOM bloat

**Problem:**
```tsx
{clientes.map((cliente) => (
    <ClienteProfileDialog key={cliente.id} clientId={cliente.id}>
        <button id={`cliente-fin-${cliente.id}`} className="hidden" />
    </ClienteProfileDialog>
))}
```

**Solution:** Use a single dialog with dynamic content:
```tsx
const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);

<ClienteProfileDialog
    open={selectedClienteId !== null}
    clientId={selectedClienteId}
    onClose={() => setSelectedClienteId(null)}
/>
```

---

#### MEDIUM: loadData called in onClose callback
**Files:** Multiple page.tsx files
**Impact:** Medium - Unnecessary refetch after modal close even without changes

**Problem:**
```typescript
<ReceitaDialog
    open={openDialog}
    onClose={() => {
        setOpenDialog(false);
        setEditingReceita(null);
        loadReceitas(); // Always refetches, even if user just closed without saving
    }}
/>
```

**Solution:** Only refetch after successful save:
```typescript
const handleSubmit = async (data) => {
    await createReceita(data);
    loadReceitas(); // Refetch here
    setOpenDialog(false);
};

<ReceitaDialog
    onClose={() => {
        setOpenDialog(false);
        setEditingReceita(null);
        // Don't refetch here
    }}
/>
```

---

### 1.3 Missing Pagination/Lazy Loading

#### HIGH: Reports loading all data without pagination
**File:** `/backend/core/views.py` - Report views
**Impact:** High - Memory issues with large datasets

**Problem:** Report endpoints return all data without limits, which can cause memory issues.

**Solution:** Add pagination or streaming for large reports, or implement date range limits.

---

## 2. UI Improvements

### 2.1 Visual Inconsistencies

#### MEDIUM: Mixed Use of Ant Design and Shadcn/UI Buttons
**Files:** All page.tsx files
**Impact:** Medium - Inconsistent visual appearance

**Problem:**
- Some buttons use Ant Design's `<Button>` from 'antd'
- Others use shadcn/ui's `<Button>` from '@/components/ui/button'
- Different styling patterns mixed in the same pages

**Example from clientes/page.tsx:**
```tsx
import { Button } from 'antd';  // Ant Design
// vs
import { Button } from '@/components/ui/button';  // Shadcn (not used but should be consistent)
```

**Recommended Pattern:** Stick to one component library. Since the project uses shadcn/ui for form components, migrate all buttons to shadcn/ui for consistency.

---

#### MEDIUM: Inconsistent Toast Usage
**Files:** Multiple pages
**Impact:** Medium - Some pages use `message.error` (Ant Design), others use `toast.error` (Sonner)

**Problem:**
- `/frontend/src/app/receitas/receber/page.tsx` line 79: `message.error('Erro ao buscar receitas')`
- Same file line 119: `toast.success('Receita excluída com sucesso!')`

**Recommended Pattern:** Use only `toast` from Sonner for all notifications. Remove Ant Design's `message`.

---

#### LOW: Dashboard StatCard Duplicate Titles
**File:** `/frontend/src/app/dashboard/page.tsx` (lines 354-378)
**Impact:** Low - Confusing duplicate card titles

**Problem:**
```tsx
<StatCard title="Despesas Vencidas" value={data.despesasVencidas.toString()} ... />
<StatCard title="Despesas Vencidas" value={data.valorDespesasVencidas} ... />
```

Two cards have the same title but different values.

**Solution:** Use distinct titles like "Qtd. Despesas Vencidas" and "Valor Despesas Vencidas"

---

### 2.2 Loading States

#### HIGH: Missing Loading States in Dialogs
**Files:** Most dialog components
**Impact:** High - No visual feedback while submitting forms

**Problem:** ReceitaDialog, DespesaDialog don't show loading state during submission.

**Solution:** Use the `loading` prop on DialogBase (already supported):
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
        await onSubmit(payload);
    } finally {
        setIsSubmitting(false);
    }
};

<DialogBase loading={isSubmitting} ... />
```

---

#### MEDIUM: Table Loading Without Skeleton
**File:** `/frontend/src/components/imports/GenericTable.tsx`
**Impact:** Medium - Jarring loading experience

**Problem:** Uses Ant Design's default spinner which causes layout shifts.

**Solution:** Add skeleton rows for smoother UX:
```tsx
if (loading) {
    return <TableSkeleton rows={pageSize} columns={columns.length} />;
}
```

---

### 2.3 Accessibility (a11y)

#### HIGH: Missing Form Labels and ARIA attributes
**Files:** Most dialog components
**Impact:** High - Screen readers cannot properly navigate forms

**Problem:** Many inputs use `<label className="text-sm">` without proper `htmlFor`:
```tsx
<label className="text-sm">Cliente</label>
<AntdSelect ... />
```

**Solution:** Add proper label associations:
```tsx
<label htmlFor="cliente-select" className="text-sm">Cliente</label>
<AntdSelect id="cliente-select" aria-label="Selecione um cliente" ... />
```

---

#### MEDIUM: Missing Focus Management in Dialogs
**File:** `/frontend/src/components/dialogs/DialogBase.tsx`
**Impact:** Medium - Keyboard users may have difficulty navigating

**Solution:** Trap focus within dialog and auto-focus first input on open.

---

### 2.4 Responsiveness

#### MEDIUM: Fixed Width Search Inputs
**Files:** All page.tsx files
**Impact:** Medium - Search input `w-80` breaks on small screens

**Problem:**
```tsx
<Input className="w-80" placeholder="Buscar..." />
```

**Solution:** Use responsive width:
```tsx
<Input className="w-full md:w-80" placeholder="Buscar..." />
```

---

## 3. UX Improvements

### 3.1 Form Validation

#### HIGH: Inconsistent Client-Side Validation
**Files:** Dialog components
**Impact:** High - Some dialogs use Zod validation, others don't

**Problem:**
- `ClienteDialog` uses `useFormValidation` with Zod schema
- `ReceitaDialog` has no client-side validation
- `DespesaDialog` has no client-side validation

**Recommended Pattern:** All dialogs should use the existing `useFormValidation` hook with Zod schemas.

---

#### MEDIUM: Missing Required Field Indicators
**Files:** Most dialogs
**Impact:** Medium - Users don't know which fields are mandatory

**Problem:** Required fields like "Nome" and "Cliente" don't have visual indicators.

**Solution:** Add asterisks or "Required" text to mandatory fields:
```tsx
<label className="text-sm">
    Nome <span className="text-red-500">*</span>
</label>
```

---

### 3.2 Error Handling

#### HIGH: Inconsistent Error Message Display
**Files:** Various pages
**Impact:** High - Users see cryptic or inconsistent error messages

**Problem:** Different error handling approaches:
```typescript
// Pattern 1: Generic
toast.error('Erro ao salvar despesa');

// Pattern 2: Uses getErrorMessage helper
toast.error(getErrorMessage(error, 'Erro ao salvar cliente'));

// Pattern 3: Inline check
const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
toast.error(`Erro: ${errorMessage}`);
```

**Recommended Pattern:** Always use `getErrorMessage()` helper:
```typescript
import { getErrorMessage } from '@/lib/errors';
toast.error(getErrorMessage(error, 'Erro ao salvar'));
```

---

#### MEDIUM: Silent Failures in Payment Creation
**File:** `/backend/core/views.py` (lines 451-452, 863-864)
**Impact:** Medium - Errors silently ignored

**Problem:**
```python
except ContaBancaria.DoesNotExist:
    pass  # Silently ignore if bank account doesn't exist
```

**Solution:** Return meaningful error or log the issue:
```python
except ContaBancaria.DoesNotExist:
    logger.warning(f"Conta bancária {conta_bancaria_id} não encontrada")
    # Consider returning validation error
```

---

### 3.3 Navigation

#### LOW: No Confirmation on Unsaved Changes
**Files:** All dialogs
**Impact:** Low - Users may lose form data by accident

**Problem:** Closing a dialog with unsaved changes doesn't prompt for confirmation.

**Solution:** Track form dirty state and show confirmation:
```typescript
const handleClose = () => {
    if (isDirty) {
        if (!confirm('Descartar alterações não salvas?')) return;
    }
    onClose();
};
```

---

## 4. Pattern Inconsistencies

### 4.1 Error Handling Patterns

| Location | Pattern | Recommendation |
|----------|---------|----------------|
| clientes/page.tsx | `getErrorMessage()` helper | **USE THIS** |
| receitas/receber/page.tsx | inline `error instanceof Error` | Migrate to helper |
| despesas/pagar/page.tsx | generic `toast.error('Erro...')` | Migrate to helper |
| funcionarios/page.tsx | `getErrorMessage()` helper | Correct |

**Standard Pattern:**
```typescript
import { getErrorMessage } from '@/lib/errors';

try {
    await someApiCall();
} catch (error) {
    console.error(error);
    toast.error(getErrorMessage(error, 'Mensagem padrão'));
}
```

---

### 4.2 Form Data State Management

| Dialog | Pattern | Recommendation |
|--------|---------|----------------|
| ClienteDialog | `useFormValidation` hook with Zod | **USE THIS** |
| ReceitaDialog | Manual `useState` for each field | Migrate to hook |
| DespesaDialog | Manual `useState` for each field | Migrate to hook |
| FuncionarioDialog | `useFormValidation` hook with Zod | Correct |
| BancoDialog | Manual `useState` | Migrate to hook |

**Standard Pattern:** All dialogs should use `useFormValidation` hook with corresponding Zod schemas.

---

### 4.3 API Service Patterns

| Service | Return Type Pattern | Recommendation |
|---------|---------------------|----------------|
| clientes.ts | `PaginatedResponse<Cliente>` | **USE THIS** |
| receitas.ts | `{ results: Receita[]; count: number }` | Standardize |
| despesas.ts | `PaginatedResponse<Despesa>` | Correct |
| payments.ts | `PaginatedResponse<Payment>` | Correct |

**Standard Pattern:**
```typescript
type PaginatedResponse<T> = {
    results: T[];
    count: number;
    next?: string;
    previous?: string;
};
```

---

### 4.4 Pagination Handler Patterns

| Page | onChange Handler | Recommendation |
|------|------------------|----------------|
| clientes/page.tsx | `onChange: (page) => setPage(page)` | Correct |
| funcionarios/page.tsx | `onChange: setPage` | **USE THIS** (cleaner) |
| despesas/pagar/page.tsx | `onChange: (p) => setPage(p)` | Standardize |

**Standard Pattern:**
```typescript
pagination={{
    current: page,
    pageSize,
    total,
    onChange: setPage,
    onShowSizeChange: (_, size) => {
        setPageSize(size);
        setPage(1);
    },
}}
```

---

### 4.5 Column Width Definitions

| Page | Width Sum | Issue |
|------|-----------|-------|
| clientes/page.tsx | 45+16+20+8+6 = 95% | Missing 5% |
| receitas/receber/page.tsx | 12+25+25+12+12+6 = 92% | Missing 8% |
| despesas/pagar/page.tsx | 12+22+24+12+16+6 = 92% | Missing 8% |

**Recommendation:** Ensure column widths sum to 100% or use `flex` for responsive columns.

---

### 4.6 Backend ViewSet Patterns

| ViewSet | Has select_related | Has prefetch_related | Pagination |
|---------|-------------------|---------------------|------------|
| ReceitaViewSet | Yes | Yes (allocations) | Yes |
| DespesaViewSet | Yes | Yes (allocations) | Yes |
| PaymentViewSet | No | Yes (allocations) | Yes |
| ClienteViewSet | **No** | **No** | Yes |
| FuncionarioViewSet | No | No | Yes |
| CustodiaViewSet | Yes | **No** | Yes |

**Recommendation:** Add consistent query optimization across all ViewSets.

---

## 5. Potential Bugs

### 5.1 Backend Bugs

#### CRITICAL: Race Condition in Bank Balance Updates
**File:** `/backend/core/views.py` (lines 1220-1262)
**Impact:** Critical - Concurrent transactions could cause incorrect balances

**Problem:** The balance update happens in a separate query after payment creation, which is not atomic:
```python
payment = serializer.save(company=self.request.user.company)
# Race condition window here!
ContaBancaria.objects.filter(pk=payment.conta_bancaria.pk).update(
    saldo_atual=F('saldo_atual') + payment.valor
)
```

**Solution:** Use `select_for_update` or database transactions:
```python
from django.db import transaction

with transaction.atomic():
    payment = serializer.save(company=self.request.user.company)
    ContaBancaria.objects.select_for_update().filter(
        pk=payment.conta_bancaria.pk
    ).update(saldo_atual=F('saldo_atual') + payment.valor)
```

---

#### HIGH: PDF Report References Old Payment Model
**File:** `/backend/core/pdf_views.py` (lines 51-58)
**Impact:** High - Report likely broken

**Problem:**
```python
pagamentos = Payment.objects.filter(
    company=company,
    receita__isnull=False  # Old model - Payment no longer has direct receita field
)
```

The Payment model now uses Allocations instead of direct foreign keys.

**Solution:** Update to use allocations:
```python
pagamentos = Payment.objects.filter(
    company=company,
    allocations__receita__isnull=False
).prefetch_related('allocations__receita__cliente')
```

---

#### HIGH: Receita Type Mismatch - 'E' for Estorno
**File:** `/frontend/src/types/receitas.ts` (line 10)
**Impact:** High - Type system doesn't match backend

**Problem:**
```typescript
tipo: 'F' | 'V' | 'E';  // E = Estorno
```

But the Receita type also expects:
```typescript
comissionado?: { id: number; nome: string };  // This field doesn't exist on Receita model
```

The backend Receita model doesn't have a `comissionado` field - it's on Cliente.

**Solution:** Remove `comissionado` from Receita type or update if business logic changed.

---

#### MEDIUM: Missing Validation - Allocation Without Target
**File:** `/backend/core/serializers.py`
**Impact:** Medium - API could accept invalid allocations

**Problem:** AllocationSerializer doesn't validate in `validate()` that at least one of receita/despesa/custodia/transfer is provided.

**Note:** The model has this validation in `clean()`, but serializer should also validate for better error messages.

---

#### MEDIUM: Bare except in gerar_mes actions
**File:** `/backend/core/views.py` (lines 527, 599, 939)
**Impact:** Medium - Catches all exceptions including system errors

**Problem:**
```python
except:
    return Response(
        {'erro': 'Formato de mês inválido. Use YYYY-MM'},
        status=status.HTTP_400_BAD_REQUEST
    )
```

**Solution:** Catch specific exceptions:
```python
except (ValueError, IndexError) as e:
    return Response(
        {'erro': f'Formato de mês inválido. Use YYYY-MM. Detalhe: {str(e)}'},
        status=status.HTTP_400_BAD_REQUEST
    )
```

---

### 5.2 Frontend Bugs

#### HIGH: Unchecked Optional Property Access
**File:** `/frontend/src/app/receitas/receber/page.tsx` (line 83)
**Impact:** High - Potential runtime error

**Problem:**
```typescript
setFormData({
    ...
    cliente_id: receita.cliente?.id ?? receita.cliente_id!,  // Non-null assertion
```

Using `!` on potentially undefined value.

**Solution:** Provide a fallback:
```typescript
cliente_id: receita.cliente?.id ?? receita.cliente_id ?? 0,
```

---

#### MEDIUM: Missing Null Check in formatters
**File:** `/frontend/src/lib/formatters.ts` (line 50-56)
**Impact:** Medium - parseCurrencyBR doesn't handle all edge cases

**Problem:**
```typescript
export function parseCurrencyBR(value: string) {
    if (!value) return 0;
    return Number(value.replace(/\./g, '').replace(',', '.'));
}
```

Doesn't handle:
- Numbers like "1.234.567" correctly if there's no decimal part
- Negative numbers

**Solution:**
```typescript
export function parseCurrencyBR(value: string): number {
    if (!value) return 0;
    const cleaned = value.trim().replace(/[R$\s]/g, '');
    const isNegative = cleaned.startsWith('-');
    const absolute = cleaned.replace('-', '');
    // Brazilian format: 1.234,56
    const normalized = absolute.replace(/\./g, '').replace(',', '.');
    const result = parseFloat(normalized) || 0;
    return isNegative ? -result : result;
}
```

---

#### LOW: Console.log in Production
**File:** `/frontend/src/services/api.ts` (lines 21-25)
**Impact:** Low - Logs sensitive info in development

**Problem:**
```typescript
if (process.env.NODE_ENV === 'development') {
    console.log('Axios Request:', config.url);
    console.log('Headers:', config.headers);  // Could expose auth tokens
    console.log('Params:', config.params);
}
```

**Solution:** Use a proper logging library that can be disabled in production and doesn't log sensitive headers.

---

### 5.3 Type Divergences (Frontend vs Backend)

| Field | Frontend Type | Backend Field | Issue |
|-------|--------------|---------------|-------|
| Cliente.tipo | `string` | `CharField(max_length=1)` | Should be `'F' \| 'A'` |
| Receita.comissionado | exists | doesn't exist | Remove from frontend |
| Payment.allocations_info | `AllocationInfo[]` | SerializerMethodField | Types match |
| Allocation.transfer | `number` | `ForeignKey` | Correct |

---

## 6. Priority Summary

### Critical (Fix Immediately)
1. Race condition in bank balance updates (views.py)
2. PDF reports using old Payment model structure
3. PaymentSerializer N+1 queries

### High (Fix This Sprint)
1. AllocationSerializer N+1 queries
2. Frontend unnecessary API calls on page load
3. ReceitaDialog/DespesaDialog multiple API calls
4. Missing form validation in dialogs
5. Inconsistent error handling patterns

### Medium (Fix Next Sprint)
1. TransferSerializer N+1 queries
2. ClienteSerializer missing select_related
3. Mixed UI component libraries (Ant Design vs Shadcn)
4. Inconsistent toast usage
5. Fixed width search inputs (responsiveness)
6. Silent failures in payment creation

### Low (Backlog)
1. Dashboard duplicate card titles
2. Column widths not summing to 100%
3. Console.log in development
4. Missing confirmation on unsaved changes

---

## Implementation Notes for Agent

When implementing fixes:

1. **For N+1 queries:** Always add query optimizations in the ViewSet's `get_queryset()` method, not in the serializer.

2. **For error handling:** Import and use `getErrorMessage` from `@/lib/errors`.

3. **For form validation:** Use the existing `useFormValidation` hook with Zod schemas from `@/lib/validation/schemas/`.

4. **For API calls:** Consider implementing React Query or SWR for caching and deduplication.

5. **For UI consistency:** When adding new buttons, use Ant Design's Button component as that's the current majority pattern, but consider a full migration to shadcn/ui in the future.

6. **For loading states:** Use the existing `loading` prop on `DialogBase` and `GenericTable`.

7. **For backend transactions:** Import and use `django.db.transaction.atomic` for any operation that modifies multiple database tables.
