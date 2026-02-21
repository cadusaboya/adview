from rest_framework import viewsets, permissions, serializers
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.tokens import default_token_generator, PasswordResetTokenGenerator


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Token generator exclusivo para verificação de email.
    Não inclui user.password no hash, então um reset de senha não invalida
    o link de verificação de email enviado no cadastro.
    Inclui is_email_verified para que o token expire após o uso.
    """
    def _make_hash_value(self, user, timestamp):
        return f"{user.pk}{timestamp}{user.is_email_verified}"


email_verification_token = EmailVerificationTokenGenerator()
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
import resend
from .mixins import CompanyScopedViewSetMixin, AuthThrottle
from ..models import Company, CustomUser
from ..serializers import CompanySerializer, CustomUserSerializer


# --- ViewSets ---

class CompanyViewSet(viewsets.ModelViewSet):
    """API endpoint for Companies. Accessible only by superusers for management."""
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    # Typically, only superusers should manage companies
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """
        GET /api/companies/me/ - Returns the authenticated user's company
        PATCH /api/companies/me/ - Updates the authenticated user's company
        """
        user = request.user

        if not hasattr(user, 'company') or not user.company:
            return Response(
                {"detail": "User does not belong to a company."},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method == 'GET':
            serializer = self.get_serializer(user.company)
            return Response(serializer.data)

        elif request.method == 'PATCH':
            serializer = self.get_serializer(
                user.company,
                data=request.data,
                partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

class CustomUserViewSet(viewsets.ModelViewSet):
    """API endpoint for Users. Allows creation and management within a company context."""
    queryset = CustomUser.objects.none()
    serializer_class = CustomUserSerializer
    permission_classes = [permissions.IsAuthenticated] # Start with authenticated, refine later if needed

    def get_queryset(self):
        """Users can see other users in their own company. Superusers see all."""
        user = self.request.user
        if user.is_superuser:
            return CustomUser.objects.all()
        if hasattr(user, 'company') and user.company:
            # Users can see/manage others in the same company
            return CustomUser.objects.filter(company=user.company)
        # Users without a company or not superuser might only see themselves
        # return CustomUser.objects.filter(pk=user.pk) # Or return none()
        return CustomUser.objects.none()

    def perform_create(self, serializer):
        """Assign company based on creating user, allow superuser override."""
        user = self.request.user
        company_id = self.request.data.get('company_id')

        target_company = None
        if user.is_superuser and company_id:
            try:
                target_company = Company.objects.get(pk=company_id)
            except Company.DoesNotExist:
                 raise serializers.ValidationError({"company_id": "Invalid company specified."})
        elif hasattr(user, 'company') and user.company:
            target_company = user.company

        # We must set the company before validating the serializer if it relies on it
        # Or pass it in context. Here, we save with the determined company.
        if target_company:
             serializer.save(company=target_company, is_email_verified=True)
        else:
             # Non-superuser without a company cannot create users for other companies
             # Or maybe allow creating users without company? Depends on rules.
             # For now, assume users must belong to a company if created by non-superuser
             if not user.is_superuser:
                 from rest_framework.exceptions import PermissionDenied
                 raise PermissionDenied("You must belong to a company to create users.")
             else:
                 # Superuser creating user without company
                 serializer.save(company=None, is_email_verified=True)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def password_reset_request(request):
    """
    POST /api/password-reset/
    Body: { "email": "user@example.com" }
    Envia um email com link de redefinição via Resend.
    Sempre retorna 200 para não revelar se o email existe.
    """
    email = request.data.get('email', '').strip().lower()
    if email:
        try:
            user = CustomUser.objects.get(email__iexact=email)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/redefinir-senha?uid={uid}&token={token}"

            resend.api_key = settings.RESEND_API_KEY
            resend.Emails.send({
                "from": "suporte@vincorapp.com.br",
                "to": [user.email],
                "subject": "Redefinição de senha — Vincor",
                "html": f"""
                <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
                  <h2 style="color: #1a1a2e; margin-bottom: 8px;">Redefinição de senha</h2>
                  <p style="color: #444; line-height: 1.6;">
                    Recebemos uma solicitação para redefinir a senha da sua conta no Vincor.
                    Clique no botão abaixo para criar uma nova senha.
                  </p>
                  <a href="{reset_url}"
                     style="display: inline-block; margin: 24px 0; padding: 12px 28px;
                            background-color: #c9a84c; color: #fff; text-decoration: none;
                            border-radius: 6px; font-weight: 600;">
                    Redefinir senha
                  </a>
                  <p style="color: #888; font-size: 13px;">
                    Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este email.
                  </p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                  <p style="color: #aaa; font-size: 12px;">Vincor — Gestão financeira para escritórios de advocacia</p>
                </div>
                """,
            })
        except CustomUser.DoesNotExist:
            pass  # Não revelar se o email existe

    return Response({"detail": "Se esse email estiver cadastrado, você receberá um link em breve."}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def password_reset_confirm(request):
    """
    POST /api/password-reset/confirm/
    Body: { "uid": "...", "token": "...", "password": "novasenha" }
    Valida o token e redefine a senha.
    """
    uid = request.data.get('uid', '')
    token = request.data.get('token', '')
    password = request.data.get('password', '')

    if not uid or not token or not password:
        return Response({"detail": "Dados incompletos."}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 8:
        return Response({"detail": "A senha deve ter pelo menos 8 caracteres."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pk = force_str(urlsafe_base64_decode(uid))
        user = CustomUser.objects.get(pk=pk)
    except (CustomUser.DoesNotExist, ValueError, TypeError):
        return Response({"detail": "Link inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({"detail": "Link inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(password)
    user.is_email_verified = True
    user.save()
    return Response({"detail": "Senha redefinida com sucesso."}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthThrottle])
def verify_email(request):
    """
    POST /api/verify-email/
    Body: { "uid": "...", "token": "..." }
    Valida o token e marca o email como verificado.
    """
    uid = request.data.get('uid', '')
    token = request.data.get('token', '')

    if not uid or not token:
        return Response({"detail": "Dados incompletos."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        pk = force_str(urlsafe_base64_decode(uid))
        user = CustomUser.objects.get(pk=pk)
    except (CustomUser.DoesNotExist, ValueError, TypeError):
        return Response({"detail": "Link inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

    if not email_verification_token.check_token(user, token):
        return Response({"detail": "Link inválido ou expirado."}, status=status.HTTP_400_BAD_REQUEST)

    if not user.is_email_verified:
        user.is_email_verified = True
        user.save(update_fields=['is_email_verified'])

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "detail": "Email confirmado com sucesso.",
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        },
        status=status.HTTP_200_OK,
    )
