from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet, CustomUserViewSet, ClienteViewSet,
    FuncionarioViewSet, ReceitaViewSet, ReceitaRecorrenteViewSet, DespesaViewSet, DespesaRecorrenteViewSet,
    FornecedorViewSet, ContaBancariaViewSet, PaymentViewSet,
    FavorecidoViewSet, dashboard_view,  # 👈 adiciona aqui
    # Import Report Views
    RelatorioClienteView, RelatorioFuncionarioView, RelatorioTipoPeriodoView,
    RelatorioResultadoFinanceiroView, RelatorioFolhaSalarialView,
    RelatorioComissionamentoView, RelatorioResultadoMensalView,
    dre_consolidado
)

from .pdf_views import (
    relatorio_receitas_pagas,
    relatorio_cliente_especifico,
    relatorio_despesas_pagas,
    relatorio_despesas_a_pagar,
    relatorio_receitas_a_receber, # Renomeado para a_receber para clareza
    relatorio_dre_consolidado,
    relatorio_fluxo_de_caixa,
    relatorio_funcionario_especifico, 
    recibo_pagamento,
)

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'users', CustomUserViewSet, basename='customuser')
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'funcionarios', FuncionarioViewSet, basename='funcionario')
router.register(r'receitas', ReceitaViewSet, basename='receita')
router.register(r'receitas-recorrentes', ReceitaRecorrenteViewSet, basename='receita-recorrente')
router.register(r'despesas', DespesaViewSet, basename='despesa')
router.register(r'despesas-recorrentes', DespesaRecorrenteViewSet, basename='despesa-recorrente')
router.register(r'fornecedores', FornecedorViewSet, basename='Fornecedor')
router.register(r'contas-bancarias', ContaBancariaViewSet, basename='contabancaria')  # 👈 novo
router.register(r'pagamentos', PaymentViewSet, basename='payment')  # 👈 novo
router.register(r'favorecidos', FavorecidoViewSet, basename='favorecido')  # 👈 novo

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
    path('relatorios/dre/', dre_consolidado, name='dre-consolidado'),
    path('dashboard/', dashboard_view, name='dashboard'),

    # PDF Urls
    # 1. Relatório de Receitas Pagas
    path('pdf/receitas-pagas/', relatorio_receitas_pagas, name='relatorio-receitas-pagas'),

    # 2. Relatório de Cliente Específico
    path('pdf/cliente-especifico/', relatorio_cliente_especifico, name='relatorio-cliente-especifico'),

    # 3. Relatório de Despesas Pagas
    path('pdf/despesas-pagas/', relatorio_despesas_pagas, name='relatorio-despesas-pagas'),

    # 4. Relatório de Despesas a Pagar
    path('pdf/despesas-a-pagar/', relatorio_despesas_a_pagar, name='relatorio-despesas-a-pagar'),

    # 5. Relatório de Receitas a Receber (a Pagar no Trello)
    path('pdf/receitas-a-receber/', relatorio_receitas_a_receber, name='relatorio-receitas-a-receber'),

    # 6. Relatório de DRE Consolidado
    path('pdf/dre/', relatorio_dre_consolidado, name='relatorio-dre-consolidado'),

    # 7. Relatório de Fluxo de Caixa
    path('pdf/fluxo-de-caixa/', relatorio_fluxo_de_caixa, name='relatorio-fluxo-de-caixa'),

    # 8. Relatório Funcionário Específico
    path('pdf/funcionario-especifico/', relatorio_funcionario_especifico, name='relatorio-fluxo-de-caixa'),

    path('pdf/recibo-pagamento/', recibo_pagamento, name='recibo_pagamento'),

]


