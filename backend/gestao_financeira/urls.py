from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model


class CustomTokenObtainPairView(APIView):
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        User = get_user_model()
        username = request.data.get("username", "")
        password = request.data.get("password", "")

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response(
                {"detail": "Usuário não encontrado."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.check_password(password):
            return Response(
                {"detail": "Senha incorreta."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        serializer = TokenObtainPairSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except (InvalidToken, AuthenticationFailed) as e:
            return Response({"detail": str(e)}, status=status.HTTP_401_UNAUTHORIZED)

        return Response(serializer.validated_data, status=status.HTTP_200_OK)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Endpoints de autenticação JWT
    path("api/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # API principal do projeto
    path("api/", include("core.urls")),

    # Login/logout do DRF no modo browsable API (opcional)
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]
