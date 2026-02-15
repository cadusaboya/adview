from django.db import models
from django.db.models import Sum
from django.utils import timezone
from decimal import Decimal
from .identity import Company
from .people import Cliente


class Receita(models.Model):
    FORMA_CHOICES = (
        ('P', 'Pix'),
        ('B', 'Boleto'),
    )
    TIPO_CHOICES = (
        ('F', 'Receita Fixa'),
        ('V', 'Receita Variável'),
        ('E', 'Estorno'),
    )
    SITUACAO_CHOICES = (
        ('P', 'Paga'),
        ('A', 'Em Aberto'),
        ('V', 'Vencida'),
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT)
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(blank=True, null=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    valor_pago = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    forma_pagamento = models.CharField(max_length=1, choices=FORMA_CHOICES, blank=True, null=True)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES)
    situacao = models.CharField(max_length=1, choices=SITUACAO_CHOICES, default='A')

    def __str__(self):
        return f'{self.nome} - {self.cliente.nome}'

    def atualizar_status(self):
        total_pago = self.allocations.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if total_pago >= self.valor:
            self.situacao = 'P'
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.situacao = 'V'
        else:
            self.situacao = 'A'

        self.save()


class ReceitaComissao(models.Model):
    """Regra de comissão específica de uma Receita (sobrescreve as do cliente)."""
    receita = models.ForeignKey('Receita', on_delete=models.CASCADE, related_name='comissoes')
    funcionario = models.ForeignKey(
        'Funcionario',
        on_delete=models.CASCADE,
        limit_choices_to={'tipo__in': ['F', 'P']},
        verbose_name='Comissionado'
    )
    percentual = models.DecimalField(max_digits=5, decimal_places=2, help_text='Percentual de comissão (%)')

    class Meta:
        unique_together = ('receita', 'funcionario')
        verbose_name = 'Comissão da Receita'
        verbose_name_plural = 'Comissões da Receita'

    def __str__(self):
        return f'{self.funcionario.nome} — {self.percentual}% ({self.receita.nome})'


class ReceitaRecorrente(models.Model):
    """Receitas que se repetem mensalmente (honorários fixos, mensalidades, etc.)"""

    TIPO_CHOICES = (
        ('F', 'Receita Fixa'),
        ('V', 'Receita Variável'),
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
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        help_text="Cliente da receita"
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
        return f'{self.nome} - {self.cliente.nome}'

    class Meta:
        verbose_name = 'Receita Recorrente'
        verbose_name_plural = 'Receitas Recorrentes'
        ordering = ['nome']


class ReceitaRecorrenteComissao(models.Model):
    """Regra de comissão específica de uma ReceitaRecorrente (sobrescreve as do cliente)."""
    receita_recorrente = models.ForeignKey('ReceitaRecorrente', on_delete=models.CASCADE, related_name='comissoes')
    funcionario = models.ForeignKey(
        'Funcionario',
        on_delete=models.CASCADE,
        limit_choices_to={'tipo__in': ['F', 'P']},
        verbose_name='Comissionado'
    )
    percentual = models.DecimalField(max_digits=5, decimal_places=2, help_text='Percentual de comissão (%)')

    class Meta:
        unique_together = ('receita_recorrente', 'funcionario')
        verbose_name = 'Comissão da Receita Recorrente'
        verbose_name_plural = 'Comissões da Receita Recorrente'

    def __str__(self):
        return f'{self.funcionario.nome} — {self.percentual}% ({self.receita_recorrente.nome})'
