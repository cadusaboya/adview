#!/usr/bin/env python
"""
Script de validação automática pós-importação.

Uso:
    python scripts/validate_import.py
    # ou
    ./scripts/validate_import.py
"""

import django
import os
import sys

# Setup Django
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'gestao_financeira.settings')
django.setup()

from core.models import (
    Company, CustomUser, Cliente, Funcionario,
    Receita, ReceitaRecorrente, Despesa, DespesaRecorrente,
    Payment, ContaBancaria, Custodia, Transfer, Allocation
)
from django.db.models import Sum, Count
from decimal import Decimal


def print_section(title):
    """Imprime título de seção"""
    print(f"\n{'=' * 70}")
    print(f"  {title}")
    print('=' * 70)


def validate():
    """Executa validação completa dos dados importados"""

    print_section("🔍 VALIDAÇÃO PÓS-IMPORTAÇÃO")

    errors = []
    warnings = []
    info = []

    # ========================================
    # 1. CONTAGEM DE REGISTROS
    # ========================================
    print("\n📊 CONTAGEM DE REGISTROS:")
    print("-" * 70)

    counts = {
        'Companies': Company.objects.count(),
        'Usuários': CustomUser.objects.count(),
        'Clientes': Cliente.objects.count(),
        'Funcionários': Funcionario.objects.count(),
        'Receitas': Receita.objects.count(),
        'Receitas Recorrentes': ReceitaRecorrente.objects.count(),
        'Despesas': Despesa.objects.count(),
        'Despesas Recorrentes': DespesaRecorrente.objects.count(),
        'Contas Bancárias': ContaBancaria.objects.count(),
        'Payments': Payment.objects.count(),
        'Allocations': Allocation.objects.count(),
        'Custódias': Custodia.objects.count(),
        'Transferências': Transfer.objects.count(),
    }

    for name, count in counts.items():
        print(f"  {name:25} {count:>8}")

    # ========================================
    # 2. VALIDAÇÃO DE INTEGRIDADE
    # ========================================
    print("\n🔍 VALIDAÇÃO DE INTEGRIDADE:")
    print("-" * 70)

    # Receitas órfãs
    receitas_orfas = Receita.objects.filter(cliente__isnull=True).count()
    if receitas_orfas > 0:
        errors.append(f"❌ {receitas_orfas} receitas sem cliente")
    else:
        info.append("✓ Todas as receitas têm cliente")

    # Despesas órfãs
    despesas_orfas = Despesa.objects.filter(responsavel__isnull=True).count()
    if despesas_orfas > 0:
        errors.append(f"❌ {despesas_orfas} despesas sem responsável")
    else:
        info.append("✓ Todas as despesas têm responsável")

    # Payments órfãos
    payments_orfaos = Payment.objects.filter(conta_bancaria__isnull=True).count()
    if payments_orfaos > 0:
        errors.append(f"❌ {payments_orfaos} payments sem conta bancária")
    else:
        info.append("✓ Todos os payments têm conta bancária")

    # Allocations órfãs
    allocations_orfas = Allocation.objects.filter(
        receita__isnull=True,
        despesa__isnull=True,
        custodia__isnull=True,
        transfer__isnull=True
    ).count()
    if allocations_orfas > 0:
        errors.append(f"❌ {allocations_orfas} allocations sem referência")
    else:
        info.append("✓ Todas as allocations têm referência válida")

    # Clientes sem empresa
    clientes_sem_empresa = Cliente.objects.filter(company__isnull=True).count()
    if clientes_sem_empresa > 0:
        errors.append(f"❌ {clientes_sem_empresa} clientes sem empresa")

    # Funcionários sem empresa
    funcionarios_sem_empresa = Funcionario.objects.filter(company__isnull=True).count()
    if funcionarios_sem_empresa > 0:
        errors.append(f"❌ {funcionarios_sem_empresa} funcionários sem empresa")

    for item in info:
        print(f"  {item}")

    # ========================================
    # 3. VALIDAÇÃO DE EMPRESAS
    # ========================================
    print("\n🏢 EMPRESAS:")
    print("-" * 70)

    if Company.objects.count() == 0:
        errors.append("❌ Nenhuma empresa encontrada!")
    else:
        for company in Company.objects.all():
            clientes_count = Cliente.objects.filter(company=company).count()
            funcionarios_count = Funcionario.objects.filter(company=company).count()
            users_count = CustomUser.objects.filter(company=company).count()

            print(f"  {company.name}")
            print(f"    CNPJ/CPF: {company.cnpj or company.cpf or 'N/A'}")
            print(f"    Usuários: {users_count}")
            print(f"    Clientes: {clientes_count}")
            print(f"    Funcionários: {funcionarios_count}")
            print()

    # ========================================
    # 4. VALIDAÇÃO FINANCEIRA
    # ========================================
    print("\n💰 VALIDAÇÃO FINANCEIRA:")
    print("-" * 70)

    # Saldos das contas
    if ContaBancaria.objects.count() > 0:
        print("\n  Contas Bancárias:")
        for conta in ContaBancaria.objects.all():
            payments_count = Payment.objects.filter(conta_bancaria=conta).count()
            print(f"    {conta.nome:30} R$ {conta.saldo_atual:>12,.2f}  ({payments_count} payments)")

        total_saldo = ContaBancaria.objects.aggregate(
            total=Sum('saldo_atual')
        )['total'] or Decimal('0.00')
        print(f"    {'-' * 48}")
        print(f"    {'TOTAL':30} R$ {total_saldo:>12,.2f}")
    else:
        warnings.append("⚠️  Nenhuma conta bancária encontrada")

    # Receitas por situação
    print("\n  Receitas por Situação:")
    receitas_stats = Receita.objects.values('situacao').annotate(
        total=Count('id'),
        valor_total=Sum('valor')
    )
    for stat in receitas_stats:
        situacao_map = {'P': 'Paga', 'A': 'Em Aberto', 'V': 'Vencida'}
        situacao_nome = situacao_map.get(stat['situacao'], stat['situacao'])
        print(f"    {situacao_nome:15} {stat['total']:>5} registros   R$ {stat['valor_total']:>12,.2f}")

    # Despesas por tipo
    print("\n  Despesas por Tipo:")
    despesas_stats = Despesa.objects.values('tipo').annotate(
        total=Count('id'),
        valor_total=Sum('valor')
    )
    for stat in despesas_stats:
        tipo_map = {'F': 'Fixa', 'V': 'Variável', 'C': 'Comissionamento', 'R': 'Reembolso'}
        tipo_nome = tipo_map.get(stat['tipo'], stat['tipo'])
        print(f"    {tipo_nome:15} {stat['total']:>5} registros   R$ {stat['valor_total']:>12,.2f}")

    # ========================================
    # 5. VALIDAÇÃO DE ALLOCATIONS
    # ========================================
    print("\n📊 ALLOCATIONS:")
    print("-" * 70)

    total_allocations = Allocation.objects.count()
    allocations_receita = Allocation.objects.filter(receita__isnull=False).count()
    allocations_despesa = Allocation.objects.filter(despesa__isnull=False).count()
    allocations_custodia = Allocation.objects.filter(custodia__isnull=False).count()
    allocations_transfer = Allocation.objects.filter(transfer__isnull=False).count()

    print(f"  Total de Allocations: {total_allocations}")
    print(f"    → Receitas:         {allocations_receita}")
    print(f"    → Despesas:         {allocations_despesa}")
    print(f"    → Custódias:        {allocations_custodia}")
    print(f"    → Transferências:   {allocations_transfer}")

    # Verificar soma
    soma = allocations_receita + allocations_despesa + allocations_custodia + allocations_transfer
    if soma != total_allocations:
        warnings.append(f"⚠️  Soma das allocations ({soma}) difere do total ({total_allocations})")

    # ========================================
    # 6. RELATÓRIO FINAL
    # ========================================
    print_section("📋 RELATÓRIO FINAL")

    if errors:
        print("\n❌ ERROS CRÍTICOS ENCONTRADOS:")
        for error in errors:
            print(f"  {error}")

    if warnings:
        print("\n⚠️  AVISOS:")
        for warning in warnings:
            print(f"  {warning}")

    if not errors and not warnings:
        print("\n✅ VALIDAÇÃO CONCLUÍDA COM SUCESSO!")
        print("   Nenhum problema encontrado. Dados parecem estar íntegros.")
    elif not errors:
        print("\n✅ VALIDAÇÃO PASSOU COM AVISOS")
        print("   Nenhum erro crítico, mas há alguns avisos acima.")
    else:
        print("\n❌ VALIDAÇÃO FALHOU")
        print("   Corrija os erros críticos acima antes de continuar.")

    print("\n" + "=" * 70 + "\n")

    return len(errors) == 0


if __name__ == '__main__':
    try:
        success = validate()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ ERRO DURANTE VALIDAÇÃO: {str(e)}\n")
        import traceback
        traceback.print_exc()
        sys.exit(2)
