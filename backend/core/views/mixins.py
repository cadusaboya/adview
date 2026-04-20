import logging
from rest_framework import permissions
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from ..models import Company
from ..permissions import IsSubscriptionActive

logger = logging.getLogger(__name__)


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


def normalize_money_search(s: str) -> str:
    """Converte um termo de busca monetário em formato BR para o formato
    armazenado no banco (ex.: "1.500,00" → "1500.00", "R$ 1500" → "1500",
    "1.500" → "1500").

    Mantém strings que não parecem valores (sem dígitos) inalteradas para não
    quebrar buscas textuais.
    """
    if not s:
        return s
    raw = str(s).strip().replace('R$', '').replace(' ', '')
    if not any(ch.isdigit() for ch in raw):
        return s
    if ',' in raw:
        # Vírgula é separador decimal; pontos são separadores de milhar
        return raw.replace('.', '').replace(',', '.')
    if '.' in raw:
        # Sem vírgula: pontos são separadores de milhar em BR se cada grupo
        # após o primeiro tem exatamente 3 dígitos (ex.: 1.500, 12.345.678).
        parts = raw.split('.')
        if all(p.isdigit() for p in parts) and all(len(p) == 3 for p in parts[1:]):
            return raw.replace('.', '')
    return raw


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


class AuthThrottle(AnonRateThrottle):
    scope = 'anon_auth'


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
