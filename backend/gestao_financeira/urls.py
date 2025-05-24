from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

urlpatterns = [
    path("admin/", admin.site.urls),

    # Endpoints de autenticação JWT
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # API principal do projeto
    path("api/", include("core.urls")),

    # Login/logout do DRF no modo browsable API (opcional)
    path("api-auth/", include("rest_framework.urls", namespace="rest_framework")),
]
