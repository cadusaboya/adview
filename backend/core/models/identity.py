from django.db import models
from django.contrib.auth.models import AbstractUser
from decimal import Decimal


class Company(models.Model):
    name = models.CharField(max_length=255)

    # 🔹 Identificação legal
    cnpj = models.CharField(max_length=18, blank=True, null=True)
    cpf = models.CharField(max_length=14, blank=True, null=True)

    # 🔹 Endereço
    endereco = models.CharField(max_length=255, blank=True, null=True)
    cidade = models.CharField(max_length=100, blank=True, null=True)
    estado = models.CharField(max_length=2, blank=True, null=True)

    # 🔹 Contato (opcional mas profissional)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)

    # 🔹 Identidade visual
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)

    # 🔹 Configurações financeiras
    percentual_comissao = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('20.00'),
        help_text='Percentual de comissão sobre receitas (padrão: 20%)'
    )

    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CustomUser(AbstractUser):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, null=True, blank=True)

    groups = models.ManyToManyField(
        'auth.Group',
        verbose_name='groups',
        blank=True,
        help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
        related_name="customuser_set",
        related_query_name="user",
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        verbose_name='user permissions',
        blank=True,
        help_text='Specific permissions for this user.',
        related_name="customuser_set",
        related_query_name="user",
    )

    def __str__(self):
        return self.username
