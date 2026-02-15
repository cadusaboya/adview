from datetime import date, timedelta

from core.models import Allocation
from core.tests.base import APITestBase
from core.tests.factories import make_cliente, make_conta, make_despesa, make_funcionario, make_payment, make_receita


class AllocationViewSetTests(APITestBase):
    def test_create_allocation_for_receita(self):
        cliente = make_cliente(self.company)
        receita = make_receita(self.company, cliente, valor="100.00")
        conta = make_conta(self.company)
        payment = make_payment(self.company, conta, tipo="E", valor="100.00")

        resp = self.client.post(
            "/api/alocacoes/",
            {"payment_id": payment.id, "receita_id": receita.id, "valor": "100.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        receita.refresh_from_db()
        self.assertEqual(receita.situacao, "P")

    def test_reject_multiple_targets(self):
        cliente = make_cliente(self.company)
        funcionario = make_funcionario(self.company)
        receita = make_receita(self.company, cliente, valor="100.00")
        despesa = make_despesa(self.company, funcionario, valor="100.00")
        conta = make_conta(self.company)
        payment = make_payment(self.company, conta, tipo="E", valor="100.00")

        resp = self.client.post(
            "/api/alocacoes/",
            {
                "payment_id": payment.id,
                "receita_id": receita.id,
                "despesa_id": despesa.id,
                "valor": "100.00",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_reject_over_allocation(self):
        cliente = make_cliente(self.company)
        receita = make_receita(self.company, cliente, valor="100.00")
        conta = make_conta(self.company)
        payment = make_payment(self.company, conta, tipo="E", valor="100.00")

        first = self.client.post(
            "/api/alocacoes/",
            {"payment_id": payment.id, "receita_id": receita.id, "valor": "80.00"},
            format="json",
        )
        self.assertEqual(first.status_code, 201, first.data)

        second = self.client.post(
            "/api/alocacoes/",
            {"payment_id": payment.id, "receita_id": receita.id, "valor": "30.00"},
            format="json",
        )
        self.assertEqual(second.status_code, 400)

    def test_destroy_allocation_reverts_status(self):
        cliente = make_cliente(self.company)
        receita = make_receita(
            self.company,
            cliente,
            valor="100.00",
            vencimento=date.today() + timedelta(days=5),
            situacao="A",
        )
        conta = make_conta(self.company)
        payment = make_payment(self.company, conta, tipo="E", valor="100.00")

        alloc = Allocation.objects.create(company=self.company, payment=payment, receita=receita, valor=100)
        receita.atualizar_status()
        self.assertEqual(receita.situacao, "P")

        resp = self.client.delete(f"/api/alocacoes/{alloc.id}/")
        self.assertEqual(resp.status_code, 204)

        receita.refresh_from_db()
        self.assertEqual(receita.situacao, "A")
