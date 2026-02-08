# ✅ Validação Pós-Importação

Após importar os dados, execute estas validações para garantir que tudo está correto.

## 🐍 Usando Django Shell

```bash
cd backend
source venv/bin/activate
python manage.py shell
```

### Contar Registros

```python
from core.models import *

print("📊 RESUMO DA IMPORTAÇÃO")
print("=" * 50)
print(f"Companies:              {Company.objects.count()}")
print(f"Usuários:               {CustomUser.objects.count()}")
print(f"Clientes:               {Cliente.objects.count()}")
print(f"Funcionários:           {Funcionario.objects.count()}")
print(f"Receitas:               {Receita.objects.count()}")
print(f"Receitas Recorrentes:   {ReceitaRecorrente.objects.count()}")
print(f"Despesas:               {Despesa.objects.count()}")
print(f"Despesas Recorrentes:   {DespesaRecorrente.objects.count()}")
print(f"Contas Bancárias:       {ContaBancaria.objects.count()}")
print(f"Payments:               {Payment.objects.count()}")
print(f"Allocations:            {Allocation.objects.count()}")
print(f"Custódias:              {Custodia.objects.count()}")
print(f"Transferências:         {Transfer.objects.count()}")
print("=" * 50)
```

### Verificar Integridade dos Relacionamentos

```python
# Verificar se todas as receitas têm cliente válido
from core.models import Receita
receitas_sem_cliente = Receita.objects.filter(cliente__isnull=True).count()
print(f"Receitas sem cliente: {receitas_sem_cliente}")
# Deve ser 0

# Verificar se todas as despesas têm responsável válido
from core.models import Despesa
despesas_sem_responsavel = Despesa.objects.filter(responsavel__isnull=True).count()
print(f"Despesas sem responsável: {despesas_sem_responsavel}")
# Deve ser 0

# Verificar se todos payments têm conta bancária
from core.models import Payment
payments_sem_conta = Payment.objects.filter(conta_bancaria__isnull=True).count()
print(f"Payments sem conta bancária: {payments_sem_conta}")
# Deve ser 0

# Verificar allocations
from core.models import Allocation
total_allocations = Allocation.objects.count()
allocations_com_receita = Allocation.objects.filter(receita__isnull=False).count()
allocations_com_despesa = Allocation.objects.filter(despesa__isnull=False).count()
allocations_com_custodia = Allocation.objects.filter(custodia__isnull=False).count()
allocations_com_transfer = Allocation.objects.filter(transfer__isnull=False).count()

print(f"\n📊 ALLOCATIONS:")
print(f"Total:              {total_allocations}")
print(f"  → Receitas:       {allocations_com_receita}")
print(f"  → Despesas:       {allocations_com_despesa}")
print(f"  → Custódias:      {allocations_com_custodia}")
print(f"  → Transferências: {allocations_com_transfer}")
```

### Verificar Saldos

```python
from core.models import ContaBancaria
from decimal import Decimal

print("\n💰 SALDOS DAS CONTAS BANCÁRIAS:")
print("=" * 60)
for conta in ContaBancaria.objects.all():
    print(f"{conta.nome:30} R$ {conta.saldo_atual:>15,.2f}")
print("=" * 60)

# Saldo total
total = ContaBancaria.objects.aggregate(
    total=Sum('saldo_atual')
)['total'] or Decimal('0.00')
print(f"{'TOTAL:':30} R$ {total:>15,.2f}")
```

### Listar Empresas e Estatísticas

```python
from core.models import Company, Cliente, Funcionario
from django.db.models import Count

print("\n🏢 EMPRESAS IMPORTADAS:")
print("=" * 80)

for company in Company.objects.all():
    clientes_count = Cliente.objects.filter(company=company).count()
    funcionarios_count = Funcionario.objects.filter(company=company).count()

    print(f"ID: {company.id}")
    print(f"Nome: {company.name}")
    print(f"CNPJ: {company.cnpj or 'N/A'}")
    print(f"Clientes: {clientes_count}")
    print(f"Funcionários: {funcionarios_count}")
    print("-" * 80)
```

### Verificar Usuários

```python
from core.models import CustomUser

print("\n👤 USUÁRIOS IMPORTADOS:")
print("=" * 60)
for user in CustomUser.objects.all():
    company_name = user.company.name if user.company else "Sem empresa"
    print(f"{user.username:20} | {user.email:30} | {company_name}")
```

## 🗃️ Usando SQL Direto (PostgreSQL)

Se preferir usar SQL direto:

```bash
# Conectar ao banco
python manage.py dbshell

# Ou se estiver usando variável DATABASE_URL
psql $DATABASE_URL
```

### Queries SQL Úteis

```sql
-- Contar registros por tabela
SELECT 'Companies' as tabela, COUNT(*) FROM core_company
UNION ALL
SELECT 'Users', COUNT(*) FROM core_customuser
UNION ALL
SELECT 'Clientes', COUNT(*) FROM core_cliente
UNION ALL
SELECT 'Funcionarios', COUNT(*) FROM core_funcionario
UNION ALL
SELECT 'Receitas', COUNT(*) FROM core_receita
UNION ALL
SELECT 'Despesas', COUNT(*) FROM core_despesa
UNION ALL
SELECT 'Payments', COUNT(*) FROM core_payment
UNION ALL
SELECT 'Allocations', COUNT(*) FROM core_allocation;

-- Verificar integridade de foreign keys (não deve retornar nada)
-- Receitas órfãs (sem cliente)
SELECT id, nome FROM core_receita WHERE cliente_id NOT IN (SELECT id FROM core_cliente);

-- Despesas órfãs (sem responsável)
SELECT id, nome FROM core_despesa WHERE responsavel_id NOT IN (SELECT id FROM core_funcionario);

-- Payments órfãos (sem conta bancária)
SELECT id, valor FROM core_payment WHERE conta_bancaria_id NOT IN (SELECT id FROM core_contabancaria);

-- Listar empresas com estatísticas
SELECT
    c.id,
    c.name,
    c.cnpj,
    COUNT(DISTINCT cl.id) as total_clientes,
    COUNT(DISTINCT f.id) as total_funcionarios
FROM core_company c
LEFT JOIN core_cliente cl ON cl.company_id = c.id
LEFT JOIN core_funcionario f ON f.company_id = c.id
GROUP BY c.id, c.name, c.cnpj;

-- Saldo total por conta bancária
SELECT
    nome,
    saldo_atual,
    (SELECT COUNT(*) FROM core_payment WHERE conta_bancaria_id = core_contabancaria.id) as total_payments
FROM core_contabancaria
ORDER BY saldo_atual DESC;

-- Receitas por situação
SELECT
    situacao,
    COUNT(*) as quantidade,
    SUM(valor) as valor_total
FROM core_receita
GROUP BY situacao
ORDER BY situacao;

-- Despesas por tipo
SELECT
    tipo,
    COUNT(*) as quantidade,
    SUM(valor) as valor_total
FROM core_despesa
GROUP BY tipo
ORDER BY tipo;
```

## 🔍 Checklist de Validação

Após executar as queries acima, verifique:

### ✅ Integridade de Dados
- [ ] Nenhuma receita sem cliente
- [ ] Nenhuma despesa sem responsável
- [ ] Nenhum payment sem conta bancária
- [ ] Nenhuma allocation sem referência (receita/despesa/custodia/transfer)

### ✅ Quantidade de Registros
- [ ] Número de empresas está correto
- [ ] Número de usuários está correto
- [ ] Número de clientes está correto
- [ ] Número de receitas/despesas está correto

### ✅ Valores Financeiros
- [ ] Saldos das contas bancárias estão corretos
- [ ] Valores de receitas/despesas parecem corretos
- [ ] Soma das allocations não excede valor dos payments

### ✅ Relacionamentos
- [ ] Clientes têm a empresa correta
- [ ] Receitas estão ligadas aos clientes corretos
- [ ] Despesas estão ligadas aos funcionários corretos
- [ ] Usuários têm a empresa correta

### ✅ Funcionalidade
- [ ] Consegue fazer login com usuários importados
- [ ] Dashboard carrega sem erros
- [ ] Relatórios mostram dados corretos
- [ ] Pode criar novas receitas/despesas sem erro

## 🚨 Se Encontrar Problemas

### Inconsistências nos Dados

Se encontrar dados inconsistentes:

1. **Identificar o problema** usando as queries acima
2. **Corrigir no Django shell** ou SQL
3. **Documentar** o que aconteceu para evitar no futuro

Exemplo de correção:

```python
# Django shell
from core.models import Receita

# Encontrar receitas problemáticas
receitas_problema = Receita.objects.filter(cliente__isnull=True)

# Se não deveriam existir, deletar
receitas_problema.delete()

# Ou atribuir a um cliente padrão
cliente_padrao = Cliente.objects.first()
for receita in receitas_problema:
    receita.cliente = cliente_padrado
    receita.save()
```

### Rollback Completo

Se precisar reverter a importação:

```bash
# Restaurar do backup
psql $DATABASE_URL < backup.sql

# Ou se fez backup com pg_dump
pg_restore -d $DATABASE_URL backup.dump
```

## 📊 Script de Validação Automática

Salve isto como `validate_import.py`:

```python
#!/usr/bin/env python
"""
Script de validação automática pós-importação.
Uso: python validate_import.py
"""

import django
import os
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gestao_financeira.settings')
django.setup()

from core.models import *
from django.db.models import Sum
from decimal import Decimal

def validate():
    print("🔍 INICIANDO VALIDAÇÃO...")
    print("=" * 60)

    errors = []
    warnings = []

    # 1. Verificar receitas órfãs
    receitas_orfas = Receita.objects.filter(cliente__isnull=True).count()
    if receitas_orfas > 0:
        errors.append(f"❌ {receitas_orfas} receitas sem cliente!")

    # 2. Verificar despesas órfãs
    despesas_orfas = Despesa.objects.filter(responsavel__isnull=True).count()
    if despesas_orfas > 0:
        errors.append(f"❌ {despesas_orfas} despesas sem responsável!")

    # 3. Verificar payments órfãos
    payments_orfaos = Payment.objects.filter(conta_bancaria__isnull=True).count()
    if payments_orfaos > 0:
        errors.append(f"❌ {payments_orfaos} payments sem conta bancária!")

    # 4. Verificar allocations órfãs
    allocations_orfas = Allocation.objects.filter(
        receita__isnull=True,
        despesa__isnull=True,
        custodia__isnull=True,
        transfer__isnull=True
    ).count()
    if allocations_orfas > 0:
        errors.append(f"❌ {allocations_orfas} allocations sem referência!")

    # 5. Verificar se há empresas
    if Company.objects.count() == 0:
        errors.append("❌ Nenhuma empresa encontrada!")

    # 6. Verificar se há usuários
    if CustomUser.objects.count() == 0:
        warnings.append("⚠️  Nenhum usuário encontrado")

    # Exibir resultado
    print("\n📊 RESUMO:")
    print(f"Companies:     {Company.objects.count()}")
    print(f"Usuários:      {CustomUser.objects.count()}")
    print(f"Clientes:      {Cliente.objects.count()}")
    print(f"Funcionários:  {Funcionario.objects.count()}")
    print(f"Receitas:      {Receita.objects.count()}")
    print(f"Despesas:      {Despesa.objects.count()}")

    print("\n" + "=" * 60)

    if errors:
        print("\n❌ ERROS ENCONTRADOS:")
        for error in errors:
            print(f"  {error}")

    if warnings:
        print("\n⚠️  AVISOS:")
        for warning in warnings:
            print(f"  {warning}")

    if not errors and not warnings:
        print("\n✅ VALIDAÇÃO PASSOU! Nenhum problema encontrado.")

    print("=" * 60)

    return len(errors) == 0

if __name__ == '__main__':
    success = validate()
    sys.exit(0 if success else 1)
```

Execute assim:

```bash
python validate_import.py
```
