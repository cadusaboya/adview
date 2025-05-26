from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet, CustomUserViewSet, ClienteViewSet, 
    FuncionarioViewSet, ReceitaViewSet, DespesaViewSet,
    FornecedorViewSet,
    # Import Report Views
    RelatorioClienteView, RelatorioFuncionarioView, RelatorioTipoPeriodoView,
    RelatorioResultadoFinanceiroView, RelatorioFolhaSalarialView,
    RelatorioComissionamentoView, RelatorioResultadoMensalView
)

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'users', CustomUserViewSet, basename='customuser')
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'funcionarios', FuncionarioViewSet, basename='funcionario')
router.register(r'receitas', ReceitaViewSet, basename='receita')
router.register(r'despesas', DespesaViewSet, basename='despesa')
router.register(r'fornecedores', FornecedorViewSet, basename='Fornecedor')

# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('', include(router.urls)),
    # Report URLs
    path('relatorios/cliente/<int:cliente_id>/', RelatorioClienteView.as_view(), name='relatorio-cliente'),
    path('relatorios/funcionario/<int:funcionario_id>/', RelatorioFuncionarioView.as_view(), name='relatorio-funcionario'),
    path('relatorios/tipo-periodo/', RelatorioTipoPeriodoView.as_view(), name='relatorio-tipo-periodo'),
    path('relatorios/resultado-financeiro/', RelatorioResultadoFinanceiroView.as_view(), name='relatorio-resultado-financeiro'),
    path('relatorios/folha-salarial/', RelatorioFolhaSalarialView.as_view(), name='relatorio-folha-salarial'),
    path('relatorios/comissionamento/', RelatorioComissionamentoView.as_view(), name='relatorio-comissionamento'),
    path('relatorios/resultado-mensal/', RelatorioResultadoMensalView.as_view(), name='relatorio-resultado-mensal'),
]

