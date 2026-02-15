import logging
import json
import secrets
import resend
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings as django_settings
from django.db import transaction
from django.utils import timezone
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from requests.exceptions import RequestException, HTTPError
from .mixins import (
    CompanyScopedViewSetMixin, PaymentRateThrottle,
    _add_one_year_safe, _add_one_month_safe,
    _normalize_digits, _is_valid_cpf_cnpj
)
from ..models import PlanoAssinatura, AssinaturaEmpresa, WebhookLog, Company, CustomUser
from ..serializers import PlanoAssinaturaSerializer, AssinaturaEmpresaSerializer
from ..asaas_service import (
    criar_cliente_asaas, atualizar_cliente_asaas,
    criar_assinatura_cartao_asaas, atualizar_cartao_assinatura,
    cancelar_assinatura_asaas, reativar_assinatura_asaas
)

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Subscription ViewSets
# ──────────────────────────────────────────────

class PlanoAssinaturaViewSet(viewsets.ReadOnlyModelViewSet):
    """Public endpoint — lists available subscription plans. No auth required."""
    queryset = PlanoAssinatura.objects.filter(ativo=True).order_by('ordem')
    serializer_class = PlanoAssinaturaSerializer
    permission_classes = []
    pagination_class = None


class AssinaturaViewSet(viewsets.GenericViewSet):
    """Subscription management for the authenticated user's company."""
    serializer_class = AssinaturaEmpresaSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Intentionally does NOT include IsSubscriptionActive — users need access here even after expiry

    def _get_assinatura(self):
        company = self.request.user.company
        return AssinaturaEmpresa.objects.get(company=company)

    @action(detail=False, methods=['get'])
    def status_assinatura(self, request):
        """GET /api/assinatura/status/ — Returns current subscription status."""
        try:
            assinatura = self._get_assinatura()
        except AssinaturaEmpresa.DoesNotExist:
            return Response({'detail': 'Assinatura não encontrada.'}, status=404)
        serializer = self.get_serializer(assinatura)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], throttle_classes=[PaymentRateThrottle])
    def assinar(self, request):
        """
        POST /api/assinatura/assinar/
        Único método suportado: Cartão de Crédito (recorrente, cobrado imediatamente).
        Body: { "plano_slug": "profissional", "ciclo": "MONTHLY",
                "billing_type": "CREDIT_CARD",
                "credit_card": { "holder_name", "number", "expiry_month", "expiry_year", "ccv" },
                "holder_info": { "name", "email", "cpf_cnpj", "phone", "postal_code", "address_number" } }
        """
        plano_slug = request.data.get('plano_slug')
        ciclo = request.data.get('ciclo', 'MONTHLY').upper()
        billing_type = request.data.get('billing_type', '').upper()

        if ciclo not in ('MONTHLY', 'YEARLY'):
            return Response({'detail': 'ciclo deve ser MONTHLY ou YEARLY.'}, status=400)
        if billing_type != 'CREDIT_CARD':
            return Response({'detail': 'Apenas pagamento via Cartão de Crédito é suportado.'}, status=400)

        try:
            plano = PlanoAssinatura.objects.get(slug=plano_slug, ativo=True)
        except PlanoAssinatura.DoesNotExist:
            return Response({'detail': 'Plano não encontrado.'}, status=400)

        company = request.user.company

        cpf_cnpj = (company.cnpj or company.cpf or '').strip()
        if not cpf_cnpj:
            return Response({'detail': 'CPF_CNPJ_MISSING'}, status=400)
        if not _is_valid_cpf_cnpj(cpf_cnpj):
            return Response({'detail': 'CPF/CNPJ da empresa inválido.'}, status=400)

        try:
            with transaction.atomic():
                try:
                    assinatura = AssinaturaEmpresa.objects.select_for_update().get(company=company)
                except AssinaturaEmpresa.DoesNotExist:
                    assinatura = AssinaturaEmpresa.objects.create(
                        company=company,
                        trial_fim=timezone.now(),
                        status='trial',
                    )
                    assinatura = AssinaturaEmpresa.objects.select_for_update().get(pk=assinatura.pk)

                # Ensure Asaas customer exists
                if not assinatura.asaas_customer_id:
                    asaas_customer_id = criar_cliente_asaas(company)
                    assinatura.asaas_customer_id = asaas_customer_id
                    assinatura.save(update_fields=['asaas_customer_id'])
                else:
                    try:
                        atualizar_cliente_asaas(assinatura.asaas_customer_id, company)
                    except HTTPError as e:
                        if e.response is not None and e.response.status_code == 404:
                            logger.warning(f'Customer {assinatura.asaas_customer_id} not found in Asaas, creating new.')
                            new_id = criar_cliente_asaas(company)
                            assinatura.asaas_customer_id = new_id
                            assinatura.save(update_fields=['asaas_customer_id'])
                        else:
                            raise

                # Cancel any existing pending/overdue Asaas subscription before creating a new one
                if assinatura.asaas_subscription_id and assinatura.status != 'active':
                    old_sub_id = assinatura.asaas_subscription_id
                    try:
                        cancelar_assinatura_asaas(old_sub_id)
                        logger.info(f'Cancelled stale subscription {old_sub_id} before re-subscribing.')
                    except Exception as cancel_err:
                        logger.warning(f'Could not cancel old subscription {old_sub_id}: {cancel_err}')

                    # Preserve the old ID in audit trail regardless of cancellation outcome.
                    ids_anteriores = list(assinatura.asaas_subscription_ids_anteriores or [])
                    if old_sub_id not in ids_anteriores:
                        ids_anteriores.append(old_sub_id)

                    assinatura.asaas_subscription_id = None
                    assinatura.asaas_subscription_ids_anteriores = ids_anteriores
                    assinatura.pending_plano = None
                    assinatura.pending_ciclo = None
                    assinatura.save(update_fields=[
                        'asaas_subscription_id',
                        'asaas_subscription_ids_anteriores',
                        'pending_plano',
                        'pending_ciclo',
                    ])

                credit_card = request.data.get('credit_card')
                holder_info = request.data.get('holder_info')

                if not credit_card or not holder_info:
                    return Response({'detail': 'Dados do cartão incompletos.'}, status=400)

                required_card = ['holder_name', 'number', 'expiry_month', 'expiry_year', 'ccv']
                if not all(credit_card.get(f) for f in required_card):
                    return Response({'detail': 'Dados do cartão incompletos.'}, status=400)

                required_holder = ['name', 'cpf_cnpj']
                if not all(holder_info.get(f) for f in required_holder):
                    return Response({'detail': 'Dados do titular incompletos.'}, status=400)
                if not _is_valid_cpf_cnpj(holder_info.get('cpf_cnpj')):
                    return Response({'detail': 'CPF/CNPJ do titular inválido.'}, status=400)

                # Use company email/phone as fallback for holder info
                holder_info.setdefault('email', company.email or '')
                holder_info.setdefault('phone', company.telefone or '')

                try:
                    result = criar_assinatura_cartao_asaas(
                        assinatura.asaas_customer_id, plano, ciclo, credit_card, holder_info
                    )
                except HTTPError as e:
                    # Asaas rejects charges for removed customers — recreate and retry once
                    if e.response is not None and e.response.status_code == 400:
                        body = e.response.text.lower()
                        if 'removido' in body or 'removed' in body:
                            logger.warning(f'Customer {assinatura.asaas_customer_id} is removed in Asaas, recreating.')
                            new_id = criar_cliente_asaas(company)
                            assinatura.asaas_customer_id = new_id
                            assinatura.save(update_fields=['asaas_customer_id'])
                            result = criar_assinatura_cartao_asaas(
                                new_id, plano, ciclo, credit_card, holder_info
                            )
                        else:
                            raise
                    else:
                        raise

                # Activate immediately — Asaas charges the card synchronously
                today = timezone.localdate()
                assinatura.asaas_subscription_id = result['id']
                assinatura.plano = plano
                assinatura.ciclo = ciclo
                assinatura.status = 'active'
                assinatura.pending_plano = None
                assinatura.pending_ciclo = None
                # Next billing: ~1 month/year from today (matches nextDueDate sent to Asaas)
                if ciclo == 'YEARLY':
                    assinatura.proxima_cobranca = _add_one_year_safe(today)
                else:
                    assinatura.proxima_cobranca = _add_one_month_safe(today)
                # Store card summary returned by Asaas
                card_info = result.get('creditCard') or {}
                if card_info.get('creditCardNumber'):
                    assinatura.card_last_four = card_info.get('creditCardNumber')
                    assinatura.card_brand = card_info.get('creditCardBrand') or None
                assinatura.save()

            return Response({'success': True, 'asaas_subscription_id': result['id']})

        except HTTPError as e:
            logger.warning(f'Erro HTTP no gateway Asaas ao criar assinatura: {e}')
            if e.response is not None and 400 <= e.response.status_code < 500:
                try:
                    asaas_errors = e.response.json().get('errors', [])
                    if asaas_errors:
                        msg = asaas_errors[0].get('description', 'Erro no gateway de pagamento.')
                        return Response({'detail': msg}, status=400)
                except Exception:
                    pass
            return Response({'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'}, status=503)
        except RequestException as e:
            logger.warning(f'Falha de comunicação com Asaas ao criar assinatura: {e}')
            return Response({'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'}, status=503)
        except Exception as e:
            logger.error(f'Erro inesperado ao criar assinatura: {e}')
            return Response({'detail': 'Erro ao processar assinatura. Verifique os dados e tente novamente.'}, status=500)

    @action(detail=False, methods=['get'])
    def link_pagamento(self, request):
        """GET /api/assinatura/link_pagamento/ — Returns the pending payment URL for an overdue subscription."""
        try:
            assinatura = self._get_assinatura()
        except AssinaturaEmpresa.DoesNotExist:
            return Response({'detail': 'Assinatura não encontrada.'}, status=404)

        if assinatura.status != 'overdue' and not assinatura.pending_plano:
            return Response({'detail': 'Assinatura não está em atraso.'}, status=400)

        if not assinatura.asaas_subscription_id:
            return Response({'detail': 'ID de assinatura não disponível.'}, status=400)

        try:
            from ..asaas_service import obter_url_pagamento_assinatura
            url = obter_url_pagamento_assinatura(assinatura.asaas_subscription_id)
            if not url:
                return Response({'detail': 'Link de pagamento não disponível.'}, status=404)
            return Response({'payment_url': url})
        except RequestException as e:
            logger.warning(f'Falha de comunicação com Asaas ao obter link de pagamento: {e}')
            return Response({'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'}, status=503)
        except Exception as e:
            logger.error(f'Erro ao obter link de pagamento: {e}')
            return Response({'detail': 'Erro ao buscar link de pagamento.'}, status=500)

    @action(detail=False, methods=['get'])
    def pagamentos(self, request):
        """GET /api/assinatura/pagamentos/ — Returns payment history from Asaas."""
        try:
            assinatura = self._get_assinatura()
        except AssinaturaEmpresa.DoesNotExist:
            return Response({'detail': 'Assinatura não encontrada.'}, status=404)

        all_ids = []
        if assinatura.asaas_subscription_id:
            all_ids.append(assinatura.asaas_subscription_id)
        for prev_id in (assinatura.asaas_subscription_ids_anteriores or []):
            if prev_id not in all_ids:
                all_ids.append(prev_id)

        if not all_ids:
            return Response([])

        try:
            from ..asaas_service import listar_pagamentos_assinatura
            all_pagamentos = []
            for sub_id in all_ids:
                try:
                    pagamentos = listar_pagamentos_assinatura(sub_id)
                    all_pagamentos.extend(pagamentos)
                except RequestException as sub_e:
                    logger.warning(f'Erro de comunicação ao buscar pagamentos da assinatura {sub_id}: {sub_e}')
                except Exception as sub_e:
                    logger.warning(f'Erro ao buscar pagamentos da assinatura {sub_id}: {sub_e}')
            all_pagamentos.sort(key=lambda p: p.get('dueDate', ''), reverse=True)
            return Response(all_pagamentos[:20])
        except RequestException as e:
            logger.warning(f'Falha de comunicação com Asaas ao buscar histórico de pagamentos: {e}')
            return Response({'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'}, status=503)
        except Exception as e:
            logger.error(f'Erro ao buscar histórico de pagamentos: {e}')
            return Response({'detail': 'Erro ao buscar histórico de pagamentos.'}, status=500)

    @action(detail=False, methods=['post'])
    def cancelar(self, request):
        """
        POST /api/assinatura/cancelar/ — Cancels the subscription in Asaas immediately,
        then marks it locally as cancelled. Access remains until proxima_cobranca.
        """
        try:
            assinatura = self._get_assinatura()
        except AssinaturaEmpresa.DoesNotExist:
            return Response({'detail': 'Assinatura não encontrada.'}, status=404)

        if assinatura.status not in ('active', 'overdue'):
            return Response({'detail': 'Sem assinatura ativa para cancelar.'}, status=400)

        if assinatura.asaas_subscription_id:
            try:
                cancelar_assinatura_asaas(assinatura.asaas_subscription_id)
            except RequestException as e:
                logger.warning(f'Falha de comunicação com Asaas ao cancelar assinatura: {e}')
                return Response(
                    {'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'},
                    status=503,
                )
            except HTTPError as e:
                logger.warning(f'Erro HTTP no Asaas ao cancelar assinatura: {e}')
                return Response(
                    {'detail': 'Não foi possível cancelar a assinatura no gateway de pagamento. Tente novamente.'},
                    status=502,
                )

        assinatura.status = 'cancelled'
        assinatura.save(update_fields=['status'])
        return Response({'detail': 'Assinatura cancelada. Seu acesso continua até o fim do período pago.'})

    @action(detail=False, methods=['post'])
    def reativar(self, request):
        """
        POST /api/assinatura/reativar/
        Reactivates a cancelled subscription that still has access (proxima_cobranca in the future).
        Re-creates the subscription in Asaas starting from proxima_cobranca (no immediate charge).
        """
        from datetime import date
        try:
            assinatura = self._get_assinatura()
        except AssinaturaEmpresa.DoesNotExist:
            return Response({'detail': 'Assinatura não encontrada.'}, status=404)

        if assinatura.status != 'cancelled':
            return Response({'detail': 'A assinatura não está cancelada.'}, status=400)

        if not assinatura.proxima_cobranca or assinatura.proxima_cobranca < date.today():
            return Response({'detail': 'O período pago já expirou. Assine um novo plano.'}, status=400)

        if not assinatura.plano:
            return Response({'detail': 'Plano não encontrado. Assine um novo plano.'}, status=400)

        if not assinatura.asaas_customer_id:
            return Response({'detail': 'Cliente não encontrado no gateway. Entre em contato com o suporte.'}, status=400)

        next_due_date = assinatura.proxima_cobranca.strftime('%Y-%m-%d')
        try:
            data = reativar_assinatura_asaas(
                assinatura.asaas_customer_id,
                assinatura.plano,
                assinatura.ciclo,
                next_due_date,
            )
        except RequestException as e:
            logger.warning(f'Falha de comunicação com Asaas ao reativar assinatura: {e}')
            return Response(
                {'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'},
                status=503,
            )
        except HTTPError as e:
            logger.warning(f'Erro HTTP no Asaas ao reativar assinatura: {e}')
            return Response(
                {'detail': 'Não foi possível reativar a assinatura no gateway de pagamento. Tente novamente.'},
                status=502,
            )

        # Preserve old subscription_id before overwriting
        old_sub_id = assinatura.asaas_subscription_id
        ids_anteriores = list(assinatura.asaas_subscription_ids_anteriores or [])
        if old_sub_id and old_sub_id not in ids_anteriores:
            ids_anteriores.append(old_sub_id)

        assinatura.asaas_subscription_id = data['id']
        assinatura.asaas_subscription_ids_anteriores = ids_anteriores
        assinatura.status = 'active'
        assinatura.save(update_fields=['status', 'asaas_subscription_id', 'asaas_subscription_ids_anteriores'])

        serializer = self.get_serializer(assinatura)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], throttle_classes=[PaymentRateThrottle])
    def atualizar_cartao(self, request):
        """
        POST /api/assinatura/atualizar_cartao/
        Updates the credit card used for the active subscription.
        Body: { credit_card: {...}, holder_info: {...} }
        """
        try:
            assinatura = self._get_assinatura()
        except AssinaturaEmpresa.DoesNotExist:
            return Response({'detail': 'Assinatura não encontrada.'}, status=404)

        if assinatura.status not in ('active', 'overdue'):
            return Response({'detail': 'Sem assinatura ativa para atualizar o cartão.'}, status=400)

        if not assinatura.asaas_subscription_id:
            return Response({'detail': 'ID de assinatura não disponível.'}, status=400)

        credit_card = request.data.get('credit_card')
        holder_info = request.data.get('holder_info')

        if not credit_card or not holder_info:
            return Response({'detail': 'Dados do cartão incompletos.'}, status=400)

        required_card = ['holder_name', 'number', 'expiry_month', 'expiry_year', 'ccv']
        if not all(credit_card.get(f) for f in required_card):
            return Response({'detail': 'Dados do cartão incompletos.'}, status=400)

        required_holder = ['name', 'cpf_cnpj']
        if not all(holder_info.get(f) for f in required_holder):
            return Response({'detail': 'Dados do titular incompletos.'}, status=400)
        if not _is_valid_cpf_cnpj(holder_info.get('cpf_cnpj')):
            return Response({'detail': 'CPF/CNPJ do titular inválido.'}, status=400)

        try:
            card_data = atualizar_cartao_assinatura(
                assinatura.asaas_subscription_id, credit_card, holder_info
            )
            card_info = card_data.get('creditCard') or card_data
            if card_info.get('creditCardNumber'):
                assinatura.card_last_four = card_info.get('creditCardNumber')
                assinatura.card_brand = card_info.get('creditCardBrand') or None
                assinatura.save(update_fields=['card_last_four', 'card_brand'])
            return Response({'success': True})
        except HTTPError as e:
            logger.warning(f'Erro HTTP no gateway Asaas ao atualizar cartão: {e}')
            if e.response is not None and 400 <= e.response.status_code < 500:
                try:
                    asaas_errors = e.response.json().get('errors', [])
                    if asaas_errors:
                        msg = asaas_errors[0].get('description', 'Erro no gateway de pagamento.')
                        return Response({'detail': msg}, status=400)
                except Exception:
                    pass
            return Response({'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'}, status=503)
        except RequestException as e:
            logger.warning(f'Falha de comunicação com Asaas ao atualizar cartão: {e}')
            return Response({'detail': 'Serviço de pagamento temporariamente indisponível. Tente novamente.'}, status=503)
        except Exception as e:
            logger.error(f'Erro inesperado ao atualizar cartão: {e}')
            return Response({'detail': 'Erro ao atualizar cartão. Verifique os dados e tente novamente.'}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    """
    POST /api/register/
    Cria uma nova empresa + usuário administrador e envia email de verificação.
    Body: { nome_empresa, cpf_cnpj, username, email, senha, nome? }
    """
    nome_empresa = (request.data.get('nome_empresa') or '').strip()
    cpf_cnpj     = (request.data.get('cpf_cnpj') or '').strip()
    username     = (request.data.get('username') or '').strip()
    email        = (request.data.get('email') or '').strip()
    senha        = (request.data.get('senha') or '').strip()
    nome         = (request.data.get('nome') or '').strip()

    errors = {}
    if not nome_empresa:
        errors['nome_empresa'] = 'Nome do escritório é obrigatório.'
    cpf_cnpj_digits = _normalize_digits(cpf_cnpj)
    if not cpf_cnpj_digits:
        errors['cpf_cnpj'] = 'CPF ou CNPJ é obrigatório.'
    elif not _is_valid_cpf_cnpj(cpf_cnpj_digits):
        errors['cpf_cnpj'] = 'CPF/CNPJ inválido.'
    if not username:
        errors['username'] = 'Nome de usuário é obrigatório.'
    elif CustomUser.objects.filter(username=username).exists():
        errors['username'] = 'Este nome de usuário já está em uso.'
    if not email:
        errors['email'] = 'E-mail é obrigatório.'
    elif CustomUser.objects.filter(email=email).exists():
        errors['email'] = 'Este e-mail já está cadastrado.'
    if not senha:
        errors['senha'] = 'Senha é obrigatória.'
    elif len(senha) < 8:
        errors['senha'] = 'A senha deve ter pelo menos 8 caracteres.'
    if errors:
        return Response(errors, status=400)

    try:
        company_data = {'name': nome_empresa}
        if len(cpf_cnpj_digits) == 14:
            company_data['cnpj'] = cpf_cnpj_digits
        else:
            company_data['cpf'] = cpf_cnpj_digits
        company = Company.objects.create(**company_data)

        first_name = nome.split()[0] if nome else ''
        last_name  = ' '.join(nome.split()[1:]) if nome and len(nome.split()) > 1 else ''

        user = CustomUser.objects.create_user(
            username=username,
            email=email,
            password=senha,
            company=company,
            first_name=first_name,
            last_name=last_name,
            is_email_verified=False,
        )

        # Envia email de verificação via Resend
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        verify_url = f"{django_settings.FRONTEND_URL}/verificar-email?uid={uid}&token={token}"

        resend.api_key = django_settings.RESEND_API_KEY
        resend.Emails.send({
            "from": "suporte@vincorapp.com.br",
            "to": [user.email],
            "subject": "Confirme seu email — Vincor",
            "html": f"""
            <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #1a1a2e; margin-bottom: 8px;">Bem-vindo ao Vincor!</h2>
              <p style="color: #444; line-height: 1.6;">
                Sua conta foi criada com sucesso. Clique no botão abaixo para confirmar seu email e ativar o acesso.
              </p>
              <a href="{verify_url}"
                 style="display: inline-block; margin: 24px 0; padding: 12px 28px;
                        background-color: #c9a84c; color: #fff; text-decoration: none;
                        border-radius: 6px; font-weight: 600;">
                Confirmar email
              </a>
              <p style="color: #888; font-size: 13px;">
                Este link expira em 1 hora. Se você não criou uma conta no Vincor, ignore este email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #aaa; font-size: 12px;">Vincor — Gestão financeira para escritórios de advocacia</p>
            </div>
            """,
        })

        return Response({"detail": "Conta criada! Verifique seu email para ativar o acesso."}, status=201)

    except Exception as e:
        logger.error(f'Erro ao registrar usuário: {e}')
        return Response({'detail': 'Erro ao criar conta. Tente novamente.'}, status=500)


@csrf_exempt
@require_POST
def asaas_webhook(request):
    """
    POST /api/asaas/webhook/
    Receives Asaas webhook events and updates subscription status accordingly.
    """
    token = (
        request.headers.get('asaas-access-token')
        or request.headers.get('x-asaas-access-token')
        or request.GET.get('token', '')
    )
    configured_token = (django_settings.ASAAS_WEBHOOK_TOKEN or '').strip()
    # Fail closed when webhook secret is not configured.
    if not configured_token:
        logger.error('Asaas webhook rejected: ASAAS_WEBHOOK_TOKEN not configured.')
        return JsonResponse({'detail': 'Unauthorized'}, status=401)
    if not token or not secrets.compare_digest(str(token), configured_token):
        return JsonResponse({'detail': 'Unauthorized'}, status=401)

    try:
        payload = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'detail': 'Invalid JSON'}, status=400)

    event_type = payload.get('event', '')
    subscription_id = (
        payload.get('payment', {}).get('subscription')
        or payload.get('subscription', {}).get('id')
        or ''
    )
    payment_id = payload.get('payment', {}).get('id', '')

    try:
        with transaction.atomic():
            already_processed = WebhookLog.objects.filter(
                event_type=event_type,
                asaas_payment_id=payment_id,
                processed=True,
            ).exists()
            if already_processed:
                return JsonResponse({'detail': 'already processed'}, status=200)

            log = WebhookLog.objects.create(
                event_type=event_type,
                asaas_subscription_id=subscription_id,
                asaas_payment_id=payment_id,
                payload=payload,
            )

            if subscription_id:
                assinatura = AssinaturaEmpresa.objects.select_for_update().filter(
                    asaas_subscription_id=subscription_id
                ).first()

                if assinatura:
                    if event_type == 'PAYMENT_RECEIVED':
                        import datetime as _dt
                        # Never restore access to a subscription the user explicitly cancelled.
                        if assinatura.status == 'cancelled':
                            logger.warning(
                                f'PAYMENT_RECEIVED for cancelled subscription '
                                f'{subscription_id} (company {assinatura.company_id}). '
                                f'Ignoring to preserve cancellation intent.'
                            )
                        else:
                            assinatura.status = 'active'
                            # Compute next billing date from current payment's dueDate
                            due_date_str = payload.get('payment', {}).get('dueDate')
                            if due_date_str:
                                try:
                                    due = _dt.date.fromisoformat(due_date_str)
                                    ciclo = (assinatura.pending_ciclo or assinatura.ciclo or 'MONTHLY')
                                    if ciclo == 'YEARLY':
                                        assinatura.proxima_cobranca = _add_one_year_safe(due)
                                    else:
                                        assinatura.proxima_cobranca = _add_one_month_safe(due)
                                except Exception:
                                    pass
                            if assinatura.pending_plano:
                                assinatura.plano = assinatura.pending_plano
                                assinatura.ciclo = assinatura.pending_ciclo or 'MONTHLY'
                                assinatura.pending_plano = None
                                assinatura.pending_ciclo = None
                                assinatura.save(update_fields=['status', 'plano', 'ciclo', 'pending_plano', 'pending_ciclo', 'proxima_cobranca'])
                            else:
                                assinatura.save(update_fields=['status', 'proxima_cobranca'])
                    elif event_type == 'PAYMENT_OVERDUE':
                        # Don't overwrite an intentional cancellation.
                        if assinatura.status != 'cancelled':
                            assinatura.status = 'overdue'
                            assinatura.save(update_fields=['status'])
                        else:
                            logger.info(
                                f'PAYMENT_OVERDUE ignored for already-cancelled '
                                f'subscription {subscription_id}.'
                            )
                    elif event_type == 'PAYMENT_REFUSED':
                        if assinatura.status != 'cancelled':
                            assinatura.status = 'payment_failed'
                            assinatura.save(update_fields=['status'])
                    elif event_type in ('SUBSCRIPTION_CANCELLED', 'SUBSCRIPTION_DELETED'):
                        assinatura.status = 'cancelled'
                        assinatura.asaas_subscription_id = None
                        assinatura.save(update_fields=['status', 'asaas_subscription_id'])

            log.processed = True
            log.save(update_fields=['processed'])
    except Exception as e:
        logger.error(f'Asaas webhook processing error: {e}')
        try:
            WebhookLog.objects.create(
                event_type=event_type,
                asaas_subscription_id=subscription_id,
                payload=payload,
                error=str(e),
            )
        except Exception:
            pass

    return JsonResponse({'received': True})
