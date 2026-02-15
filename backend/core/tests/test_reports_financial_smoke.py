from datetime import date

from core.tests.base import APITestBase
from core.tests.factories import make_cliente, make_despesa, make_funcionario, make_receita


class FinancialReportSmokeTests(APITestBase):
    def setUp(self):
        super().setUp()
        cliente = make_cliente(self.company)
        responsavel = make_funcionario(self.company)
        make_receita(self.company, cliente, valor="1000.00", vencimento=date.today(), situacao="A")
        make_despesa(self.company, responsavel, valor="300.00", vencimento=date.today(), situacao="A")

    def test_tipo_periodo_requires_tipo_relatorio(self):
        resp = self.client.get("/api/relatorios/tipo-periodo/")
        self.assertEqual(resp.status_code, 400)

    def test_tipo_periodo_receita_returns_200(self):
        resp = self.client.get("/api/relatorios/tipo-periodo/?tipo_relatorio=receita")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(isinstance(resp.data, list))

    def test_resultado_financeiro_returns_expected_keys(self):
        resp = self.client.get("/api/relatorios/resultado-financeiro/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("resultado_financeiro", resp.data)

    def test_dre_and_balanco_endpoints(self):
        dre = self.client.get("/api/relatorios/dre/")
        balanco = self.client.get("/api/relatorios/balanco/")

        self.assertEqual(dre.status_code, 200)
        self.assertEqual(balanco.status_code, 200)
        self.assertIn("resultado", dre.data)
        self.assertIn("resultado", balanco.data)
