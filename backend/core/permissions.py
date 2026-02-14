from rest_framework.permissions import BasePermission
from rest_framework.exceptions import APIException
from rest_framework import status as drf_status


class PaymentRequired(APIException):
    status_code = 402
    default_detail = 'Sua assinatura está inativa ou expirada. Acesse /assinar para continuar.'
    default_code = 'subscription_required'


class IsSubscriptionActive(BasePermission):
    """
    Blocks access (HTTP 402) when the company's trial has expired or
    the subscription is cancelled/overdue/expired.

    Superusers and unauthenticated requests (handled by IsAuthenticated) bypass this check.
    """
    message = 'Sua assinatura está inativa ou expirada.'

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return True  # IsAuthenticated handles this separately

        if user.is_superuser:
            return True

        company = getattr(user, 'company', None)
        if not company:
            return True

        try:
            assinatura = company.assinatura
        except Exception:
            # No AssinaturaEmpresa row — allow access (backfill may not have run yet)
            return True

        if assinatura.acesso_permitido:
            return True

        raise PaymentRequired()
