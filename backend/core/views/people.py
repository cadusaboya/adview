from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from decimal import Decimal
from .mixins import CompanyScopedViewSetMixin
from ..models import Cliente, Funcionario
from ..serializers import ClienteSerializer, FuncionarioSerializer
from ..pagination import DynamicPageSizePagination


class ClienteViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint for Clientes, scoped by company."""
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    pagination_class = DynamicPageSizePagination
    # CompanyScopedViewSetMixin handles permissions and queryset filtering

    def get_queryset(self):
        queryset = super().get_queryset().prefetch_related('formas_cobranca', 'comissoes__funcionario')

        # Search filter
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(cpf__icontains=search) |
                Q(email__icontains=search) |
                Q(telefone__icontains=search)
            )

        return queryset

    @action(detail=False, methods=['post'], url_path='gerar-comissoes')
    def gerar_comissoes(self, request):
        """
        Gera despesas de comissão para o mês/ano especificado.

        POST /api/clientes/gerar-comissoes/
        Body: { "mes": 1-12, "ano": 2024 }
        """
        from ..services.commission import gerar_despesas_comissao

        mes = request.data.get('mes')
        ano = request.data.get('ano')

        if not mes or not ano:
            return Response(
                {'erro': 'Parâmetros "mes" e "ano" são obrigatórios'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            mes = int(mes)
            ano = int(ano)
            if not (1 <= mes <= 12):
                raise ValueError()
        except ValueError:
            return Response(
                {'erro': 'Mês deve ser um número entre 1 e 12'},
                status=status.HTTP_400_BAD_REQUEST
            )

        comissionados_resultado = gerar_despesas_comissao(request.user.company, mes, ano)

        if not comissionados_resultado:
            return Response(
                {'mensagem': f'Nenhuma comissão gerada para {mes}/{ano}'},
                status=status.HTTP_200_OK
            )

        total_comissoes = sum(c['valor'] for c in comissionados_resultado)
        return Response({
            'comissionados': comissionados_resultado,
            'total': total_comissoes,
            'mes': mes,
            'ano': ano
        })

class FuncionarioViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """API endpoint for Funcionarios, scoped by company."""
    queryset = Funcionario.objects.all()
    serializer_class = FuncionarioSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        queryset = super().get_queryset().filter(tipo__in=['F', 'P'])

        # Search filter
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(cpf__icontains=search) |
                Q(email__icontains=search) |
                Q(telefone__icontains=search)
            )

        return queryset
    # CompanyScopedViewSetMixin handles permissions and queryset filtering

class FornecedorViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Funcionario.objects.all()
    serializer_class = FuncionarioSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        queryset = super().get_queryset().filter(tipo='O')

        # Search filter
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(cpf__icontains=search) |
                Q(email__icontains=search) |
                Q(telefone__icontains=search)
            )

        return queryset

class FavorecidoViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Funcionario.objects.all()
    serializer_class = FuncionarioSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        return super().get_queryset().filter(tipo__in=['F', 'P', 'O'])
