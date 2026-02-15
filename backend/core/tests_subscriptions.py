from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import AssinaturaEmpresa, Company, CustomUser, PlanoAssinatura


class SubscriptionPlanFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(name="Empresa Teste")
        self.password = "12345678"
        self.user = CustomUser.objects.create_user(
            username="user_teste",
            email="user@teste.com",
            password=self.password,
            company=self.company,
        )
        self.plano = PlanoAssinatura.objects.create(
            nome="Plano Teste",
            slug="plano-teste",
            subtitulo="Teste",
            descricao="Descricao",
            preco_mensal="99.90",
            preco_anual="999.00",
            max_usuarios=3,
            features=["A", "B"],
            ativo=True,
            ordem=99,
        )

    def test_planos_endpoint_public(self):
        response = self.client.get("/api/planos/")
        self.assertEqual(response.status_code, 200)

    def test_status_assinatura_authenticated_user(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/assinatura/status_assinatura/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.data)

    def test_protected_endpoints_return_402_when_subscription_inactive(self):
        assinatura = AssinaturaEmpresa.objects.get(company=self.company)
        assinatura.status = "overdue"
        assinatura.trial_fim = timezone.now() - timedelta(days=1)
        assinatura.save(update_fields=["status", "trial_fim"])
        assinatura.refresh_from_db()
        self.assertFalse(assinatura.acesso_permitido)
        token_resp = self.client.post(
            "/api/token/",
            data={"username": self.user.username, "password": self.password},
            format="json",
        )
        access = token_resp.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.get("/api/clientes/")
        self.assertEqual(response.status_code, 402)

    def test_subscription_status_endpoint_still_accessible_when_inactive(self):
        assinatura = AssinaturaEmpresa.objects.get(company=self.company)
        assinatura.status = "overdue"
        assinatura.trial_fim = timezone.now() - timedelta(days=1)
        assinatura.save(update_fields=["status", "trial_fim"])

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/assinatura/status_assinatura/")
        self.assertEqual(response.status_code, 200)

    def test_status_assinatura_user_without_company_should_not_500(self):
        no_company_user = CustomUser.objects.create_user(
            username="sem_empresa",
            email="sem@empresa.com",
            password="12345678",
            company=None,
        )
        self.client.force_authenticate(user=no_company_user)
        response = self.client.get("/api/assinatura/status_assinatura/")
        # comportamento desejado: 4xx sem erro interno
        self.assertNotEqual(response.status_code, 500)

    @override_settings(ASAAS_WEBHOOK_TOKEN="")
    def test_webhook_should_not_accept_when_secret_is_empty(self):
        response = self.client.post(
            "/api/asaas/webhook/",
            data={"event": "PING"},
            format="json",
        )
        # comportamento desejado de segurança: recusar quando token não está configurado
        self.assertEqual(response.status_code, 401)

    @override_settings(ASAAS_WEBHOOK_TOKEN="abc123")
    def test_webhook_yearly_payment_from_leap_day_should_define_next_due_date(self):
        assinatura = AssinaturaEmpresa.objects.get(company=self.company)
        assinatura.status = "overdue"
        assinatura.pending_ciclo = "YEARLY"
        assinatura.asaas_subscription_id = "sub_teste_1"
        assinatura.proxima_cobranca = None
        assinatura.trial_fim = timezone.now() - timedelta(days=1)
        assinatura.save(
            update_fields=[
                "status",
                "pending_ciclo",
                "asaas_subscription_id",
                "proxima_cobranca",
                "trial_fim",
            ]
        )

        response = self.client.post(
            "/api/asaas/webhook/?token=abc123",
            data={
                "event": "PAYMENT_RECEIVED",
                "payment": {
                    "subscription": "sub_teste_1",
                    "dueDate": "2024-02-29",
                },
            },
            format="json",
        )
        assinatura.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        # comportamento desejado: deveria virar 2025-02-28, não ficar None
        self.assertIsNotNone(assinatura.proxima_cobranca)

