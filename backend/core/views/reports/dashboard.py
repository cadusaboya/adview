from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Q, F, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta, date
from decimal import Decimal
from ...models import (
    Company, CustomUser, Cliente, Funcionario, Receita, Despesa,
    Payment, ContaBancaria, Allocation
)


def _atualizar_vencidas_company(company):
    """Atualiza automaticamente receitas e despesas vencidas de uma empresa."""
    hoje = timezone.now().date()
    Receita.objects.filter(company=company, situacao='A', data_vencimento__lt=hoje).update(situacao='V')
    Despesa.objects.filter(company=company, situacao='A', data_vencimento__lt=hoje).update(situacao='V')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_view(request):
    """
    Retorna dados consolidados do dashboard para o usuário autenticado.
    (Alinhado ao modelo financeiro do sistema: Payment = fonte da verdade)
    """
    user = request.user
    company = user.company

    # Atualiza vencidas antes de calcular o dashboard
    _atualizar_vencidas_company(company)

    hoje = timezone.now().date()
    inicio_mes = date(hoje.year, hoje.month, 1)

    # Data de 30 dias atrás
    data_30_dias_atras = hoje - timedelta(days=30)

    # ======================================================
    # FLUXO DE CAIXA REALIZADO (ÚLTIMOS 30 DIAS)
    # ======================================================

    # Entradas dos últimos 30 dias (todos os pagamentos tipo 'E', exceto transferências)
    receitas_30_dias = (
        Payment.objects.filter(
            company=company,
            tipo='E',
            data_pagamento__gte=data_30_dias_atras,
            data_pagamento__lte=hoje
        )
        .exclude(allocations__transfer__isnull=False)
        .aggregate(total=Sum('valor'))['total']
        or Decimal('0.00')
    )

    # Saídas dos últimos 30 dias (todos os pagamentos tipo 'S', exceto transferências)
    despesas_30_dias = (
        Payment.objects.filter(
            company=company,
            tipo='S',
            data_pagamento__gte=data_30_dias_atras,
            data_pagamento__lte=hoje
        )
        .exclude(allocations__transfer__isnull=False)
        .aggregate(total=Sum('valor'))['total']
        or Decimal('0.00')
    )

    # Fluxo de caixa realizado (o que entrou - o que saiu)
    fluxo_caixa_realizado = receitas_30_dias - despesas_30_dias

    # ======================================================
    # SALDO TOTAL DAS CONTAS
    # ======================================================

    saldo_total = (
        ContaBancaria.objects.filter(company=company)
        .aggregate(total=Sum('saldo_atual'))['total']
        or Decimal('0.00')
    )

    # Saldo de 30 dias atrás (para comparação)
    # Calculamos: saldo_atual - fluxo_realizado
    saldo_30_dias_atras = saldo_total - fluxo_caixa_realizado

    # ======================================================
    # RECEITAS PROJETADAS (PRÓXIMOS 30 DIAS)
    # ======================================================

    data_limite = hoje + timedelta(days=30)

    receitas_projetadas = (
        Receita.objects.filter(
            company=company,
            data_vencimento__gte=hoje,
            data_vencimento__lte=data_limite,
            situacao__in=['A', 'V']  # Não paga ainda
        )
        .annotate(
            total_alocado=Coalesce(
                Sum('allocations__valor'),
                Decimal('0.00'),
                output_field=DecimalField()
            )
        )
        .aggregate(
            total=Sum(F('valor') - F('total_alocado'), output_field=DecimalField())
        )['total']
        or Decimal('0.00')
    )

    # ======================================================
    # DESPESAS PROJETADAS (PRÓXIMOS 30 DIAS)
    # ======================================================

    despesas_projetadas = (
        Despesa.objects.filter(
            company=company,
            data_vencimento__gte=hoje,
            data_vencimento__lte=data_limite,
            situacao__in=['A', 'V']  # Não paga ainda
        )
        .annotate(
            total_alocado=Coalesce(
                Sum('allocations__valor'),
                Decimal('0.00'),
                output_field=DecimalField()
            )
        )
        .aggregate(
            total=Sum(F('valor') - F('total_alocado'), output_field=DecimalField())
        )['total']
        or Decimal('0.00')
    )

    # ======================================================
    # ANIVERSARIANTES DO DIA
    # ======================================================

    hoje_mes_dia = hoje.strftime('%m-%d')

    # Clientes aniversariantes
    clientes_aniversariantes = Cliente.objects.filter(
        company=company,
        aniversario__isnull=False,
        aniversario__month=hoje.month,
        aniversario__day=hoje.day
    )

    # Funcionários aniversariantes
    funcionarios_aniversariantes = Funcionario.objects.filter(
        company=company,
        aniversario__isnull=False,
        aniversario__month=hoje.month,
        aniversario__day=hoje.day
    )


    aniversariantes = {
        'clientes': [
            {
                'id': c.id,
                'nome': c.nome,
                'tipo': 'Cliente',
                'email': c.email,
                'telefone': c.telefone
            }
            for c in clientes_aniversariantes
        ],
        'funcionarios': [
            {
                'id': f.id,
                'nome': f.nome,
                'tipo': f.get_tipo_display(),
                'email': f.email,
                'telefone': f.telefone
            }
            for f in funcionarios_aniversariantes
        ]
    }

    # ======================================================
    # ALERTAS OPERACIONAIS (VENCIDAS)
    # ======================================================

    despesas_vencidas = Despesa.objects.filter(
        company=company,
        situacao='V'
    ).count()

    receitas_vencidas = Receita.objects.filter(
        company=company,
        situacao='V'
    ).count()

    valor_despesas_vencidas = (
        Despesa.objects.filter(
            company=company,
            situacao='V'
        )
        .annotate(
            total_alocado=Coalesce(
                Sum('allocations__valor'),
                Decimal('0.00'),
                output_field=DecimalField()
            )
        )
        .aggregate(
            total=Sum(F('valor') - F('total_alocado'), output_field=DecimalField())
        )['total']
        or Decimal('0.00')
    )

    valor_receitas_vencidas = (
        Receita.objects.filter(
            company=company,
            situacao='V'
        )
        .annotate(
            total_alocado=Coalesce(
                Sum('allocations__valor'),
                Decimal('0.00'),
                output_field=DecimalField()
            )
        )
        .aggregate(
            total=Sum(F('valor') - F('total_alocado'), output_field=DecimalField())
        )['total']
        or Decimal('0.00')
    )

    # ======================================================
    # GRÁFICO RECEITA x DESPESA (ÚLTIMOS 6 MESES - BRUTO)
    # ======================================================

    meses_data = []

    for i in range(5, -1, -1):
        ref = inicio_mes - timedelta(days=30 * i)
        mes_inicio = ref.replace(day=1)
        mes_fim = (mes_inicio.replace(day=28) + timedelta(days=4)).replace(
            day=1
        ) - timedelta(days=1)

        receita = (
            Receita.objects.filter(
                company=company,
                data_vencimento__gte=mes_inicio,
                data_vencimento__lte=mes_fim
            )
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        despesa = (
            Despesa.objects.filter(
                company=company,
                data_vencimento__gte=mes_inicio,
                data_vencimento__lte=mes_fim
            )
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        meses_data.append({
            'mes': mes_inicio.strftime('%b'),
            'receita': float(receita),
            'despesa': float(despesa),
        })

    # ======================================================
    # GRÁFICO FLUXO DE CAIXA REALIZADO (ÚLTIMOS 6 MESES)
    # ======================================================

    fluxo_caixa_data = []

    for i in range(5, -1, -1):
        ref = inicio_mes - timedelta(days=30 * i)
        mes_inicio = ref.replace(day=1)
        mes_fim = (mes_inicio.replace(day=28) + timedelta(days=4)).replace(
            day=1
        ) - timedelta(days=1)

        receita_mes = (
            Payment.objects.filter(
                company=company,
                tipo='E',
                data_pagamento__gte=mes_inicio,
                data_pagamento__lte=mes_fim
            )
            .exclude(allocations__transfer__isnull=False)
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        despesa_mes = (
            Payment.objects.filter(
                company=company,
                tipo='S',
                data_pagamento__gte=mes_inicio,
                data_pagamento__lte=mes_fim
            )
            .exclude(allocations__transfer__isnull=False)
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        fluxo_mes = receita_mes - despesa_mes

        fluxo_caixa_data.append({
            'mes': mes_inicio.strftime('%b'),
            'fluxo': float(fluxo_mes),
            'receita': float(receita_mes),
            'despesa': float(despesa_mes),
        })

    # ======================================================
    # RECEITA / DESPESA POR TIPO (PAGO)
    # ======================================================

    receita_por_tipo = []
    for tipo, label in Receita.TIPO_CHOICES:
        total = (
            Allocation.objects.filter(
                company=company,
                receita__tipo=tipo
            )
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        if total > 0:
            receita_por_tipo.append({
                'name': label,
                'value': float(total),
            })

    despesa_por_tipo = []
    for tipo, label in Despesa.TIPO_CHOICES:
        total = (
            Allocation.objects.filter(
                company=company,
                despesa__tipo=tipo
            )
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        if total > 0:
            despesa_por_tipo.append({
                'name': label,
                'value': float(total),
            })

    # ======================================================
    # PRÓXIMOS VENCIMENTOS
    # ======================================================

    data_limite = hoje + timedelta(days=5)

    receitas_proximas = (
        Receita.objects.filter(
            company=company,
            data_vencimento__gte=hoje,
            data_vencimento__lte=data_limite,
            situacao__in=['A', 'V']
        )
        .select_related('cliente')
        .order_by('data_vencimento')[:5]
    )

    despesas_proximas = (
        Despesa.objects.filter(
            company=company,
            data_vencimento__gte=hoje,
            data_vencimento__lte=data_limite,
            situacao__in=['A', 'V']
        )
        .select_related('responsavel')
        .order_by('data_vencimento')[:5]
    )

    # ======================================================
    # RESPONSE
    # ======================================================

    return Response({
        # Saldo e Fluxo
        'saldoTotal': float(saldo_total),
        'saldo30DiasAtras': float(saldo_30_dias_atras),
        'fluxoCaixaRealizado': float(fluxo_caixa_realizado),

        # Projeções (próximos 30 dias)
        'receitasProjetadas': float(receitas_projetadas),
        'despesasProjetadas': float(despesas_projetadas),

        # Alertas
        'despesasVencidas': despesas_vencidas,
        'receitasVencidas': receitas_vencidas,
        'valorDespesasVencidas': float(valor_despesas_vencidas),
        'valorReceitasVencidas': float(valor_receitas_vencidas),

        # Aniversariantes
        'aniversariantes': aniversariantes,

        # Gráficos
        'receitaVsDespesaData': meses_data,
        'fluxoCaixaData': fluxo_caixa_data,
        'receitaPorTipoData': receita_por_tipo,
        'despesaPorTipoData': despesa_por_tipo,

        # Próximos vencimentos
        'receitasProximas': [
            {
                'id': r.id,
                'nome': r.nome,
                'cliente': r.cliente.nome,
                'valor': float(r.valor),
                'dataVencimento': r.data_vencimento.isoformat(),
                'situacao': r.situacao,
            }
            for r in receitas_proximas
        ],

        'despesasProximas': [
            {
                'id': d.id,
                'nome': d.nome,
                'responsavel': d.responsavel.nome,
                'valor': float(d.valor),
                'dataVencimento': d.data_vencimento.isoformat(),
                'situacao': d.situacao,
            }
            for d in despesas_proximas
        ],
    })
