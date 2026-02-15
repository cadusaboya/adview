from datetime import date, timedelta

from core.tests.base import APITestBase
from core.tests.factories import (
    make_allocation,
    make_cliente,
    make_conta,
    make_custodia,
    make_despesa,
    make_funcionario,
    make_payment,
    make_receita,
    make_transfer,
)


class ModelStatusTests(APITestBase):
    def test_receita_status_changes_by_allocations(self):
        cliente = make_cliente(self.company)
        conta = make_conta(self.company)
        receita = make_receita(
            self.company,
            cliente,
            valor="100.00",
            vencimento=date.today() + timedelta(days=1),
            situacao="A",
        )

        payment = make_payment(self.company, conta, tipo="E", valor="100.00")
        make_allocation(self.company, payment, valor="100.00", receita=receita)
        receita.atualizar_status()
        self.assertEqual(receita.situacao, "P")

    def test_despesa_status_changes_by_allocations(self):
        responsavel = make_funcionario(self.company)
        conta = make_conta(self.company)
        despesa = make_despesa(
            self.company,
            responsavel,
            valor="100.00",
            vencimento=date.today() + timedelta(days=1),
            situacao="A",
        )

        payment = make_payment(self.company, conta, tipo="S", valor="100.00")
        make_allocation(self.company, payment, valor="100.00", despesa=despesa)
        despesa.atualizar_status()
        self.assertEqual(despesa.situacao, "P")

    def test_transfer_status_pending_mismatch_complete(self):
        conta_a = make_conta(self.company)
        conta_b = make_conta(self.company)
        transfer = make_transfer(self.company, conta_a, conta_b, valor="100.00")

        transfer.atualizar_status()
        self.assertEqual(transfer.status, "P")

        saida = make_payment(self.company, conta_a, tipo="S", valor="60.00")
        make_allocation(self.company, saida, valor="60.00", transfer=transfer)
        transfer.atualizar_status()
        self.assertEqual(transfer.status, "M")

        entrada = make_payment(self.company, conta_b, tipo="E", valor="60.00")
        make_allocation(self.company, entrada, valor="60.00", transfer=transfer)
        transfer.atualizar_status()
        self.assertEqual(transfer.status, "C")

    def test_custodia_status_aberto_parcial_liquidado(self):
        cliente = make_cliente(self.company)
        conta = make_conta(self.company)
        custodia = make_custodia(self.company, cliente=cliente, tipo="P", valor_total="100.00")

        custodia.atualizar_status()
        self.assertEqual(custodia.status, "A")

        entrada = make_payment(self.company, conta, tipo="E", valor="40.00")
        saida = make_payment(self.company, conta, tipo="S", valor="40.00")
        make_allocation(self.company, entrada, valor="40.00", custodia=custodia)
        make_allocation(self.company, saida, valor="40.00", custodia=custodia)
        custodia.atualizar_status()
        self.assertEqual(custodia.status, "P")

        entrada2 = make_payment(self.company, conta, tipo="E", valor="60.00")
        saida2 = make_payment(self.company, conta, tipo="S", valor="60.00")
        make_allocation(self.company, entrada2, valor="60.00", custodia=custodia)
        make_allocation(self.company, saida2, valor="60.00", custodia=custodia)
        custodia.atualizar_status()
        self.assertEqual(custodia.status, "L")
