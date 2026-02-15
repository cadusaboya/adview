"""
Testes de integração para a feature de Assinaturas.

Convenção de autenticação:
- force_authenticate: usado apenas para testes que NÃO precisam verificar bloqueio 402
  (ex: criar dados, chamar endpoints de assinatura, enviar webhooks).
- JWT real (_jwt_client): obrigatório para testes que verificam que o acesso foi
  bloqueado (402), pois o `force_authenticate` bypassa o middleware de autenticação
  que aciona o check de subscription em algumas configurações.
"""
from datetime import timedelta, date
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import AssinaturaEmpresa, Company, CustomUser, PlanoAssinatura


# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

ASSINATURA_URL = "/api/assinatura/"
WEBHOOK_URL = "/api/asaas/webhook/?token=abc123"

CARD_PAYLOAD = {
    "plano_slug": "plano-teste",
    "ciclo": "MONTHLY",
    "billing_type": "CREDIT_CARD",
    "credit_card": {
        "holder_name": "Joao Silva",
        "number": "5162306219378829",
        "expiry_month": "05",
        "expiry_year": "2030",
        "ccv": "318",
    },
    "holder_info": {
        "name": "Joao Silva",
        "email": "joao@teste.com",
        "cpf_cnpj": "529.982.247-25",
        "phone": "11999999999",
        "postal_code": "01310-100",
        "address_number": "100",
    },
}

ASAAS_SUBSCRIPTION_RESULT = {
    "id": "sub_abc123",
    "status": "ACTIVE",
    "creditCard": {"creditCardBrand": "MASTERCARD", "creditCardNumber": "8829"},
}

ASAAS_CUSTOMER_ID = "cus_xyz789"


def _webhook(event, subscription_id="sub_abc123", payment_id="pay_001", due_date=None):
    payload = {
        "event": event,
        "payment": {
            "subscription": subscription_id,
            "id": payment_id,
        },
    }
    if due_date:
        payload["payment"]["dueDate"] = due_date
    return payload


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class BaseSubscriptionTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.password = "Senha@1234"
        self.company = Company.objects.create(
            name="Escritório Teste",
            cnpj="11.222.333/0001-81",
        )
        self.user = CustomUser.objects.create_user(
            username="user_teste",
            email="user@teste.com",
            password=self.password,
            company=self.company,
        )
        self.plano = PlanoAssinatura.objects.create(
            nome="Profissional",
            slug="plano-teste",
            subtitulo="Para escritórios",
            descricao="Descrição",
            preco_mensal="250.00",
            preco_anual="2500.00",
            max_usuarios=3,
            features=["A", "B"],
            ativo=True,
            ordem=1,
        )
        self.client.force_authenticate(user=self.user)

    def _get_assinatura(self):
        return AssinaturaEmpresa.objects.get(company=self.company)

    def _set_status(self, status, trial_fim_delta=None, proxima_cobranca=None, sub_id=None):
        a = self._get_assinatura()
        a.status = status
        if trial_fim_delta is not None:
            a.trial_fim = timezone.now() + trial_fim_delta
        if proxima_cobranca is not None:
            a.proxima_cobranca = proxima_cobranca
        if sub_id is not None:
            a.asaas_subscription_id = sub_id
        a.save()

    def _jwt_client(self):
        """Retorna um APIClient autenticado via JWT real (necessário para testar bloqueio 402)."""
        c = APIClient()
        resp = c.post(
            "/api/token/",
            {"username": self.user.username, "password": self.password},
            format="json",
        )
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        return c


# ===========================================================================
# 1. TRIAL
# ===========================================================================

class TrialTests(BaseSubscriptionTest):

    def test_trial_ativo_permite_acesso(self):
        """Empresa em trial válido deve acessar endpoints normalmente."""
        self._set_status("trial", trial_fim_delta=timedelta(days=5))
        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 200)

    def test_trial_expirado_bloqueia_acesso_402(self):
        """Trial vencido deve retornar 402 em qualquer endpoint protegido."""
        self._set_status("trial", trial_fim_delta=timedelta(days=-1))
        # Verifica que acesso_permitido realmente é False
        a = self._get_assinatura()
        self.assertFalse(a.acesso_permitido)
        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 402)

    def test_trial_expirado_permite_acessar_status(self):
        """Mesmo com trial vencido o endpoint de status deve ser acessível."""
        self._set_status("trial", trial_fim_delta=timedelta(days=-1))
        response = self.client.get(f"{ASSINATURA_URL}status_assinatura/")
        self.assertEqual(response.status_code, 200)

    def test_trial_expirado_permite_acessar_planos(self):
        """/api/planos/ é público (sem autenticação)."""
        response = self.client.get("/api/planos/")
        self.assertEqual(response.status_code, 200)

    def test_acesso_permitido_trial_ativo(self):
        """acesso_permitido retorna True durante trial válido."""
        self._set_status("trial", trial_fim_delta=timedelta(days=3))
        a = self._get_assinatura()
        self.assertTrue(a.acesso_permitido)

    def test_acesso_permitido_trial_expirado(self):
        """acesso_permitido retorna False quando trial expirou."""
        self._set_status("trial", trial_fim_delta=timedelta(days=-1))
        a = self._get_assinatura()
        self.assertFalse(a.acesso_permitido)

    def test_empresa_sem_assinatura_recebe_402(self):
        """C8: empresa sem AssinaturaEmpresa deve receber 402, não acesso livre."""
        AssinaturaEmpresa.objects.filter(company=self.company).delete()
        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 402)


# ===========================================================================
# 2. CRIAR ASSINATURA (mock Asaas)
# ===========================================================================

@override_settings(ASAAS_WEBHOOK_TOKEN="abc123")
class CriarAssinaturaTests(BaseSubscriptionTest):

    def _mock_asaas(self):
        return [
            patch("core.views.criar_cliente_asaas", return_value=ASAAS_CUSTOMER_ID),
            patch("core.views.atualizar_cliente_asaas", return_value=None),
            patch("core.views.criar_assinatura_cartao_asaas", return_value=ASAAS_SUBSCRIPTION_RESULT),
        ]

    def test_criar_assinatura_muda_status_para_active(self):
        """Assinatura criada com sucesso → status=active, sub_id preenchido."""
        self._set_status("trial", trial_fim_delta=timedelta(days=-1))
        patchers = self._mock_asaas()
        for p in patchers:
            p.start()
        try:
            resp = self.client.post(f"{ASSINATURA_URL}assinar/", CARD_PAYLOAD, format="json")
        finally:
            for p in patchers:
                p.stop()

        self.assertEqual(resp.status_code, 200, resp.data)
        a = self._get_assinatura()
        self.assertEqual(a.status, "active")
        self.assertEqual(a.asaas_subscription_id, "sub_abc123")

    def test_criar_assinatura_seta_proxima_cobranca(self):
        """proxima_cobranca deve ser definida no momento da assinatura."""
        self._set_status("trial", trial_fim_delta=timedelta(days=-1))
        patchers = self._mock_asaas()
        for p in patchers:
            p.start()
        try:
            self.client.post(f"{ASSINATURA_URL}assinar/", CARD_PAYLOAD, format="json")
        finally:
            for p in patchers:
                p.stop()

        a = self._get_assinatura()
        self.assertIsNotNone(a.proxima_cobranca)
        self.assertGreater(a.proxima_cobranca, date.today())

    def test_criar_assinatura_permite_acesso_via_jwt(self):
        """Após assinar, endpoint protegido deve retornar 200."""
        self._set_status("trial", trial_fim_delta=timedelta(days=-1))
        patchers = self._mock_asaas()
        for p in patchers:
            p.start()
        try:
            self.client.post(f"{ASSINATURA_URL}assinar/", CARD_PAYLOAD, format="json")
        finally:
            for p in patchers:
                p.stop()

        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 200)

    def test_criar_assinatura_plano_invalido_retorna_400(self):
        """Slug de plano inválido deve retornar 400."""
        payload = {**CARD_PAYLOAD, "plano_slug": "plano-inexistente"}
        resp = self.client.post(f"{ASSINATURA_URL}assinar/", payload, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_criar_assinatura_dados_cartao_incompletos_retorna_400(self):
        """Campos do cartão faltando devem retornar 400."""
        payload = {**CARD_PAYLOAD, "credit_card": {"holder_name": "X"}}
        resp = self.client.post(f"{ASSINATURA_URL}assinar/", payload, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_criar_assinatura_cpf_cnpj_invalido_retorna_400(self):
        """CPF/CNPJ de empresa inválido deve retornar 400 sem chamar Asaas."""
        self.company.cnpj = "00.000.000/0000-00"
        self.company.cpf = ""
        self.company.save()
        resp = self.client.post(f"{ASSINATURA_URL}assinar/", CARD_PAYLOAD, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_criar_assinatura_falha_no_asaas_retorna_503(self):
        """Se Asaas retornar erro de rede, endpoint deve retornar 503 sem mudar status."""
        from requests.exceptions import RequestException
        self._set_status("trial", trial_fim_delta=timedelta(days=-1))
        with patch("core.views.criar_cliente_asaas", return_value=ASAAS_CUSTOMER_ID), \
             patch("core.views.atualizar_cliente_asaas", return_value=None), \
             patch("core.views.criar_assinatura_cartao_asaas", side_effect=RequestException("timeout")):
            resp = self.client.post(f"{ASSINATURA_URL}assinar/", CARD_PAYLOAD, format="json")

        self.assertEqual(resp.status_code, 503)
        a = self._get_assinatura()
        self.assertNotEqual(a.status, "active")


# ===========================================================================
# 3. WEBHOOKS
# ===========================================================================

@override_settings(ASAAS_WEBHOOK_TOKEN="abc123")
class WebhookTests(BaseSubscriptionTest):

    def setUp(self):
        super().setUp()
        a = self._get_assinatura()
        a.status = "active"
        a.asaas_subscription_id = "sub_abc123"
        a.plano = self.plano
        a.ciclo = "MONTHLY"
        a.proxima_cobranca = date.today() + timedelta(days=30)
        a.save()

    def _post_webhook(self, payload):
        return self.client.post(WEBHOOK_URL, payload, format="json")

    # --- PAYMENT_RECEIVED ---

    def test_webhook_payment_received_mantém_status_active(self):
        """PAYMENT_RECEIVED em assinatura active deve manter status=active."""
        resp = self._post_webhook(_webhook("PAYMENT_RECEIVED", due_date="2025-06-01"))
        self.assertEqual(resp.status_code, 200)
        a = self._get_assinatura()
        self.assertEqual(a.status, "active")

    def test_webhook_payment_received_atualiza_proxima_cobranca(self):
        """PAYMENT_RECEIVED com dueDate deve atualizar proxima_cobranca para +1 mês."""
        resp = self._post_webhook(_webhook("PAYMENT_RECEIVED", due_date="2025-06-15"))
        self.assertEqual(resp.status_code, 200)
        a = self._get_assinatura()
        self.assertEqual(a.proxima_cobranca, date(2025, 7, 15))

    def test_webhook_payment_received_anual_atualiza_proxima_cobranca_correto(self):
        """PAYMENT_RECEIVED anual deve avançar proxima_cobranca em 1 ano."""
        a = self._get_assinatura()
        a.ciclo = "YEARLY"
        a.save()
        resp = self._post_webhook(_webhook("PAYMENT_RECEIVED", due_date="2025-03-10"))
        self.assertEqual(resp.status_code, 200)
        a.refresh_from_db()
        self.assertEqual(a.proxima_cobranca, date(2026, 3, 10))

    def test_webhook_payment_received_nao_restaura_status_cancelado(self):
        """C4: PAYMENT_RECEIVED para assinatura cancelada NÃO deve mudar status para active."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.save()

        resp = self._post_webhook(_webhook("PAYMENT_RECEIVED", due_date="2025-06-01"))
        self.assertEqual(resp.status_code, 200)

        a.refresh_from_db()
        self.assertEqual(a.status, "cancelled")  # status permanece cancelled

    # --- PAYMENT_OVERDUE ---

    def test_webhook_payment_overdue_muda_status_para_overdue(self):
        """PAYMENT_OVERDUE deve mudar status para overdue."""
        resp = self._post_webhook(_webhook("PAYMENT_OVERDUE"))
        self.assertEqual(resp.status_code, 200)
        a = self._get_assinatura()
        self.assertEqual(a.status, "overdue")
        self.assertFalse(a.acesso_permitido)

    def test_webhook_payment_overdue_bloqueia_endpoints(self):
        """Após PAYMENT_OVERDUE, endpoints protegidos devem retornar 402."""
        self._post_webhook(_webhook("PAYMENT_OVERDUE"))
        a = self._get_assinatura()
        self.assertFalse(a.acesso_permitido)
        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 402)

    def test_webhook_payment_overdue_nao_sobrescreve_cancelled(self):
        """C10: PAYMENT_OVERDUE em assinatura já cancelada não deve mudar para overdue."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.save()

        self._post_webhook(_webhook("PAYMENT_OVERDUE"))
        a.refresh_from_db()
        self.assertEqual(a.status, "cancelled")

    # --- PAYMENT_REFUSED ---

    def test_webhook_payment_refused_muda_status_para_payment_failed(self):
        """PAYMENT_REFUSED deve mudar status para payment_failed."""
        resp = self._post_webhook(_webhook("PAYMENT_REFUSED"))
        self.assertEqual(resp.status_code, 200)
        a = self._get_assinatura()
        self.assertEqual(a.status, "payment_failed")
        self.assertFalse(a.acesso_permitido)

    def test_webhook_payment_refused_bloqueia_endpoints(self):
        """Após PAYMENT_REFUSED, endpoints protegidos devem retornar 402."""
        self._post_webhook(_webhook("PAYMENT_REFUSED"))
        a = self._get_assinatura()
        self.assertFalse(a.acesso_permitido)
        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 402)

    def test_webhook_payment_refused_nao_afeta_cancelled(self):
        """PAYMENT_REFUSED em assinatura cancelada não deve mudar o status."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.save()
        self._post_webhook(_webhook("PAYMENT_REFUSED"))
        a.refresh_from_db()
        self.assertEqual(a.status, "cancelled")

    # --- SUBSCRIPTION_CANCELLED ---

    def test_webhook_subscription_cancelled_muda_status(self):
        """SUBSCRIPTION_CANCELLED deve mudar status para cancelled."""
        resp = self._post_webhook(_webhook("SUBSCRIPTION_CANCELLED"))
        self.assertEqual(resp.status_code, 200)
        a = self._get_assinatura()
        self.assertEqual(a.status, "cancelled")

    def test_webhook_subscription_cancelled_zera_sub_id(self):
        """SUBSCRIPTION_CANCELLED deve zerar asaas_subscription_id."""
        self._post_webhook(_webhook("SUBSCRIPTION_CANCELLED"))
        a = self._get_assinatura()
        self.assertFalse(a.asaas_subscription_id)

    # --- IDEMPOTÊNCIA ---

    def test_webhook_idempotente_nao_processa_dois_vezes(self):
        """Mesmo evento+payment_id enviado duas vezes deve ser processado apenas 1x."""
        from core.models import WebhookLog
        payload = _webhook("PAYMENT_OVERDUE", payment_id="pay_dup")
        self._post_webhook(payload)
        self._post_webhook(payload)
        count = WebhookLog.objects.filter(
            event_type="PAYMENT_OVERDUE",
            asaas_payment_id="pay_dup",
            processed=True,
        ).count()
        self.assertEqual(count, 1)

    # --- TOKEN INVÁLIDO ---

    def test_webhook_token_invalido_retorna_401(self):
        """Webhook com token errado deve retornar 401."""
        resp = self.client.post(
            "/api/asaas/webhook/?token=ERRADO",
            _webhook("PAYMENT_RECEIVED"),
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    @override_settings(ASAAS_WEBHOOK_TOKEN="")
    def test_webhook_token_vazio_retorna_401(self):
        """Webhook sem token configurado deve retornar 401."""
        resp = self.client.post(
            "/api/asaas/webhook/?token=",
            _webhook("PAYMENT_RECEIVED"),
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    # --- LEAP DAY ---

    def test_webhook_leap_day_yearly_proxima_cobranca(self):
        """Pagamento em 29/fev (ano bissexto) anual → próxima em 28/fev do ano seguinte."""
        a = self._get_assinatura()
        a.ciclo = "YEARLY"
        a.save()
        self._post_webhook(_webhook("PAYMENT_RECEIVED", due_date="2024-02-29"))
        a.refresh_from_db()
        self.assertIsNotNone(a.proxima_cobranca)
        self.assertEqual(a.proxima_cobranca, date(2025, 2, 28))


# ===========================================================================
# 4. CANCELAR ASSINATURA
# ===========================================================================

@override_settings(ASAAS_WEBHOOK_TOKEN="abc123")
class CancelarAssinaturaTests(BaseSubscriptionTest):

    def setUp(self):
        super().setUp()
        a = self._get_assinatura()
        a.status = "active"
        a.asaas_subscription_id = "sub_abc123"
        a.plano = self.plano
        a.ciclo = "MONTHLY"
        a.proxima_cobranca = date.today() + timedelta(days=20)
        a.save()

    def test_cancelar_chama_asaas_e_muda_status(self):
        """C2: cancelar() deve chamar Asaas E mudar status local."""
        with patch("core.views.cancelar_assinatura_asaas") as mock_cancel:
            resp = self.client.post(f"{ASSINATURA_URL}cancelar/")
        self.assertEqual(resp.status_code, 200)
        mock_cancel.assert_called_once_with("sub_abc123")
        a = self._get_assinatura()
        self.assertEqual(a.status, "cancelled")

    def test_cancelar_falha_no_asaas_retorna_503_sem_mudar_status(self):
        """C2: se Asaas falhar com erro de rede, status local NÃO deve ser alterado."""
        from requests.exceptions import RequestException
        with patch("core.views.cancelar_assinatura_asaas", side_effect=RequestException("timeout")):
            resp = self.client.post(f"{ASSINATURA_URL}cancelar/")
        self.assertEqual(resp.status_code, 503)
        a = self._get_assinatura()
        self.assertEqual(a.status, "active")

    def test_cancelar_periodo_graca_mantem_acesso(self):
        """Após cancelar, se proxima_cobranca > hoje, acesso deve ser mantido."""
        with patch("core.views.cancelar_assinatura_asaas"):
            self.client.post(f"{ASSINATURA_URL}cancelar/")
        a = self._get_assinatura()
        self.assertEqual(a.status, "cancelled")
        self.assertTrue(a.acesso_permitido)  # proxima_cobranca no futuro
        # Verifica acesso real via JWT
        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 200)

    def test_cancelar_periodo_graca_expirado_bloqueia_acesso(self):
        """Após cancelar com proxima_cobranca no passado, acesso deve ser bloqueado."""
        a = self._get_assinatura()
        a.proxima_cobranca = date.today() - timedelta(days=1)
        a.save()
        with patch("core.views.cancelar_assinatura_asaas"):
            self.client.post(f"{ASSINATURA_URL}cancelar/")
        a.refresh_from_db()
        self.assertFalse(a.acesso_permitido)
        c = self._jwt_client()
        response = c.get("/api/clientes/")
        self.assertEqual(response.status_code, 402)

    def test_cancelar_sem_sub_id_nao_chama_asaas(self):
        """Cancelar sem sub_id (ex: situação de overdue sem subscription) não chama Asaas."""
        a = self._get_assinatura()
        a.asaas_subscription_id = ""
        a.save()
        with patch("core.views.cancelar_assinatura_asaas") as mock_cancel:
            resp = self.client.post(f"{ASSINATURA_URL}cancelar/")
        mock_cancel.assert_not_called()
        self.assertEqual(resp.status_code, 200)

    def test_cancelar_assinatura_ja_cancelada_retorna_400(self):
        """Não deve ser possível cancelar uma assinatura já cancelada."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.save()
        resp = self.client.post(f"{ASSINATURA_URL}cancelar/")
        self.assertEqual(resp.status_code, 400)


# ===========================================================================
# 5. COBRANÇA AUTOMÁTICA APÓS 1 MÊS
# ===========================================================================

@override_settings(ASAAS_WEBHOOK_TOKEN="abc123")
class CobrancaAutomaticaTests(BaseSubscriptionTest):

    def setUp(self):
        super().setUp()
        a = self._get_assinatura()
        a.status = "active"
        a.asaas_subscription_id = "sub_abc123"
        a.plano = self.plano
        a.ciclo = "MONTHLY"
        a.proxima_cobranca = date.today()
        a.save()

    def test_cobranca_automatica_bem_sucedida_renova_acesso(self):
        """PAYMENT_RECEIVED renova proxima_cobranca e mantém status active."""
        next_month = date.today() + timedelta(days=31)
        self.client.post(
            WEBHOOK_URL,
            _webhook("PAYMENT_RECEIVED", due_date=next_month.isoformat()),
            format="json",
        )
        a = self._get_assinatura()
        self.assertEqual(a.status, "active")
        self.assertGreater(a.proxima_cobranca, date.today())

    def test_cobranca_automatica_falhou_overdue_bloqueia(self):
        """PAYMENT_OVERDUE deve mudar para overdue e acesso_permitido False."""
        self.client.post(WEBHOOK_URL, _webhook("PAYMENT_OVERDUE"), format="json")
        a = self._get_assinatura()
        self.assertEqual(a.status, "overdue")
        self.assertFalse(a.acesso_permitido)

    def test_cobranca_automatica_recusada_payment_failed_bloqueia(self):
        """PAYMENT_REFUSED deve mudar para payment_failed e acesso_permitido False."""
        self.client.post(WEBHOOK_URL, _webhook("PAYMENT_REFUSED"), format="json")
        a = self._get_assinatura()
        self.assertEqual(a.status, "payment_failed")
        self.assertFalse(a.acesso_permitido)

    def test_cancelamento_automatico_apos_nao_pagar(self):
        """Asaas cancela assinatura via SUBSCRIPTION_CANCELLED após múltiplos não-pagamentos."""
        a = self._get_assinatura()
        a.status = "overdue"
        a.save()

        self.client.post(WEBHOOK_URL, _webhook("SUBSCRIPTION_CANCELLED"), format="json")
        a.refresh_from_db()
        self.assertEqual(a.status, "cancelled")
        self.assertFalse(a.asaas_subscription_id)


# ===========================================================================
# 6. REATIVAR ASSINATURA
# ===========================================================================

class ReativarAssinaturaTests(BaseSubscriptionTest):

    def test_reativar_dentro_do_periodo_graca(self):
        """Reativar durante período de graça deve voltar para active."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.proxima_cobranca = date.today() + timedelta(days=10)
        a.save()

        resp = self.client.post(f"{ASSINATURA_URL}reativar/")
        self.assertEqual(resp.status_code, 200)
        a.refresh_from_db()
        self.assertEqual(a.status, "active")

    def test_reativar_fora_do_periodo_graca_retorna_400(self):
        """Não pode reativar se proxima_cobranca já passou."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.proxima_cobranca = date.today() - timedelta(days=5)
        a.save()

        resp = self.client.post(f"{ASSINATURA_URL}reativar/")
        self.assertEqual(resp.status_code, 400)

    def test_reativar_assinatura_ativa_retorna_400(self):
        """Não deve reativar assinatura que já está ativa."""
        self._set_status("active")
        resp = self.client.post(f"{ASSINATURA_URL}reativar/")
        self.assertEqual(resp.status_code, 400)


# ===========================================================================
# 7. EDGE CASES
# ===========================================================================

@override_settings(ASAAS_WEBHOOK_TOKEN="abc123")
class EdgeCasesTests(BaseSubscriptionTest):

    def test_subscription_id_antigo_preservado_ao_reassinar(self):
        """C3: ao reassinar, subscription_id antigo deve ir para asaas_subscription_ids_anteriores."""
        a = self._get_assinatura()
        a.status = "overdue"
        a.asaas_subscription_id = "sub_antigo"
        a.save()

        with patch("core.views.criar_cliente_asaas", return_value=ASAAS_CUSTOMER_ID), \
             patch("core.views.atualizar_cliente_asaas"), \
             patch("core.views.cancelar_assinatura_asaas"), \
             patch("core.views.criar_assinatura_cartao_asaas", return_value=ASAAS_SUBSCRIPTION_RESULT):
            self.client.post(f"{ASSINATURA_URL}assinar/", CARD_PAYLOAD, format="json")

        a.refresh_from_db()
        self.assertIn("sub_antigo", a.asaas_subscription_ids_anteriores)
        self.assertNotEqual(a.asaas_subscription_id, "sub_antigo")

    def test_subscription_id_antigo_preservado_mesmo_se_cancelamento_falhar(self):
        """C3: mesmo que cancelamento no Asaas falhe, o ID antigo não deve ser perdido."""
        from requests.exceptions import RequestException
        a = self._get_assinatura()
        a.status = "overdue"
        a.asaas_subscription_id = "sub_antigo_falhou"
        a.save()

        with patch("core.views.criar_cliente_asaas", return_value=ASAAS_CUSTOMER_ID), \
             patch("core.views.atualizar_cliente_asaas"), \
             patch("core.views.cancelar_assinatura_asaas", side_effect=RequestException("timeout")), \
             patch("core.views.criar_assinatura_cartao_asaas", return_value=ASAAS_SUBSCRIPTION_RESULT):
            self.client.post(f"{ASSINATURA_URL}assinar/", CARD_PAYLOAD, format="json")

        a.refresh_from_db()
        self.assertIn("sub_antigo_falhou", a.asaas_subscription_ids_anteriores)

    def test_usuario_sem_empresa_nao_causa_500(self):
        """Usuário sem company associada não deve gerar 500."""
        user_sem_empresa = CustomUser.objects.create_user(
            username="sem_empresa",
            email="sem@empresa.com",
            password="12345678",
            company=None,
        )
        self.client.force_authenticate(user=user_sem_empresa)
        response = self.client.get(f"{ASSINATURA_URL}status_assinatura/")
        self.assertNotEqual(response.status_code, 500)

    def test_webhook_subscription_id_invalido_nao_causa_500(self):
        """Webhook com subscription_id que não existe no banco deve retornar 200 sem crash."""
        resp = self.client.post(
            WEBHOOK_URL,
            _webhook("PAYMENT_RECEIVED", subscription_id="sub_inexistente"),
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

    def test_planos_endpoint_acessivel_sem_autenticacao(self):
        """Endpoint de planos deve ser público."""
        client_anonimo = APIClient()
        resp = client_anonimo.get("/api/planos/")
        self.assertEqual(resp.status_code, 200)

    def test_status_endpoint_retorna_campos_esperados(self):
        """Status da assinatura deve conter campos essenciais."""
        resp = self.client.get(f"{ASSINATURA_URL}status_assinatura/")
        self.assertEqual(resp.status_code, 200)
        for campo in ("status", "acesso_permitido", "trial_ativo"):
            self.assertIn(campo, resp.data, f"Campo '{campo}' ausente no response")

    def test_acesso_cancelado_com_proxima_cobranca_futura(self):
        """Status cancelled + proxima_cobranca no futuro → acesso_permitido=True (período de graça)."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.proxima_cobranca = date.today() + timedelta(days=5)
        a.save()
        self.assertTrue(a.acesso_permitido)

    def test_acesso_cancelado_sem_proxima_cobranca(self):
        """Status cancelled + sem proxima_cobranca → acesso_permitido=False."""
        a = self._get_assinatura()
        a.status = "cancelled"
        a.proxima_cobranca = None
        a.save()
        self.assertFalse(a.acesso_permitido)


# ===========================================================================
# 8. TESTES LEGADOS (compatibilidade com testes anteriores)
# ===========================================================================

class SubscriptionPlanFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(name="Empresa Teste")
        self.password = "12345678"
        self.user = CustomUser.objects.create_user(
            username="user_teste_legado",
            email="user_legado@teste.com",
            password=self.password,
            company=self.company,
        )
        self.plano = PlanoAssinatura.objects.create(
            nome="Plano Teste",
            slug="plano-teste-legado",
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
            username="sem_empresa_legado",
            email="semleg@empresa.com",
            password="12345678",
            company=None,
        )
        self.client.force_authenticate(user=no_company_user)
        response = self.client.get("/api/assinatura/status_assinatura/")
        self.assertNotEqual(response.status_code, 500)

    @override_settings(ASAAS_WEBHOOK_TOKEN="")
    def test_webhook_should_not_accept_when_secret_is_empty(self):
        response = self.client.post(
            "/api/asaas/webhook/",
            data={"event": "PING"},
            format="json",
        )
        self.assertEqual(response.status_code, 401)

    @override_settings(ASAAS_WEBHOOK_TOKEN="abc123")
    def test_webhook_yearly_payment_from_leap_day_should_define_next_due_date(self):
        assinatura = AssinaturaEmpresa.objects.get(company=self.company)
        assinatura.status = "overdue"
        assinatura.pending_ciclo = "YEARLY"
        assinatura.asaas_subscription_id = "sub_teste_legado"
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
                    "subscription": "sub_teste_legado",
                    "dueDate": "2024-02-29",
                },
            },
            format="json",
        )
        assinatura.refresh_from_db()

        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(assinatura.proxima_cobranca)
