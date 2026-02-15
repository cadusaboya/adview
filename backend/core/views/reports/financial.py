from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, Count
from datetime import date, datetime, timedelta
from decimal import Decimal
from .base import BaseReportView
from ...models import Receita, Despesa, Payment, Allocation
from ...serializers import ReceitaSerializer, DespesaSerializer


class RelatorioTipoPeriodoView(BaseReportView):
    """Relatório de Receitas ou Despesas por Tipo e/ou Período."""
    def get(self, request):
        params = request.query_params
        tipo_relatorio = params.get('tipo_relatorio', '').lower() # 'receita' or 'despesa'
        tipo_item = params.get('tipo_item') # Specific type like 'F', 'V', etc.
        filters = self.get_common_filters()

        if tipo_relatorio == 'receita':
            model = Receita
            serializer = ReceitaSerializer
            if tipo_item:
                filters['tipo'] = tipo_item
        elif tipo_relatorio == 'despesa':
            model = Despesa
            serializer = DespesaSerializer
            if tipo_item:
                filters['tipo'] = tipo_item
        else:
            return Response({"detail": "Parâmetro 'tipo_relatorio' (receita ou despesa) é obrigatório."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_company_queryset(model).filter(**filters)
        data = serializer(queryset, many=True).data
        return Response(data)

class RelatorioResultadoFinanceiroView(BaseReportView):
    """Relatório de Resultado Financeiro (Receitas Pagas - Despesas Pagas) por Período."""
    def get(self, request):
        filters_pagamento = {}
        params = request.query_params
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        if start_date:
            filters_pagamento['data_pagamento__gte'] = start_date
        if end_date:
            filters_pagamento['data_pagamento__lte'] = end_date

        receitas_qs = self.get_company_queryset(Receita).filter(situacao='P', **filters_pagamento)
        despesas_qs = self.get_company_queryset(Despesa).filter(situacao='P', **filters_pagamento)

        total_receitas_pagas = receitas_qs.aggregate(total=Sum('valor_pago'))['total'] or Decimal('0.00')
        total_despesas_pagas = despesas_qs.aggregate(total=Sum('valor_pago'))['total'] or Decimal('0.00')

        resultado = total_receitas_pagas - total_despesas_pagas

        return Response({
            "periodo_inicio": start_date or "Início",
            "periodo_fim": end_date or "Fim",
            "total_receitas_pagas": total_receitas_pagas,
            "total_despesas_pagas": total_despesas_pagas,
            "resultado_financeiro": resultado
        })

class RelatorioResultadoMensalView(BaseReportView):
    """Relatório de Resultado Financeiro Mensal."""
    def get(self, request):
        params = request.query_params
        try:
            year = int(params.get('year', date.today().year))
            month = int(params.get('month', date.today().month))
        except ValueError:
            return Response({"detail": "Ano e/ou mês inválidos."}, status=status.HTTP_400_BAD_REQUEST)

        # Filter by payment date within the specific month/year
        filters_pagamento = {
            'situacao': 'P',
            'data_pagamento__year': year,
            'data_pagamento__month': month
        }

        receitas_qs = self.get_company_queryset(Receita).filter(**filters_pagamento)
        despesas_qs = self.get_company_queryset(Despesa).filter(**filters_pagamento)

        total_receitas_pagas = receitas_qs.aggregate(total=Sum('valor_pago'))['total'] or Decimal('0.00')
        total_despesas_pagas = despesas_qs.aggregate(total=Sum('valor_pago'))['total'] or Decimal('0.00')

        resultado = total_receitas_pagas - total_despesas_pagas

        return Response({
            "mes": month,
            "ano": year,
            "total_receitas_pagas": total_receitas_pagas,
            "total_despesas_pagas": total_despesas_pagas,
            "resultado_mensal": resultado
        })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dre_consolidado(request):
    """
    Retorna a DRE consolidada com Receitas e Despesas agrupadas por tipo.

    Query Parameters:
    - mes: Mês (1-12)
    - ano: Ano (YYYY)

    Retorna:
    {
        "receitas": {
            "fixas": 10000.00,
            "variaveis": 5000.00,
            "estornos": -500.00,
            "total": 14500.00
        },
        "despesas": {
            "fixas": 3000.00,
            "variaveis": 2000.00,
            "comissoes": 1000.00,
            "total": 6000.00
        },
        "resultado": 8500.00
    }
    """

    try:
        # Pegar parâmetros de mês e ano
        mes = request.query_params.get('mes')
        ano = request.query_params.get('ano')

        # Se não tiver mês/ano, usar mês atual
        if not mes or not ano:
            hoje = datetime.now()
            mes = hoje.month
            ano = hoje.year
        else:
            mes = int(mes)
            ano = int(ano)

        # Calcular data de início e fim do mês
        data_inicio = f"{ano}-{str(mes).zfill(2)}-01"
        # Último dia do mês
        if mes == 12:
            data_fim = f"{ano + 1}-01-01"
        else:
            data_fim = f"{ano}-{str(mes + 1).zfill(2)}-01"
        data_fim = (datetime.strptime(data_fim, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

        # Filtrar receitas por período do mês
        receitas = Receita.objects.filter(
            company=request.user.company,
            data_vencimento__gte=data_inicio,
            data_vencimento__lte=data_fim
        )

        # Filtrar despesas por período do mês
        despesas = Despesa.objects.filter(
            company=request.user.company,
            data_vencimento__gte=data_inicio,
            data_vencimento__lte=data_fim
        )

        # Agrupar receitas por tipo
        receitas_fixas = receitas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or 0
        receitas_variaveis = receitas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or 0
        estornos = receitas.filter(tipo='E').aggregate(Sum('valor'))['valor__sum'] or 0

        total_receitas = float(receitas_fixas) + float(receitas_variaveis) + float(estornos)

        # Agrupar despesas por tipo
        despesas_fixas = despesas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or 0
        despesas_variaveis = despesas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or 0
        comissoes = despesas.filter(tipo='C').aggregate(Sum('valor'))['valor__sum'] or 0
        reembolsos = despesas.filter(tipo='R').aggregate(Sum('valor'))['valor__sum'] or 0

        total_despesas = float(despesas_fixas) + float(despesas_variaveis) + float(comissoes) + float(reembolsos)

        # Calcular resultado
        resultado = total_receitas - total_despesas

        # Retornar dados formatados
        return Response({
            'receitas': {
                'fixas': float(receitas_fixas),
                'variaveis': float(receitas_variaveis),
                'estornos': float(estornos),
                'total': total_receitas
            },
            'despesas': {
                'fixas': float(despesas_fixas),
                'variaveis': float(despesas_variaveis),
                'comissoes': float(comissoes),
                'reembolsos': float(reembolsos),
                'total': total_despesas
            },
            'resultado': resultado
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        return Response({'error': 'Erro interno'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def balanco_patrimonial(request):
    """
    Retorna o Fluxo de Caixa Realizado (Regime de Caixa) com dois agrupamentos:
    - Por banco (padrão)
    - Por tipo (Receita Fixa, Despesa Variável, Custódia, etc.)

    Considera TODOS os pagamentos (vinculados ou não a receitas/despesas),
    excluindo apenas transferências entre contas (pois se anulam).

    Query Parameters:
    - mes: Mês (1-12)
    - ano: Ano (YYYY)

    Retorna:
    {
        "entradas": {
            "por_banco": [...],
            "por_tipo": [...],
            "total": 70000.00
        },
        "saidas": {
            "por_banco": [...],
            "por_tipo": [...],
            "total": 40000.00
        },
        "resultado": 30000.00
    }
    """

    try:
        # Pegar parâmetros de mês e ano
        mes = request.query_params.get('mes')
        ano = request.query_params.get('ano')

        # Se não tiver mês/ano, usar mês atual
        if not mes or not ano:
            hoje = datetime.now()
            mes = hoje.month
            ano = hoje.year
        else:
            mes = int(mes)
            ano = int(ano)

        # Calcular data de início e fim do mês
        data_inicio = f"{ano}-{str(mes).zfill(2)}-01"
        if mes == 12:
            data_fim = f"{ano + 1}-01-01"
        else:
            data_fim = f"{ano}-{str(mes + 1).zfill(2)}-01"
        data_fim = (datetime.strptime(data_fim, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

        # Buscar todos os pagamentos do mês, excluindo transferências
        # (Transferências se anulam: saída de uma conta = entrada em outra)
        # Primeiro, obter os IDs dos pagamentos que são transferências
        payment_ids_com_transferencia = Allocation.objects.filter(
            payment__company=request.user.company,
            payment__data_pagamento__gte=data_inicio,
            payment__data_pagamento__lte=data_fim,
            transfer__isnull=False
        ).values_list('payment_id', flat=True)

        # Agora buscar pagamentos excluindo os que são transferências
        pagamentos = Payment.objects.filter(
            company=request.user.company,
            data_pagamento__gte=data_inicio,
            data_pagamento__lte=data_fim
        ).exclude(
            id__in=payment_ids_com_transferencia
        ).select_related('conta_bancaria').prefetch_related('allocations__receita', 'allocations__despesa', 'allocations__custodia')

        # Buscar todas as alocações dos pagamentos do mês (exceto transferências)
        allocations = Allocation.objects.filter(
            payment__company=request.user.company,
            payment__data_pagamento__gte=data_inicio,
            payment__data_pagamento__lte=data_fim,
            transfer__isnull=True
        ).select_related('payment', 'payment__conta_bancaria', 'receita', 'despesa', 'custodia')

        # Dicionários para agrupamentos
        # Por banco
        entradas_por_banco = {}
        saidas_por_banco = {}

        # Por tipo
        entradas_por_tipo = {}
        saidas_por_tipo = {}

        # Mapas de nomes para tipos
        TIPO_RECEITA_MAP = {
            'F': 'Receita Fixa',
            'V': 'Receita Variável',
            'E': 'Estorno',
        }
        TIPO_DESPESA_MAP = {
            'F': 'Despesa Fixa',
            'V': 'Despesa Variável',
            'C': 'Comissionamento',
            'R': 'Reembolso',
        }

        # Processar pagamentos para agrupamento por banco
        for pagamento in pagamentos:
            banco_nome = pagamento.conta_bancaria.nome
            valor = float(pagamento.valor)

            if pagamento.tipo == 'E':  # Entrada
                if banco_nome not in entradas_por_banco:
                    entradas_por_banco[banco_nome] = 0
                entradas_por_banco[banco_nome] += valor
            elif pagamento.tipo == 'S':  # Saída
                if banco_nome not in saidas_por_banco:
                    saidas_por_banco[banco_nome] = 0
                saidas_por_banco[banco_nome] += valor

        # Processar alocações para agrupamento por tipo
        # Rastrear valor total alocado por pagamento
        valor_alocado_por_pagamento = {}  # payment_id -> total alocado

        for allocation in allocations:
            valor = float(allocation.valor)
            tipo_pagamento = allocation.payment.tipo
            pid = allocation.payment.id

            valor_alocado_por_pagamento[pid] = valor_alocado_por_pagamento.get(pid, 0) + valor

            # Determinar tipo
            if allocation.receita:
                tipo_receita = allocation.receita.tipo
                tipo_nome = TIPO_RECEITA_MAP.get(tipo_receita, 'Outro')
            elif allocation.despesa:
                tipo_despesa = allocation.despesa.tipo
                tipo_nome = TIPO_DESPESA_MAP.get(tipo_despesa, 'Outro')
            elif allocation.custodia:
                # Diferenciar custódia por tipo de pagamento (entrada ou saída)
                if tipo_pagamento == 'E':
                    tipo_nome = 'Valores Reembolsados'
                else:
                    tipo_nome = 'Valores Reembolsáveis'
            else:
                # Alocação sem vínculo definido
                tipo_nome = 'Não Alocado'

            # Agrupar por tipo
            if tipo_pagamento == 'E':
                if tipo_nome not in entradas_por_tipo:
                    entradas_por_tipo[tipo_nome] = 0
                entradas_por_tipo[tipo_nome] += valor
            elif tipo_pagamento == 'S':
                if tipo_nome not in saidas_por_tipo:
                    saidas_por_tipo[tipo_nome] = 0
                saidas_por_tipo[tipo_nome] += valor

        # Adicionar pagamentos não alocados (total ou parcialmente)
        for pagamento in pagamentos:
            valor_total = float(pagamento.valor)
            valor_alocado = valor_alocado_por_pagamento.get(pagamento.id, 0)
            valor_nao_alocado = round(valor_total - valor_alocado, 2)

            if valor_nao_alocado > 0:
                tipo_nome = 'Não Alocado'

                if pagamento.tipo == 'E':
                    if tipo_nome not in entradas_por_tipo:
                        entradas_por_tipo[tipo_nome] = 0
                    entradas_por_tipo[tipo_nome] += valor_nao_alocado
                elif pagamento.tipo == 'S':
                    if tipo_nome not in saidas_por_tipo:
                        saidas_por_tipo[tipo_nome] = 0
                    saidas_por_tipo[tipo_nome] += valor_nao_alocado

        # Converter dicionários em listas
        entradas_banco_list = [{"banco": banco, "valor": valor} for banco, valor in entradas_por_banco.items()]
        saidas_banco_list = [{"banco": banco, "valor": valor} for banco, valor in saidas_por_banco.items()]

        # Ordem desejada para entradas e saídas
        ORDEM_ENTRADAS = ['Receita Fixa', 'Receita Variável', 'Valores Reembolsados', 'Estorno', 'Não Alocado']
        ORDEM_SAIDAS = ['Despesa Fixa', 'Despesa Variável', 'Valores Reembolsáveis', 'Comissionamento', 'Reembolso', 'Não Alocado']

        # Ordenar entradas conforme ordem especificada
        entradas_tipo_list = []
        for tipo in ORDEM_ENTRADAS:
            if tipo in entradas_por_tipo:
                entradas_tipo_list.append({"tipo": tipo, "valor": entradas_por_tipo[tipo]})
        # Adicionar tipos não mapeados ao final
        for tipo, valor in entradas_por_tipo.items():
            if tipo not in ORDEM_ENTRADAS:
                entradas_tipo_list.append({"tipo": tipo, "valor": valor})

        # Ordenar saídas conforme ordem especificada
        saidas_tipo_list = []
        for tipo in ORDEM_SAIDAS:
            if tipo in saidas_por_tipo:
                saidas_tipo_list.append({"tipo": tipo, "valor": saidas_por_tipo[tipo]})
        # Adicionar tipos não mapeados ao final
        for tipo, valor in saidas_por_tipo.items():
            if tipo not in ORDEM_SAIDAS:
                saidas_tipo_list.append({"tipo": tipo, "valor": valor})

        # Calcular totais
        total_entradas = sum(entradas_por_banco.values())
        total_saidas = sum(saidas_por_banco.values())
        resultado = total_entradas - total_saidas

        # Retornar dados formatados
        return Response({
            'entradas': {
                'por_banco': entradas_banco_list,
                'por_tipo': entradas_tipo_list,
                'total': total_entradas
            },
            'saidas': {
                'por_banco': saidas_banco_list,
                'por_tipo': saidas_tipo_list,
                'total': total_saidas
            },
            'resultado': resultado
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        return Response({'error': 'Erro interno'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def relatorio_conciliacao_bancaria(request):
    """
    Retorna relatório completo da conciliação bancária mensal.

    Query Parameters:
    - mes: Mês (1-12)
    - ano: Ano (YYYY)
    - conta_bancaria_id: (opcional) ID da conta bancária específica

    Retorna informações detalhadas para o usuário finalizar a conciliação:
    - Resumo geral (totais, percentuais)
    - Lançamentos conciliados e não conciliados
    - Receitas, despesas e custódias vinculadas
    - Saldo inicial e final do mês
    - Diferenças e discrepâncias
    """

    try:
        from decimal import Decimal

        # Pegar parâmetros
        mes = request.query_params.get('mes')
        ano = request.query_params.get('ano')
        conta_bancaria_id = request.query_params.get('conta_bancaria_id')

        # Se não tiver mês/ano, usar mês atual
        if not mes or not ano:
            hoje = datetime.now()
            mes = hoje.month
            ano = hoje.year
        else:
            mes = int(mes)
            ano = int(ano)

        # Calcular data de início e fim do mês
        data_inicio = datetime(ano, mes, 1).date()
        if mes == 12:
            data_fim = datetime(ano + 1, 1, 1).date() - timedelta(days=1)
        else:
            data_fim = datetime(ano, mes + 1, 1).date() - timedelta(days=1)

        # Query base de pagamentos do mês
        pagamentos_query = Payment.objects.filter(
            company=request.user.company,
            data_pagamento__gte=data_inicio,
            data_pagamento__lte=data_fim
        ).select_related('conta_bancaria')

        # Filtrar por conta bancária específica se fornecida
        if conta_bancaria_id:
            pagamentos_query = pagamentos_query.filter(conta_bancaria_id=conta_bancaria_id)

        # Anotar número de alocações e soma dos valores alocados
        from django.db.models import Sum
        pagamentos_query = pagamentos_query.annotate(
            num_allocations=Count('allocations'),
            total_alocado=Sum('allocations__valor')
        )

        pagamentos = list(pagamentos_query)

        # Separar conciliados vs não conciliados
        # Um pagamento está completamente conciliado se a soma das alocações = valor do pagamento
        conciliados = [p for p in pagamentos if p.total_alocado is not None and abs(float(p.total_alocado) - float(p.valor)) < 0.01]
        nao_conciliados = [p for p in pagamentos if p.total_alocado is None or abs(float(p.total_alocado) - float(p.valor)) >= 0.01]

        # Calcular totais
        total_lancamentos = len(pagamentos)
        total_conciliados = len(conciliados)
        total_nao_conciliados = len(nao_conciliados)
        percentual_conciliado = (total_conciliados / total_lancamentos * 100) if total_lancamentos > 0 else 0

        # Valores por tipo
        valor_entradas = sum([float(p.valor) for p in pagamentos if p.tipo == 'E'])
        valor_saidas = sum([float(p.valor) for p in pagamentos if p.tipo == 'S'])
        valor_entradas_conciliadas = sum([float(p.valor) for p in conciliados if p.tipo == 'E'])
        valor_saidas_conciliadas = sum([float(p.valor) for p in conciliados if p.tipo == 'S'])
        valor_entradas_pendentes = sum([float(p.valor) for p in nao_conciliados if p.tipo == 'E'])
        valor_saidas_pendentes = sum([float(p.valor) for p in nao_conciliados if p.tipo == 'S'])

        # Buscar alocações do período para estatísticas detalhadas
        # IMPORTANTE: Buscar alocações de TODOS os pagamentos, não só dos conciliados
        # porque lançamentos pendentes podem ter alocações parciais
        allocations = Allocation.objects.filter(
            payment__in=pagamentos
        ).select_related('payment', 'receita', 'despesa', 'custodia')

        # Estatísticas por tipo de vinculação
        receitas_vinculadas = [a for a in allocations if a.receita is not None]
        despesas_vinculadas = [a for a in allocations if a.despesa is not None]
        custodias_vinculadas = [a for a in allocations if a.custodia is not None]

        total_receitas_vinculadas = sum([float(a.valor) for a in receitas_vinculadas])
        total_despesas_vinculadas = sum([float(a.valor) for a in despesas_vinculadas])
        total_custodias_vinculadas = sum([float(a.valor) for a in custodias_vinculadas])

        # Agrupar por conta bancária
        contas_resumo = {}
        for p in pagamentos:
            banco_nome = p.conta_bancaria.nome
            banco_id = p.conta_bancaria.id

            if banco_id not in contas_resumo:
                contas_resumo[banco_id] = {
                    'id': banco_id,
                    'nome': banco_nome,
                    'total_lancamentos': 0,
                    'conciliados': 0,
                    'pendentes': 0,
                    'entradas': 0,
                    'saidas': 0
                }

            contas_resumo[banco_id]['total_lancamentos'] += 1
            if p.num_allocations > 0:
                contas_resumo[banco_id]['conciliados'] += 1
            else:
                contas_resumo[banco_id]['pendentes'] += 1

            if p.tipo == 'E':
                contas_resumo[banco_id]['entradas'] += float(p.valor)
            else:
                contas_resumo[banco_id]['saidas'] += float(p.valor)

        # Calcular saldo do período
        saldo_periodo = valor_entradas - valor_saidas

        # Formatar lançamentos não conciliados para exibição
        nao_conciliados_detalhes = []
        for p in nao_conciliados[:50]:  # Limitar a 50 para não sobrecarregar
            # Calcular valor já alocado deste pagamento
            p_allocations = [a for a in allocations if a.payment_id == p.id]
            valor_alocado = sum(float(a.valor) for a in p_allocations)
            valor_nao_vinculado = float(p.valor) - valor_alocado

            nao_conciliados_detalhes.append({
                'id': p.id,
                'tipo': 'Entrada' if p.tipo == 'E' else 'Saída',
                'valor': float(p.valor),
                'valor_alocado': round(valor_alocado, 2),
                'valor_nao_vinculado': round(valor_nao_vinculado, 2),
                'data': p.data_pagamento.strftime('%d/%m/%Y'),
                'observacao': p.observacao or '',
                'conta_bancaria': p.conta_bancaria.nome
            })

        # Formatar lançamentos conciliados para exibição (últimos 20)
        conciliados_detalhes = []
        for p in conciliados[-20:]:
            # Buscar alocações deste pagamento
            p_allocations = [a for a in allocations if a.payment_id == p.id]
            vinculos = []

            for a in p_allocations:
                if a.receita:
                    vinculos.append({
                        'tipo': 'Receita',
                        'descricao': f"{a.receita.cliente.nome} - {a.receita.descricao}" if hasattr(a.receita, 'cliente') else a.receita.descricao,
                        'valor': float(a.valor)
                    })
                elif a.despesa:
                    vinculos.append({
                        'tipo': 'Despesa',
                        'descricao': a.despesa.descricao,
                        'valor': float(a.valor)
                    })
                elif a.custodia:
                    vinculos.append({
                        'tipo': 'Custódia',
                        'descricao': a.custodia.descricao,
                        'valor': float(a.valor)
                    })

            conciliados_detalhes.append({
                'id': p.id,
                'tipo': 'Entrada' if p.tipo == 'E' else 'Saída',
                'valor': float(p.valor),
                'data': p.data_pagamento.strftime('%d/%m/%Y'),
                'observacao': p.observacao or '',
                'conta_bancaria': p.conta_bancaria.nome,
                'vinculos': vinculos
            })

        # Status geral da conciliação
        if total_nao_conciliados == 0:
            status_geral = 'Concluída'
            status_cor = 'success'
        elif percentual_conciliado >= 80:
            status_geral = 'Quase Concluída'
            status_cor = 'warning'
        elif percentual_conciliado >= 50:
            status_geral = 'Em Andamento'
            status_cor = 'info'
        else:
            status_geral = 'Pendente'
            status_cor = 'error'

        # Retornar dados completos
        return Response({
            'periodo': {
                'mes': mes,
                'ano': ano,
                'data_inicio': data_inicio.strftime('%d/%m/%Y'),
                'data_fim': data_fim.strftime('%d/%m/%Y')
            },
            'resumo': {
                'total_lancamentos': total_lancamentos,
                'total_conciliados': total_conciliados,
                'total_nao_conciliados': total_nao_conciliados,
                'percentual_conciliado': round(percentual_conciliado, 2),
                'status_geral': status_geral,
                'status_cor': status_cor
            },
            'valores': {
                'total_entradas': round(valor_entradas, 2),
                'total_saidas': round(valor_saidas, 2),
                'saldo_periodo': round(saldo_periodo, 2),
                'entradas_conciliadas': round(valor_entradas_conciliadas, 2),
                'saidas_conciliadas': round(valor_saidas_conciliadas, 2),
                'entradas_pendentes': round(valor_entradas_pendentes, 2),
                'saidas_pendentes': round(valor_saidas_pendentes, 2)
            },
            'vinculacoes': {
                'receitas': {
                    'quantidade': len(receitas_vinculadas),
                    'valor_total': round(total_receitas_vinculadas, 2)
                },
                'despesas': {
                    'quantidade': len(despesas_vinculadas),
                    'valor_total': round(total_despesas_vinculadas, 2)
                },
                'custodias': {
                    'quantidade': len(custodias_vinculadas),
                    'valor_total': round(total_custodias_vinculadas, 2)
                }
            },
            'por_conta': list(contas_resumo.values()),
            'lancamentos_pendentes': nao_conciliados_detalhes,
            'lancamentos_conciliados_recentes': conciliados_detalhes,
            'total_pendentes_exibidos': len(nao_conciliados_detalhes),
            'total_pendentes': total_nao_conciliados
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return Response({'error': f'Erro interno: {str(e)}'}, status=500)
