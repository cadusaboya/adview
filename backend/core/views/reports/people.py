from rest_framework.response import Response
from rest_framework import status
from django.db.models import Sum, Q
from django.shortcuts import get_object_or_404
from decimal import Decimal
from datetime import date
from .base import BaseReportView
from ...models import Cliente, Funcionario, Receita, Despesa, Allocation, Custodia
from ...serializers import ClienteSerializer, FuncionarioSerializer, AllocationSerializer


class RelatorioClienteView(BaseReportView):
    """
    Resumo financeiro do cliente baseado em ALLOCATIONS (fonte da verdade)
    """

    def get(self, request, cliente_id):
        # Cliente (com escopo da empresa)
        cliente_qs = self.get_company_queryset(Cliente)
        cliente = get_object_or_404(cliente_qs, pk=cliente_id)

        # Receitas do cliente
        receitas_qs = self.get_company_queryset(Receita).filter(
            cliente=cliente
        )

        # Allocations ligadas às receitas do cliente
        # Apenas receitas pagas - valores que recebemos do cliente
        allocations_qs = self.get_company_queryset(Allocation).filter(
            receita__cliente=cliente
        ).select_related('payment')

        # Filtros comuns (data inicial / final, etc)
        filters = self.get_common_filters()
        if filters:
            receitas_qs = receitas_qs.filter(**filters)
            # Para filtros de data em allocations, usar payment__data_pagamento
            if 'data_vencimento__gte' in filters:
                allocations_qs = allocations_qs.filter(
                    payment__data_pagamento__gte=filters['data_vencimento__gte']
                )
            if 'data_vencimento__lte' in filters:
                allocations_qs = allocations_qs.filter(
                    payment__data_pagamento__lte=filters['data_vencimento__lte']
                )

        # Soma das allocations por receita
        allocations_por_receita = (
            allocations_qs
            .values("receita_id")
            .annotate(total_pago=Sum("valor"))
        )

        allocations_map = {
            item["receita_id"]: item["total_pago"] or 0
            for item in allocations_por_receita
        }

        # Pendências reais (saldo > 0)
        pendings = []
        total_open = 0

        for receita in receitas_qs:
            total_pago = allocations_map.get(receita.id, 0)
            saldo = receita.valor - total_pago

            if saldo > 0:
                pendings.append({
                    "id": receita.id,
                    "nome": receita.nome,
                    "description": receita.descricao,
                    "valor_total": receita.valor,
                    "valor_pago": total_pago,
                    "saldo": saldo,
                    "due_date": receita.data_vencimento,
                })
                total_open += saldo

        # Allocations realizadas (histórico)
        allocations = AllocationSerializer(
            allocations_qs.order_by("-payment__data_pagamento"),
            many=True
        ).data

        # Total pago
        total_paid = allocations_qs.aggregate(
            total=Sum("valor")
        )["total"] or 0

        # Custódias do cliente (Passivos - valores que devemos ao cliente)
        custodias_qs = self.get_company_queryset(Custodia).filter(
            cliente=cliente,
            tipo='P'  # Passivos - valores a pagar
        ).exclude(status='L')

        custodias_a_pagar = []
        total_custodia_pagar = 0

        for custodia in custodias_qs:
            saldo = custodia.valor_total - custodia.valor_liquidado
            if saldo > 0:
                custodias_a_pagar.append({
                    "id": custodia.id,
                    "nome": custodia.nome,
                    "descricao": custodia.descricao,
                    "valor_total": custodia.valor_total,
                    "valor_liquidado": custodia.valor_liquidado,
                    "saldo": saldo,
                    "status": custodia.status,
                })
                total_custodia_pagar += saldo

        return Response({
            "client": ClienteSerializer(cliente).data,
            "pendings": pendings,
            "allocations": allocations,
            "custodias_a_pagar": custodias_a_pagar,
            "totals": {
                "open": total_open,
                "paid": total_paid,
                "custodia_pagar": total_custodia_pagar,
            }
        }, status=status.HTTP_200_OK)


class RelatorioFuncionarioView(BaseReportView):
    """
    Resumo financeiro do funcionário baseado em ALLOCATIONS (fonte da verdade)
    """

    def get(self, request, funcionario_id):
        # Funcionário (escopo da empresa)
        funcionario_qs = self.get_company_queryset(Funcionario)
        funcionario = get_object_or_404(funcionario_qs, pk=funcionario_id)

        # Despesas do funcionário
        despesas_qs = self.get_company_queryset(Despesa).filter(
            responsavel=funcionario
        )

        # Allocations ligadas às despesas e custódias do funcionário
        # Custódias Passivas com saída (tipo='P' + payment tipo='S') = repasses ao funcionário
        # Custódias Ativas com saída (tipo='A' + payment tipo='S') = pagamentos em nome do funcionário
        allocations_qs = self.get_company_queryset(Allocation).filter(
            Q(despesa__responsavel=funcionario) |
            Q(custodia__funcionario=funcionario, custodia__tipo='P', payment__tipo='S') |
            Q(custodia__funcionario=funcionario, custodia__tipo='A', payment__tipo='S')
        ).select_related('payment')

        # Filtros comuns (data inicial / final, etc)
        filters = self.get_common_filters()
        if filters:
            despesas_qs = despesas_qs.filter(**filters)
            # Para filtros de data em allocations, usar payment__data_pagamento
            if 'data_vencimento__gte' in filters:
                allocations_qs = allocations_qs.filter(
                    payment__data_pagamento__gte=filters['data_vencimento__gte']
                )
            if 'data_vencimento__lte' in filters:
                allocations_qs = allocations_qs.filter(
                    payment__data_pagamento__lte=filters['data_vencimento__lte']
                )

        # Soma das allocations por despesa
        allocations_por_despesa = (
            allocations_qs
            .values("despesa_id")
            .annotate(total_pago=Sum("valor"))
        )

        allocations_map = {
            item["despesa_id"]: item["total_pago"] or 0
            for item in allocations_por_despesa
        }

        # Pendências reais (saldo > 0)
        pendings = []
        total_open = 0

        # Despesas pendentes
        for despesa in despesas_qs:
            total_pago = allocations_map.get(despesa.id, 0)
            saldo = despesa.valor - total_pago

            if saldo > 0:
                pendings.append({
                    "id": despesa.id,
                    "nome": despesa.nome,
                    "description": despesa.descricao,
                    "valor_total": despesa.valor,
                    "valor_pago": total_pago,
                    "saldo": saldo,
                    "due_date": despesa.data_vencimento,
                })
                total_open += saldo

        # Custódias Passivas pendentes (não repassadas ao funcionário)
        custodias_passivas_qs = self.get_company_queryset(Custodia).filter(
            funcionario=funcionario,
            tipo='P'
        ).exclude(status='L')

        for custodia in custodias_passivas_qs:
            saldo = custodia.valor_total - custodia.valor_liquidado
            if saldo > 0:
                pendings.append({
                    "id": f"custodia-{custodia.id}",
                    "nome": custodia.nome,
                    "description": custodia.descricao,
                    "valor_total": custodia.valor_total,
                    "valor_pago": custodia.valor_liquidado,
                    "saldo": saldo,
                    "due_date": None,
                })
                total_open += saldo

        # Allocations realizadas (histórico)
        allocations = AllocationSerializer(
            allocations_qs.order_by("-payment__data_pagamento"),
            many=True
        ).data

        # Total pago
        total_paid = allocations_qs.aggregate(
            total=Sum("valor")
        )["total"] or 0

        # Custódias do funcionário
        custodias_qs = self.get_company_queryset(Custodia).filter(
            funcionario=funcionario
        )

        # Custódias a Pagar (Passivos - valores que devemos ao funcionário)
        custodias_a_pagar = []
        total_custodia_pagar = 0

        for custodia in custodias_qs.filter(tipo='P').exclude(status='L'):
            saldo = custodia.valor_total - custodia.valor_liquidado
            if saldo > 0:
                custodias_a_pagar.append({
                    "id": custodia.id,
                    "nome": custodia.nome,
                    "descricao": custodia.descricao,
                    "valor_total": custodia.valor_total,
                    "valor_liquidado": custodia.valor_liquidado,
                    "saldo": saldo,
                    "status": custodia.status,
                })
                total_custodia_pagar += saldo

        # Custódias a Receber (Ativos - valores que o funcionário nos deve)
        custodias_a_receber = []
        total_custodia_receber = 0

        for custodia in custodias_qs.filter(tipo='A').exclude(status='L'):
            saldo = custodia.valor_total - custodia.valor_liquidado
            if saldo > 0:
                custodias_a_receber.append({
                    "id": custodia.id,
                    "nome": custodia.nome,
                    "descricao": custodia.descricao,
                    "valor_total": custodia.valor_total,
                    "valor_liquidado": custodia.valor_liquidado,
                    "saldo": saldo,
                    "status": custodia.status,
                })
                total_custodia_receber += saldo

        return Response({
            "funcionario": FuncionarioSerializer(funcionario).data,
            "pendings": pendings,
            "allocations": allocations,
            "custodias_a_pagar": custodias_a_pagar,
            "custodias_a_receber": custodias_a_receber,
            "totals": {
                "open": total_open,
                "paid": total_paid,
                "custodia_pagar": total_custodia_pagar,
                "custodia_receber": total_custodia_receber,
            }
        }, status=status.HTTP_200_OK)


class RelatorioFolhaSalarialView(BaseReportView):
    """Relatório de Folha Salarial Mensal."""
    def get(self, request):
        params = request.query_params
        try:
            year = int(params.get('year', date.today().year))
            month = int(params.get('month', date.today().month))
            target_date = date(year, month, 1)
        except ValueError:
            return Response({"detail": "Ano e/ou mês inválidos."}, status=status.HTTP_400_BAD_REQUEST)

        # Sum of salaries for active 'Funcionário' type employees in the company
        funcionarios_ativos = self.get_company_queryset(Funcionario).filter(tipo='F', salario_mensal__isnull=False)
        total_salarios_base = funcionarios_ativos.aggregate(total=Sum('salario_mensal'))['total'] or Decimal('0.00')

        # Sum of fixed expenses ('F') linked to 'Funcionário' type employees due in the given month/year
        # This interpretation might need refinement based on exact business logic for fixed expenses
        despesas_fixas_func = self.get_company_queryset(Despesa).filter(
            responsavel__tipo='F',
            tipo='F',
            data_vencimento__year=year,
            data_vencimento__month=month
        )
        total_despesas_fixas_func = despesas_fixas_func.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        # Note: This is a simplified view. Real payroll involves taxes, benefits, etc.
        # It also assumes 'salario_mensal' is the gross amount and fixed expenses are additional costs.
        # Clarification might be needed on how 'Despesa Fixa' relates to 'Salário Mensal'.
        # Assuming here they are separate concepts unless explicitly linked.

        return Response({
            "mes": month,
            "ano": year,
            "total_salarios_base": total_salarios_base,
            "total_despesas_fixas_funcionarios (vencimento no mês)": total_despesas_fixas_func,
            "custo_total_estimado_folha": total_salarios_base + total_despesas_fixas_func # Example calculation
        })

class RelatorioComissionamentoView(BaseReportView):
    """Relatório de Comissionamento por Mês por Pessoa ou Todos."""
    def get(self, request):
        params = request.query_params
        try:
            year = int(params.get('year', date.today().year))
            month = int(params.get('month', date.today().month))
        except ValueError:
            return Response({"detail": "Ano e/ou mês inválidos."}, status=status.HTTP_400_BAD_REQUEST)

        funcionario_id = params.get('funcionario_id')

        # Filter commission expenses ('C') paid in the given month/year
        despesas_comissao_qs = self.get_company_queryset(Despesa).filter(
            tipo='C',
            # Assuming commission is relevant based on when the *expense* is paid
            # Or should it be based on when the *receita* was paid?
            # Model currently creates commission expense when receita is paid, due immediately.
            # Let's filter by expense payment date for simplicity.
            situacao='P',
            data_pagamento__year=year,
            data_pagamento__month=month
        )

        if funcionario_id:
            despesas_comissao_qs = despesas_comissao_qs.filter(responsavel_id=funcionario_id)
            total_comissao = despesas_comissao_qs.aggregate(total=Sum('valor_pago'))['total'] or Decimal('0.00')
            try:
                funcionario = self.get_company_queryset(Funcionario).get(pk=funcionario_id)
                responsavel_nome = funcionario.nome
            except Funcionario.DoesNotExist:
                responsavel_nome = f"ID {funcionario_id} (Não encontrado)"

            return Response({
                "mes": month,
                "ano": year,
                "funcionario_id": funcionario_id,
                "responsavel_nome": responsavel_nome,
                "total_comissao_paga": total_comissao
            })
        else:
            # Group by responsible person (Funcionario)
            comissao_por_pessoa = despesas_comissao_qs.values('responsavel__id', 'responsavel__nome')\
                                   .annotate(total_pago=Sum('valor_pago'))\
                                   .order_by('responsavel__nome')

            return Response({
                "mes": month,
                "ano": year,
                "comissao_por_pessoa": list(comissao_por_pessoa) # Convert queryset to list for response
            })
