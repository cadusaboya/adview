from datetime import date

from core.models import Despesa
from core.services.commission import calcular_comissoes_mes, gerar_despesas_comissao
from core.tests.base import APITestBase
from core.tests.factories import (
    make_allocation,
    make_cliente,
    make_cliente_comissao,
    make_conta,
    make_despesa,
    make_funcionario,
    make_payment,
    make_receita,
    make_receita_comissao,
)


class CommissionServiceTests(APITestBase):
    def test_calcular_comissoes_prioriza_regra_da_receita(self):
        cliente = make_cliente(self.company)
        func_cliente = make_funcionario(self.company, tipo="F")
        func_receita = make_funcionario(self.company, tipo="F")

        make_cliente_comissao(cliente, func_cliente, percentual="40.00")
        receita = make_receita(self.company, cliente, valor="500.00", vencimento=date.today())
        make_receita_comissao(receita, func_receita, percentual="10.00")

        conta = make_conta(self.company)
        payment = make_payment(self.company, conta, tipo="E", valor="500.00", data_pagamento=date.today())
        make_allocation(self.company, payment, valor="500.00", receita=receita)

        result = calcular_comissoes_mes(self.company, date.today().month, date.today().year)

        self.assertIn(func_receita.id, result)
        self.assertNotIn(func_cliente.id, result)
        self.assertEqual(float(result[func_receita.id]["valor_comissao"]), 50.0)

    def test_gerar_despesas_comissao_remove_obsoletas(self):
        cliente = make_cliente(self.company)
        func = make_funcionario(self.company, tipo="F")

        # despesa antiga sem comissionamento atual
        make_despesa(
            self.company,
            func,
            valor="20.00",
            tipo="C",
            vencimento=date.today().replace(day=28),
            nome="Comissão antiga",
        )

        receita = make_receita(self.company, cliente, valor="300.00", vencimento=date.today())
        make_receita_comissao(receita, func, percentual="20.00")

        conta = make_conta(self.company)
        payment = make_payment(self.company, conta, tipo="E", valor="300.00", data_pagamento=date.today())
        make_allocation(self.company, payment, valor="300.00", receita=receita)

        out = gerar_despesas_comissao(self.company, date.today().month, date.today().year)

        self.assertEqual(len(out), 1)
        self.assertTrue(Despesa.objects.filter(company=self.company, tipo="C", responsavel=func).exists())
