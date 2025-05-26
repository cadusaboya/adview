from rest_framework import viewsets, permissions, status, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Sum, Q, F
from django.utils import timezone
from datetime import date
from decimal import Decimal
from .pagination import DynamicPageSizePagination


from .models import Company, CustomUser, Cliente, Funcionario, Receita, Despesa, Payment, ContaBancaria
from .serializers import (
    CompanySerializer, CustomUserSerializer, ClienteSerializer, 
    FuncionarioSerializer, ReceitaSerializer, DespesaSerializer,
    PaymentSerializer, ContaBancariaSerializer
)

# --- Base ViewSet for Company context ---
class CompanyScopedViewSetMixin:
    """Mixin to scope querysets and creation to the user's company."""
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filter queryset to only include objects belonging to the user's company."""
        user = self.request.user
        if user.is_superuser:
            # Superusers can see all companies' data (adjust if needed)
            return self.queryset.all()
        if hasattr(user, 'company') and user.company:
            return self.queryset.filter(company=user.company)
        # If user has no company, they see nothing (or handle as error)
        return self.queryset.none()

    def perform_create(self, serializer):
        """Automatically assign the user's company during creation."""
        user = self.request.user
        if hasattr(user, 'company') and user.company:
            serializer.save(company=user.company)
        elif self.request.data.get('company_id') and user.is_superuser:
             # Allow superuser to specify company
             company = Company.objects.get(pk=self.request.data.get('company_id'))
             serializer.save(company=company)
        else:
            # Handle cases where company cannot be determined (e.g., raise validation error)
            # This depends on specific requirements for users without companies
            # For now, assume authenticated users must have a company unless superuser
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("User must belong to a company to create this object.")

    def get_serializer_context(self):
        """Add request to the serializer context."""
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context

# --- ViewSets ---

class CompanyViewSet(viewsets.ModelViewSet):
    """API endpoint for Companies. Accessible only by superusers for management."""
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    # Typically, only superusers should manage companies
    permission_classes = [permissions.IsAdminUser] 

class CustomUserViewSet(viewsets.ModelViewSet):
    """API endpoint for Users. Allows creation and management within a company context."""
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [permissions.IsAuthenticated] # Start with authenticated, refine later if needed

    def get_queryset(self):
        """Users can see other users in their own company. Superusers see all."""
        user = self.request.user
        if user.is_superuser:
            return CustomUser.objects.all()
        if hasattr(user, 'company') and user.company:
            # Users can see/manage others in the same company
            return CustomUser.objects.filter(company=user.company)
        # Users without a company or not superuser might only see themselves
        # return CustomUser.objects.filter(pk=user.pk) # Or return none()
        return CustomUser.objects.none()

    def perform_create(self, serializer):
        """Assign company based on creating user, allow superuser override."""
        user = self.request.user
        company_id = self.request.data.get('company_id')
        
        target_company = None
        if user.is_superuser and company_id:
            try:
                target_company = Company.objects.get(pk=company_id)
            except Company.DoesNotExist:
                 raise serializers.ValidationError({"company_id": "Invalid company specified."}) 
        elif hasattr(user, 'company') and user.company:
            target_company = user.company
        
        # We must set the company before validating the serializer if it relies on it
        # Or pass it in context. Here, we save with the determined company.
        if target_company:
             serializer.save(company=target_company)
        else:
             # Non-superuser without a company cannot create users for other companies
             # Or maybe allow creating users without company? Depends on rules.
             # For now, assume users must belong to a company if created by non-superuser
             if not user.is_superuser:
                 from rest_framework.exceptions import PermissionDenied
                 raise PermissionDenied("You must belong to a company to create users.")
             else:
                 # Superuser creating user without company
                 serializer.save(company=None)

class ClienteViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint for Clientes, scoped by company."""
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    pagination_class = DynamicPageSizePagination
    # CompanyScopedViewSetMixin handles permissions and queryset filtering

class FuncionarioViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint for Funcionarios, scoped by company."""
    queryset = Funcionario.objects.all()
    serializer_class = FuncionarioSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        return super().get_queryset().filter(tipo__in=['F', 'P'])
    # CompanyScopedViewSetMixin handles permissions and queryset filtering

class FornecedorViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Funcionario.objects.all()
    serializer_class = FuncionarioSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        return super().get_queryset().filter(tipo='O')

class ReceitaViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint for Receitas, scoped by company."""
    queryset = Receita.objects.all()
    serializer_class = ReceitaSerializer
    pagination_class = DynamicPageSizePagination
    # CompanyScopedViewSetMixin handles permissions and queryset filtering

    def get_queryset(self):
        queryset = super().get_queryset()

        situacao = self.request.query_params.getlist('situacao')
        cliente_id = self.request.query_params.get('cliente_id')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if situacao:
            queryset = queryset.filter(situacao__in=situacao)
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)
        if start_date:
            queryset = queryset.filter(data_vencimento__gte=start_date)
        if end_date:
            queryset = queryset.filter(data_vencimento__lte=end_date)

        return queryset



class DespesaViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint for Despesas, scoped by company."""
    queryset = Despesa.objects.all()
    serializer_class = DespesaSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        queryset = super().get_queryset()  # Scoped by company

        params = self.request.query_params

        # 🔥 Filtro por múltiplas situações
        situacoes = params.getlist('situacao')
        if situacoes:
            queryset = queryset.filter(situacao__in=situacoes)

        # 🔸 Filtros adicionais
        responsavel_id = params.get('responsavel_id')
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        tipo = params.get('tipo')

        if responsavel_id:
            queryset = queryset.filter(responsavel_id=responsavel_id)
        if start_date:
            queryset = queryset.filter(data_vencimento__gte=start_date)
        if end_date:
            queryset = queryset.filter(data_vencimento__lte=end_date)
        if tipo:
            queryset = queryset.filter(tipo=tipo)

        return queryset

class PaymentViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint para registrar pagamentos de receitas ou despesas."""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        queryset = super().get_queryset()

        receita_id = self.request.query_params.get('receita')
        despesa_id = self.request.query_params.get('despesa')

        if receita_id:
            queryset = queryset.filter(receita_id=receita_id)

        if despesa_id:
            queryset = queryset.filter(despesa_id=despesa_id)

        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(company=self.request.user.company)
        instance.conta_bancaria.atualizar_saldo()

        if instance.receita:
            instance.receita.atualizar_status()
        else:
            instance.despesa.atualizar_status()

    def perform_update(self, serializer):
        instance = serializer.save()
        instance.conta_bancaria.atualizar_saldo()

        if instance.receita:
            instance.receita.atualizar_status()
        else:
            instance.despesa.atualizar_status()

    def perform_destroy(self, instance):
        conta = instance.conta_bancaria
        receita = instance.receita
        despesa = instance.despesa

        instance.delete()
        conta.atualizar_saldo()

        if receita:
            receita.atualizar_status()
        if despesa:
            despesa.atualizar_status()
        

class ContaBancariaViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint para gerenciar contas bancárias."""
    queryset = ContaBancaria.objects.all()
    serializer_class = ContaBancariaSerializer
    pagination_class = DynamicPageSizePagination


# --- Report Views (Placeholder - Step 7 will detail these) ---
# These will likely be separate APIView or function-based views, not ViewSets

# Example structure (to be implemented in Step 7)
# class RelatorioClienteView(generics.ListAPIView):
#     permission_classes = [permissions.IsAuthenticated]
#     serializer_class = ReceitaSerializer # Or a custom report serializer
# 
#     def get_queryset(self):
#         user = self.request.user
#         cliente_id = self.kwargs.get('cliente_id') # Get from URL
#         # ... filter Receitas for this cliente_id and user's company ...
#         pass





# --- Report Views ---
from rest_framework.views import APIView
from django.db.models.functions import TruncMonth

class BaseReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_company_queryset(self, model):
        user = self.request.user
        if user.is_superuser:
            return model.objects.all()
        if hasattr(user, 'company') and user.company:
            return model.objects.filter(company=user.company)
        return model.objects.none()

    def get_common_filters(self):
        params = self.request.query_params
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        filters = {}
        if start_date:
            filters['data_vencimento__gte'] = start_date
        if end_date:
            filters['data_vencimento__lte'] = end_date
        return filters

class RelatorioClienteView(BaseReportView):
    """Relatório de Receitas Pagas e a Pagar por Cliente."""
    def get(self, request, cliente_id):
        cliente_qs = self.get_company_queryset(Cliente)
        try:
            cliente = cliente_qs.get(pk=cliente_id)
        except Cliente.DoesNotExist:
            return Response({"detail": "Cliente not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        receitas_qs = self.get_company_queryset(Receita).filter(cliente=cliente)
        
        filters = self.get_common_filters() # Apply date filters if provided
        receitas_qs = receitas_qs.filter(**filters)

        pagas = ReceitaSerializer(receitas_qs.filter(situacao='P'), many=True).data
        a_pagar = ReceitaSerializer(receitas_qs.filter(situacao__in=['A', 'V']), many=True).data # Em Aberto ou Vencida

        return Response({
            "cliente": ClienteSerializer(cliente).data,
            "receitas_pagas": pagas,
            "receitas_a_pagar": a_pagar
        })

class RelatorioFuncionarioView(BaseReportView):
    """Relatório de Despesas Pagas e a Pagar por Funcionário/Responsável."""
    def get(self, request, funcionario_id):
        func_qs = self.get_company_queryset(Funcionario)
        try:
            funcionario = func_qs.get(pk=funcionario_id)
        except Funcionario.DoesNotExist:
            return Response({"detail": "Funcionário not found or access denied."}, status=status.HTTP_404_NOT_FOUND)

        despesas_qs = self.get_company_queryset(Despesa).filter(responsavel=funcionario)
        
        filters = self.get_common_filters() # Apply date filters if provided
        despesas_qs = despesas_qs.filter(**filters)

        pagas = DespesaSerializer(despesas_qs.filter(situacao='P'), many=True).data
        a_pagar = DespesaSerializer(despesas_qs.filter(situacao__in=['A', 'V']), many=True).data

        return Response({
            "funcionario": FuncionarioSerializer(funcionario).data,
            "despesas_pagas": pagas,
            "despesas_a_pagar": a_pagar
        })

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


