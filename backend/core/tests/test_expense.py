from datetime import date, timedelta

from core.models import Allocation, Despesa, Payment
from core.tests.base import APITestBase
from core.tests.factories import make_conta, make_despesa_recorrente, make_funcionario


class DespesaViewSetTests(APITestBase):
    def test_create_despesa_com_marcar_como_pago_cria_payment_allocation(self):
        responsavel = make_funcionario(self.company, tipo="F")
        conta = make_conta(self.company, saldo="1000.00")

        payload = {
            "responsavel_id": responsavel.id,
            "nome": "Despesa Operacional",
            "descricao": "x",
            "data_vencimento": str(date.today()),
            "valor": "250.00",
            "tipo": "F",
            "situacao": "A",
            "marcar_como_pago": True,
            "data_pagamento": str(date.today()),
            "conta_bancaria_id": conta.id,
            "observacao_pagamento": "Pagamento despesa",
        }
        response = self.client.post("/api/despesas/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)

        despesa = Despesa.objects.get(id=response.data["id"])
        self.assertEqual(Payment.objects.filter(company=self.company).count(), 1)
        self.assertEqual(Allocation.objects.filter(despesa=despesa).count(), 1)

        despesa.refresh_from_db()
        self.assertEqual(despesa.situacao, "P")

    def test_get_queryset_auto_marks_overdue(self):
        responsavel = make_funcionario(self.company, tipo="F")
        despesa = Despesa.objects.create(
            company=self.company,
            responsavel=responsavel,
            nome="Vencida",
            data_vencimento=date.today() - timedelta(days=1),
            valor="110.00",
            tipo="F",
            situacao="A",
        )

        response = self.client.get("/api/despesas/")
        self.assertEqual(response.status_code, 200)
        despesa.refresh_from_db()
        self.assertEqual(despesa.situacao, "V")


class DespesaRecorrenteTests(APITestBase):
    def test_gerar_mes_cria_sem_duplicar(self):
        responsavel = make_funcionario(self.company, tipo="F")
        recorrente = make_despesa_recorrente(self.company, responsavel, nome="Servidor")

        first = self.client.post("/api/despesas-recorrentes/gerar-mes/", {}, format="json")
        second = self.client.post("/api/despesas-recorrentes/gerar-mes/", {}, format="json")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["criadas"], 1)
        self.assertEqual(second.data["ignoradas"], 1)
        self.assertEqual(
            Despesa.objects.filter(company=self.company, responsavel=responsavel, nome__icontains=recorrente.nome).count(),
            1,
        )

    def test_gerar_proximos_meses(self):
        responsavel = make_funcionario(self.company, tipo="F")
        recorrente = make_despesa_recorrente(self.company, responsavel, nome="Aluguel")

        response = self.client.post(
            f"/api/despesas-recorrentes/{recorrente.id}/gerar-proximos-meses/",
            {"quantidade_meses": 2},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["criadas"], 2)
