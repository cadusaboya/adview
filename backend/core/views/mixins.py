import logging
import json
import secrets
from rest_framework import viewsets, permissions, status, generics, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.throttling import UserRateThrottle
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings as django_settings
from django.db import transaction
from requests.exceptions import RequestException, HTTPError

logger = logging.getLogger(__name__)
from django.db.models import Sum, Q, F, Case, When, IntegerField, Count, Prefetch, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.timezone import now
from datetime import date, datetime, timedelta
import decimal
from decimal import Decimal
from ..pagination import DynamicPageSizePagination
from django.shortcuts import get_object_or_404
from ..models import Company, CustomUser, Cliente, Funcionario, Receita, ReceitaRecorrente, Despesa, DespesaRecorrente, Payment, ContaBancaria, Custodia, Transfer, Allocation, PlanoAssinatura, AssinaturaEmpresa, WebhookLog
from ..serializers import (
    CompanySerializer, CustomUserSerializer, ClienteSerializer,
    FuncionarioSerializer, ReceitaSerializer, ReceitaAbertaSerializer, ReceitaRecorrenteSerializer, DespesaSerializer, DespesaAbertaSerializer,
    DespesaRecorrenteSerializer, PaymentSerializer, ContaBancariaSerializer, CustodiaSerializer, TransferSerializer, AllocationSerializer,
    PlanoAssinaturaSerializer, AssinaturaEmpresaSerializer,
)
from ..permissions import IsSubscriptionActive
from ..asaas_service import criar_cliente_asaas, atualizar_cliente_asaas, criar_assinatura_cartao_asaas, atualizar_cartao_assinatura, cancelar_assinatura_asaas, reativar_assinatura_asaas


def _add_one_year_safe(base_date):
    """Adds one year preserving day when possible, clamping to month end otherwise."""
    import calendar

    target_year = base_date.year + 1
    last_day = calendar.monthrange(target_year, base_date.month)[1]
    return base_date.replace(year=target_year, day=min(base_date.day, last_day))


def _add_one_month_safe(base_date):
    """Adds one month preserving day when possible, clamping to month end otherwise."""
    import calendar

    month = base_date.month % 12 + 1
    year = base_date.year + (base_date.month // 12)
    last_day = calendar.monthrange(year, month)[1]
    return base_date.replace(year=year, month=month, day=min(base_date.day, last_day))


def _normalize_digits(value: str) -> str:
    return ''.join(ch for ch in str(value or '') if ch.isdigit())


def _is_valid_cpf(cpf: str) -> bool:
    cpf = _normalize_digits(cpf)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False

    total = sum(int(cpf[i]) * (10 - i) for i in range(9))
    first_digit = ((total * 10) % 11) % 10
    if first_digit != int(cpf[9]):
        return False

    total = sum(int(cpf[i]) * (11 - i) for i in range(10))
    second_digit = ((total * 10) % 11) % 10
    return second_digit == int(cpf[10])


def _is_valid_cnpj(cnpj: str) -> bool:
    cnpj = _normalize_digits(cnpj)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False

    weights_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    total = sum(int(cnpj[i]) * weights_1[i] for i in range(12))
    remainder = total % 11
    first_digit = 0 if remainder < 2 else 11 - remainder
    if first_digit != int(cnpj[12]):
        return False

    weights_2 = [6] + weights_1
    total = sum(int(cnpj[i]) * weights_2[i] for i in range(13))
    remainder = total % 11
    second_digit = 0 if remainder < 2 else 11 - remainder
    return second_digit == int(cnpj[13])


def _is_valid_cpf_cnpj(value: str) -> bool:
    digits = _normalize_digits(value)
    if len(digits) == 11:
        return _is_valid_cpf(digits)
    if len(digits) == 14:
        return _is_valid_cnpj(digits)
    return False


class PaymentRateThrottle(UserRateThrottle):
    scope = 'payment'


# --- Base ViewSet for Company context ---
class CompanyScopedViewSetMixin:
    """Mixin to scope querysets and creation to the user's company."""
    permission_classes = [permissions.IsAuthenticated, IsSubscriptionActive]

    def get_queryset(self):
        """Filter queryset to only include objects belonging to the user's company."""
        user = self.request.user
        if user.is_superuser:
            # Superusers can see all companies' data (adjust if needed)
            return self.queryset.all()
        if hasattr(user, 'company') and user.company:
            return self.queryset.filter(company=user.company)
        # If user has no company, they see nothing (or handle as error)
        return self.queryset.none()

    def perform_create(self, serializer):
        """Automatically assign the user's company during creation."""
        user = self.request.user
        if hasattr(user, 'company') and user.company:
            serializer.save(company=user.company)
        elif self.request.data.get('company_id') and user.is_superuser:
             # Allow superuser to specify company
             company = Company.objects.get(pk=self.request.data.get('company_id'))
             serializer.save(company=company)
        else:
            # Handle cases where company cannot be determined (e.g., raise validation error)
            # This depends on specific requirements for users without companies
            # For now, assume authenticated users must have a company unless superuser
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("User must belong to a company to create this object.")

    def get_serializer_context(self):
        """Add request to the serializer context."""
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context
