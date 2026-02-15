from datetime import timedelta

from django.utils import timezone

from core.models import AssinaturaEmpresa
from core.tests.base import APITestBase
from core.tests.factories import make_cliente


class SubscriptionPermissionTests(APITestBase):
    def test_inactive_subscription_returns_402(self):
        assinatura = self.company.assinatura
        assinatura.status = "overdue"
        assinatura.trial_fim = timezone.now() - timedelta(days=1)
        assinatura.save(update_fields=["status", "trial_fim"])

        response = self.jwt_client().get("/api/clientes/")
        self.assertEqual(response.status_code, 402)

    def test_missing_subscription_row_returns_402(self):
        AssinaturaEmpresa.objects.filter(company=self.company).delete()
        response = self.jwt_client().get("/api/clientes/")
        self.assertEqual(response.status_code, 402)

    def test_superuser_bypasses_subscription_permission(self):
        admin = self.user
        admin.is_superuser = True
        admin.is_staff = True
        admin.company = None
        admin.save(update_fields=["is_superuser", "is_staff", "company"])
        self.auth_as(admin)

        response = self.client.get("/api/clientes/")
        self.assertEqual(response.status_code, 200)


class CompanyScopedTests(APITestBase):
    def test_list_returns_only_same_company(self):
        make_cliente(self.company, nome="Cliente A Unico")
        make_cliente(self.company_b, nome="Cliente B Unico")

        response = self.client.get("/api/clientes/")
        self.assertEqual(response.status_code, 200)
        nomes = [item["nome"] for item in self.results(response)]

        self.assertIn("Cliente A Unico", nomes)
        self.assertNotIn("Cliente B Unico", nomes)

    def test_create_injects_company(self):
        payload = {"nome": "Conta Teste", "descricao": "x", "saldo_atual": "100.00"}
        response = self.client.post("/api/contas-bancarias/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.data)

        conta_id = response.data["id"]
        self.assertEqual(response.data["company"], self.company.id)
        self.assertIsNotNone(conta_id)
