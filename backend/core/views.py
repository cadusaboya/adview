from rest_framework import viewsets, permissions, status, generics
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Sum, Q, F, Case, When, IntegerField
from django.utils import timezone
from django.utils.timezone import now
from datetime import date, datetime, timedelta
from decimal import Decimal
from .pagination import DynamicPageSizePagination
from django.shortcuts import get_object_or_404
from .models import Company, CustomUser, Cliente, Funcionario, Receita, Despesa, Payment, ContaBancaria
from .serializers import (
    CompanySerializer, CustomUserSerializer, ClienteSerializer, 
    FuncionarioSerializer, ReceitaSerializer, ReceitaAbertaSerializer, DespesaSerializer, DespesaAbertaSerializer,
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

class FavorecidoViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Funcionario.objects.all()
    serializer_class = FuncionarioSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        return super().get_queryset().filter(tipo__in=['F', 'P', 'O'])


from django.db.models import Q
from django.utils.timezone import now

class ReceitaViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Receita.objects.all()
    serializer_class = ReceitaSerializer
    pagination_class = DynamicPageSizePagination

    # 🔥 LAZY UPDATE — ISSO ESTAVA FALTANDO
    hoje = timezone.now().date()
    Receita.objects.filter(
            situacao='A',
            data_vencimento__lt=hoje
        ).update(situacao='V')

    def get_serializer_class(self):
        situacoes = self.request.query_params.getlist("situacao")

        # 🔹 Receitas em aberto → serializer com saldo
        if situacoes and set(situacoes).issubset({"A", "V"}):
            return ReceitaAbertaSerializer

        return ReceitaSerializer

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            "cliente", "company"
        ).prefetch_related(
            "payments"
        )

        params = self.request.query_params

        # 🔎 FILTRO GLOBAL
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(descricao__icontains=search) |
                Q(cliente__nome__icontains=search) |
                Q(valor__icontains=search) |
                Q(data_vencimento__icontains=search)
            )

        # 🔸 filtros
        situacoes = params.getlist("situacao")
        if situacoes:
            queryset = queryset.filter(situacao__in=situacoes)

        cliente_id = params.get("cliente_id")
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)

        start_date = params.get("start_date")
        end_date = params.get("end_date")

        if start_date:
            queryset = queryset.filter(data_vencimento__gte=start_date)
        if end_date:
            queryset = queryset.filter(data_vencimento__lte=end_date)

        # 🔥 ORDENAÇÃO
        if situacoes and set(situacoes).issubset({"P", "V"}):
            queryset = queryset.order_by("-data_pagamento", "-data_vencimento")
        else:
            queryset = queryset.order_by("data_vencimento")

        return queryset


from django.utils import timezone

class DespesaViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Despesa.objects.all()
    serializer_class = DespesaSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        hoje = timezone.now().date()

        # 🔥 LAZY UPDATE — ISSO ESTAVA FALTANDO
        hoje = timezone.now().date()
        Despesa.objects.filter(
            situacao='A',
            data_vencimento__lt=hoje
        ).update(situacao='V')

        queryset = super().get_queryset().select_related(
            "responsavel", "company"
        ).prefetch_related(
            "payments"
        )

        params = self.request.query_params

        # 🔎 BUSCA
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(descricao__icontains=search) |
                Q(responsavel__nome__icontains=search) |
                Q(valor__icontains=search) |
                Q(data_vencimento__icontains=search)
            )

        # 🔸 filtros
        situacoes = params.getlist("situacao")
        if situacoes:
            queryset = queryset.filter(situacao__in=situacoes)

        responsavel_id = params.get("responsavel_id")
        if responsavel_id:
            queryset = queryset.filter(responsavel_id=responsavel_id)

        start_date = params.get("start_date")
        end_date = params.get("end_date")

        if start_date:
            queryset = queryset.filter(data_vencimento__gte=start_date)
        if end_date:
            queryset = queryset.filter(data_vencimento__lte=end_date)

        # 🔥 ORDENAÇÃO
        if situacoes and set(situacoes).issubset({"P", "V"}):
            queryset = queryset.order_by("-data_pagamento", "-data_vencimento")
        else:
            queryset = queryset.order_by("data_vencimento")

        return queryset




from django.db.models import Q
from rest_framework import viewsets

class PaymentViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint para registrar pagamentos de receitas ou despesas."""
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params

        receita_id = params.get('receita')
        despesa_id = params.get('despesa')
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        search = params.get('search')

        # 🔥 FILTRO EXPLÍCITO DE TIPO (ESSENCIAL)
        tipo = params.get('tipo')  # 'receita' | 'despesa'
        if tipo == 'despesa':
            queryset = queryset.filter(despesa__isnull=False)
        elif tipo == 'receita':
            queryset = queryset.filter(receita__isnull=False)

        # 🔹 Filtros diretos
        if receita_id:
            queryset = queryset.filter(receita_id=receita_id)

        if despesa_id:
            queryset = queryset.filter(despesa_id=despesa_id)

        if start_date:
            queryset = queryset.filter(data_pagamento__gte=start_date)

        if end_date:
            queryset = queryset.filter(data_pagamento__lte=end_date)

        # 🔍 SEARCH GLOBAL
        if search:
            queryset = queryset.filter(
                Q(valor__icontains=search) |
                Q(observacao__icontains=search) |
                Q(data_pagamento__icontains=search) |
                Q(receita__nome__icontains=search) |
                Q(receita__cliente__nome__icontains=search) |
                Q(despesa__nome__icontains=search) |
                Q(despesa__responsavel__nome__icontains=search)
            )

        # 📌 Ordenação estável (ESSENCIAL para paginação)
        return queryset.order_by('-data_pagamento', '-id')

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

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum, Q, F
from django.utils import timezone
from datetime import timedelta, date
from decimal import Decimal
from .models import (
    Company, CustomUser, Cliente, Funcionario, Receita, Despesa, 
    Payment, ContaBancaria
)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_view(request):
    """
    Retorna dados consolidados do dashboard para o usuário autenticado.
    (Alinhado ao modelo financeiro do sistema: Payment = fonte da verdade)
    """
    user = request.user
    company = user.company

    hoje = timezone.now().date()
    inicio_mes = date(hoje.year, hoje.month, 1)
    
    # Data de 30 dias atrás
    data_30_dias_atras = hoje - timedelta(days=30)
    
    # ======================================================
    # 💰 FLUXO DE CAIXA REALIZADO (ÚLTIMOS 30 DIAS)
    # ======================================================
    
    # Receitas dos últimos 30 dias (dinheiro que entrou)
    receitas_30_dias = (
        Payment.objects.filter(
            company=company,
            receita__isnull=False,
            data_pagamento__gte=data_30_dias_atras,
            data_pagamento__lte=hoje
        )
        .aggregate(total=Sum('valor'))['total']
        or Decimal('0.00')
    )
    
    # Despesas dos últimos 30 dias (dinheiro que saiu)
    despesas_30_dias = (
        Payment.objects.filter(
            company=company,
            despesa__isnull=False,
            data_pagamento__gte=data_30_dias_atras,
            data_pagamento__lte=hoje
        )
        .aggregate(total=Sum('valor'))['total']
        or Decimal('0.00')
    )
    
    # Fluxo de caixa realizado (o que entrou - o que saiu)
    fluxo_caixa_realizado = receitas_30_dias - despesas_30_dias

    # ======================================================
    # 🏦 SALDO TOTAL DAS CONTAS
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
    # 📊 RECEITAS PROJETADAS (PRÓXIMOS 30 DIAS)
    # ======================================================
    
    data_limite = hoje + timedelta(days=30)
    
    receitas_projetadas = (
        Receita.objects.filter(
            company=company,
            data_vencimento__gte=hoje,
            data_vencimento__lte=data_limite,
            situacao__in=['A', 'V']  # Não paga ainda
        )
        .aggregate(total=Sum('valor'))['total']
        or Decimal('0.00')
    )
    
    # ======================================================
    # 📊 DESPESAS PROJETADAS (PRÓXIMOS 30 DIAS)
    # ======================================================
    
    despesas_projetadas = (
        Despesa.objects.filter(
            company=company,
            data_vencimento__gte=hoje,
            data_vencimento__lte=data_limite,
            situacao__in=['A', 'V']  # Não paga ainda
        )
        .aggregate(total=Sum('valor'))['total']
        or Decimal('0.00')
    )

    # ======================================================
    # 🎂 ANIVERSARIANTES DO DIA
    # ======================================================
    
    hoje_mes_dia = hoje.strftime('%m-%d')
    
    # Clientes aniversariantes
    clientes_aniversariantes = Cliente.objects.filter(
        company=company,
        aniversario__isnull=False,
        aniversario__month=hoje.month,      # ← Novo
        aniversario__day=hoje.day            # ← Novo
    )

    # Funcionários aniversariantes
    funcionarios_aniversariantes = Funcionario.objects.filter(
        company=company,
        aniversario__isnull=False,
        aniversario__month=hoje.month,      # ← Novo
        aniversario__day=hoje.day            # ← Novo
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
    # 🚨 ALERTAS OPERACIONAIS (VENCIDAS)
    # ======================================================

    despesas_vencidas = Despesa.objects.filter(
        company=company,
        situacao='V'
    ).count()

    receitas_vencidas = Receita.objects.filter(
        company=company,
        situacao='V'
    ).count()

    # ======================================================
    # 📊 GRÁFICO RECEITA x DESPESA (ÚLTIMOS 6 MESES - REALIZADO)
    # ======================================================

    meses_data = []

    for i in range(5, -1, -1):
        ref = inicio_mes - timedelta(days=30 * i)
        mes_inicio = ref.replace(day=1)
        mes_fim = (mes_inicio.replace(day=28) + timedelta(days=4)).replace(
            day=1
        ) - timedelta(days=1)

        receita = (
            Payment.objects.filter(
                company=company,
                receita__isnull=False,
                data_pagamento__gte=mes_inicio,
                data_pagamento__lte=mes_fim
            )
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        despesa = (
            Payment.objects.filter(
                company=company,
                despesa__isnull=False,
                data_pagamento__gte=mes_inicio,
                data_pagamento__lte=mes_fim
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
    # 📊 GRÁFICO FLUXO DE CAIXA REALIZADO (ÚLTIMOS 6 MESES)
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
                receita__isnull=False,
                data_pagamento__gte=mes_inicio,
                data_pagamento__lte=mes_fim
            )
            .aggregate(total=Sum('valor'))['total']
            or Decimal('0.00')
        )

        despesa_mes = (
            Payment.objects.filter(
                company=company,
                despesa__isnull=False,
                data_pagamento__gte=mes_inicio,
                data_pagamento__lte=mes_fim
            )
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
    # 🍰 RECEITA / DESPESA POR TIPO (PAGO)
    # ======================================================

    receita_por_tipo = []
    for tipo, label in Receita.TIPO_CHOICES:
        total = (
            Payment.objects.filter(
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
            Payment.objects.filter(
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
    # ⏰ PRÓXIMOS VENCIMENTOS
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
    # 📦 RESPONSE
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
    """
    Resumo financeiro do cliente baseado em PAYMENTS (fonte da verdade)
    """

    def get(self, request, cliente_id):
        # 🔹 Cliente (com escopo da empresa)
        cliente_qs = self.get_company_queryset(Cliente)
        cliente = get_object_or_404(cliente_qs, pk=cliente_id)

        # 🔹 Receitas do cliente
        receitas_qs = self.get_company_queryset(Receita).filter(
            cliente=cliente
        )

        # 🔹 Payments ligados às receitas do cliente
        payments_qs = self.get_company_queryset(Payment).filter(
            receita__cliente=cliente
        )

        # 🔹 Filtros comuns (data inicial / final, etc)
        filters = self.get_common_filters()
        if filters:
            receitas_qs = receitas_qs.filter(**filters)
            payments_qs = payments_qs.filter(**filters)

        # 🔹 Soma dos payments por receita
        payments_por_receita = (
            payments_qs
            .values("receita_id")
            .annotate(total_pago=Sum("valor"))
        )

        payments_map = {
            item["receita_id"]: item["total_pago"] or 0
            for item in payments_por_receita
        }

        # 🔹 Pendências reais (saldo > 0)
        pendings = []
        total_open = 0

        for receita in receitas_qs:
            total_pago = payments_map.get(receita.id, 0)
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

        # 🔹 Payments realizados (histórico)
        payments = PaymentSerializer(
            payments_qs.order_by("-data_pagamento"),
            many=True
        ).data

        # 🔹 Total pago
        total_paid = payments_qs.aggregate(
            total=Sum("valor")
        )["total"] or 0

        return Response({
            "client": ClienteSerializer(cliente).data,
            "pendings": pendings,
            "payments": payments,
            "totals": {
                "open": total_open,
                "paid": total_paid,
            }
        }, status=status.HTTP_200_OK)

from rest_framework.response import Response
from rest_framework import status

from decimal import Decimal
from rest_framework.response import Response
from rest_framework import status

class RelatorioFuncionarioView(BaseReportView):
    """
    Resumo financeiro do funcionário baseado em PAYMENTS (fonte da verdade)
    """

    def get(self, request, funcionario_id):
        # 🔹 Funcionário (escopo da empresa)
        funcionario_qs = self.get_company_queryset(Funcionario)
        funcionario = get_object_or_404(funcionario_qs, pk=funcionario_id)

        # 🔹 Despesas do funcionário
        despesas_qs = self.get_company_queryset(Despesa).filter(
            responsavel=funcionario
        )

        # 🔹 Payments ligados às despesas do funcionário
        payments_qs = self.get_company_queryset(Payment).filter(
            despesa__responsavel=funcionario
        )

        # 🔹 Filtros comuns (data inicial / final, etc)
        filters = self.get_common_filters()
        if filters:
            despesas_qs = despesas_qs.filter(**filters)
            payments_qs = payments_qs.filter(**filters)

        # 🔹 Soma dos payments por despesa
        payments_por_despesa = (
            payments_qs
            .values("despesa_id")
            .annotate(total_pago=Sum("valor"))
        )

        payments_map = {
            item["despesa_id"]: item["total_pago"] or 0
            for item in payments_por_despesa
        }

        # 🔹 Pendências reais (saldo > 0)
        pendings = []
        total_open = 0

        for despesa in despesas_qs:
            total_pago = payments_map.get(despesa.id, 0)
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

        # 🔹 Payments realizados (histórico)
        payments = PaymentSerializer(
            payments_qs.order_by("-data_pagamento"),
            many=True
        ).data

        # 🔹 Total pago
        total_paid = payments_qs.aggregate(
            total=Sum("valor")
        )["total"] or 0

        return Response({
            "funcionario": FuncionarioSerializer(funcionario).data,
            "pendings": pendings,
            "payments": payments,
            "totals": {
                "open": total_open,
                "paid": total_paid,
            }
        }, status=status.HTTP_200_OK)



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
        # 🔹 Pegar parâmetros de mês e ano
        mes = request.query_params.get('mes')
        ano = request.query_params.get('ano')
        
        # 🔹 Se não tiver mês/ano, usar mês atual
        if not mes or not ano:
            hoje = datetime.now()
            mes = hoje.month
            ano = hoje.year
        else:
            mes = int(mes)
            ano = int(ano)
        
        # 🔹 Calcular data de início e fim do mês
        data_inicio = f"{ano}-{str(mes).zfill(2)}-01"
        # Último dia do mês
        if mes == 12:
            data_fim = f"{ano + 1}-01-01"
        else:
            data_fim = f"{ano}-{str(mes + 1).zfill(2)}-01"
        data_fim = (datetime.strptime(data_fim, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # 🔹 Filtrar receitas por período do mês
        receitas = Receita.objects.filter(
            company=request.user.company,
            data_vencimento__gte=data_inicio,
            data_vencimento__lte=data_fim
        )
        
        # 🔹 Filtrar despesas por período do mês
        despesas = Despesa.objects.filter(
            company=request.user.company,
            data_vencimento__gte=data_inicio,
            data_vencimento__lte=data_fim
        )
        
        # 🔹 Agrupar receitas por tipo
        receitas_fixas = receitas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or 0
        receitas_variaveis = receitas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or 0
        estornos = receitas.filter(tipo='E').aggregate(Sum('valor'))['valor__sum'] or 0
        
        total_receitas = float(receitas_fixas) + float(receitas_variaveis) + float(estornos)
        
        # 🔹 Agrupar despesas por tipo
        despesas_fixas = despesas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or 0
        despesas_variaveis = despesas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or 0
        comissoes = despesas.filter(tipo='C').aggregate(Sum('valor'))['valor__sum'] or 0
        
        total_despesas = float(despesas_fixas) + float(despesas_variaveis) + float(comissoes)
        
        # 🔹 Calcular resultado
        resultado = total_receitas - total_despesas
        
        # 🔹 Retornar dados formatados
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
                'total': total_despesas
            },
            'resultado': resultado
        }, status=status.HTTP_200_OK)
    
    except ValueError as e:
        return Response({'error': str(e)}, status=400)
    except Exception as e:
        return Response({'error': 'Erro interno'}, status=500)



