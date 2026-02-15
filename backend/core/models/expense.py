from django.db import models
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal
from .identity import Company
from .people import Funcionario
from .revenue import Receita


class Despesa(models.Model):
    TIPO_CHOICES = (
        ('F', 'Despesa Fixa'),
        ('V', 'Despesa Variável'),
        ('C', 'Comissionamento'),
        ('R', 'Reembolso'),
    )
    SITUACAO_CHOICES = (
        ('P', 'Paga'),
        ('A', 'Em Aberto'),
        ('V', 'Vencida'),
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    responsavel = models.ForeignKey(Funcionario, on_delete=models.PROTECT)
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(blank=True, null=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    valor_pago = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES)
    situacao = models.CharField(max_length=1, choices=SITUACAO_CHOICES, default='A')
    receita_origem = models.ForeignKey(
        Receita,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='despesas_comissao'
    )

    def __str__(self):
        return f'{self.nome} - {self.responsavel.nome}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def atualizar_status(self):
        total_pago = self.allocations.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if total_pago >= self.valor:
            self.situacao = 'P'
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.situacao = 'V'
        else:
            self.situacao = 'A'

        self.save()


class DespesaRecorrente(models.Model):
    """Despesas que se repetem mensalmente (salários, aluguéis, etc.)"""

    TIPO_CHOICES = (
        ('F', 'Despesa Fixa'),
        ('V', 'Despesa Variável'),
    )

    STATUS_CHOICES = (
        ('A', 'Ativa'),
        ('P', 'Pausada'),
    )

    FORMA_CHOICES = (
        ('P', 'Pix'),
        ('B', 'Boleto'),
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    responsavel = models.ForeignKey(
        Funcionario,
        on_delete=models.PROTECT,
        help_text="Favorecido da despesa"
    )
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES, default='F')
    forma_pagamento = models.CharField(max_length=1, choices=FORMA_CHOICES, blank=True, null=True)
    data_inicio = models.DateField(help_text="Data da primeira ocorrência")
    data_fim = models.DateField(null=True, blank=True, help_text="Data da última ocorrência (opcional)")
    dia_vencimento = models.IntegerField(default=1, help_text="Dia do mês para vencimento (1-31)")
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default='A')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.nome} - {self.responsavel.nome}'

    class Meta:
        verbose_name = 'Despesa Recorrente'
        verbose_name_plural = 'Despesas Recorrentes'
        ordering = ['nome']
