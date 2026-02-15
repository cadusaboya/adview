from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Company, CustomUser


class APITestBase(TestCase):
    password = "Senha@1234"

    def setUp(self):
        self.client = APIClient()

        self.company = Company.objects.create(name="Empresa A", cnpj="11.222.333/0001-81")
        self.user = CustomUser.objects.create_user(
            username="user_a",
            email="a@empresa.com",
            password=self.password,
            company=self.company,
        )

        self.company_b = Company.objects.create(name="Empresa B", cnpj="22.333.444/0001-82")
        self.user_b = CustomUser.objects.create_user(
            username="user_b",
            email="b@empresa.com",
            password=self.password,
            company=self.company_b,
        )

        self.client.force_authenticate(user=self.user)

    def auth_as(self, user):
        self.client.force_authenticate(user=user)

    def unauth(self):
        self.client.force_authenticate(user=None)

    @staticmethod
    def results(response):
        data = response.json() if hasattr(response, "json") else response.data
        if isinstance(data, dict) and "results" in data:
            return data["results"]
        return data

    def jwt_client(self, user=None, password=None):
        user = user or self.user
        password = password or self.password
        c = APIClient()
        token_resp = c.post(
            "/api/token/",
            {"username": user.username, "password": password},
            format="json",
        )
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {token_resp.data['access']}")
        return c
