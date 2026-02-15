from datetime import date, timedelta

from core.models import Allocation, Payment, Receita
from core.tests.base import APITestBase
from core.tests.factories import make_cliente, make_conta, make_receita_recorrente


class ReceitaViewSetTests(APITestBase):
    def test_create_receita_com_marcar_como_pago_cria_payment_allocation(self):
        cliente = make_cliente(self.company)
        conta = make_conta(self.company, saldo="0.00")

        payload = {
            "cliente_id": cliente.id,
            "nome": "Honorario",
            "descricao": "x",
            "data_vencimento": str(date.today()),
            "valor": "500.00",
            "tipo": "F",
            "situacao": "A",
            "marcar_como_pago": True,
            "data_pagamento": str(date.today()),
            "conta_bancaria_id": conta.id,
            "observacao_pagamento": "Recebimento",
        }
        response = self.client.post("/api/receitas/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)

        receita = Receita.objects.get(id=response.data["id"])
        self.assertEqual(Payment.objects.filter(company=self.company).count(), 1)
        self.assertEqual(Allocation.objects.filter(receita=receita).count(), 1)

        receita.refresh_from_db()
        self.assertEqual(receita.situacao, "P")

    def test_get_queryset_auto_marks_overdue(self):
        cliente = make_cliente(self.company)
        receita = Receita.objects.create(
            company=self.company,
            cliente=cliente,
            nome="Vencida",
            data_vencimento=date.today() - timedelta(days=1),
            valor="100.00",
            tipo="F",
            situacao="A",
        )

        response = self.client.get("/api/receitas/")
        self.assertEqual(response.status_code, 200)
        receita.refresh_from_db()
        self.assertEqual(receita.situacao, "V")


class ReceitaRecorrenteTests(APITestBase):
    def test_gerar_mes_cria_receitas_sem_duplicar(self):
        cliente = make_cliente(self.company)
        recorrente = make_receita_recorrente(self.company, cliente, nome="Mensalidade", dia=31)

        first = self.client.post("/api/receitas-recorrentes/gerar-mes/", {}, format="json")
        second = self.client.post("/api/receitas-recorrentes/gerar-mes/", {}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["criadas"], 1)
        self.assertEqual(second.data["ignoradas"], 1)
        self.assertEqual(
            Receita.objects.filter(company=self.company, cliente=cliente, nome__icontains=recorrente.nome).count(),
            1,
        )

    def test_gerar_proximos_meses_respeita_limite(self):
        cliente = make_cliente(self.company)
        recorrente = make_receita_recorrente(self.company, cliente, nome="Plano Retainer")

        response = self.client.post(
            f"/api/receitas-recorrentes/{recorrente.id}/gerar-proximos-meses/",
            {"quantidade_meses": 3},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["criadas"], 3)
