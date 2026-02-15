from django.db import models
from decimal import Decimal
from django.db.models import Sum
from .identity import Company


class ContaBancaria(models.Model):
    company = models.ForeignKey('Company', on_delete=models.CASCADE)
    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True, null=True)
    saldo_atual = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conta Bancária"
        verbose_name_plural = "Contas Bancárias"

    def __str__(self):
        return self.nome


class Payment(models.Model):
    """
    Pagamento neutro que representa entrada ou saída de caixa.
    A alocação para Receitas/Despesas/Passivos é feita via modelo Allocation.
    """
    TIPO_CHOICES = (
        ('E', 'Entrada'),
        ('S', 'Saída'),
    )

    company = models.ForeignKey('Company', on_delete=models.CASCADE)
    conta_bancaria = models.ForeignKey('ContaBancaria', on_delete=models.PROTECT, related_name='payments')
    tipo = models.CharField(
        max_length=1,
        choices=TIPO_CHOICES,
        help_text="Tipo de movimentação: Entrada (recebimento) ou Saída (pagamento)"
    )
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data_pagamento = models.DateField()
    observacao = models.TextField(blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        tipo_display = "Entrada" if self.tipo == 'E' else "Saída"
        return f"{tipo_display} de R$ {self.valor} em {self.data_pagamento}"

    class Meta:
        verbose_name = "Pagamento"
        verbose_name_plural = "Pagamentos"
        ordering = ['-data_pagamento', '-criado_em']


class Transfer(models.Model):
    """
    Representa transferências entre contas bancárias.
    Status é calculado baseado nas alocações de pagamentos:
    - Pendente: sem allocations vinculadas
    - Mismatch: soma das saídas ≠ soma das entradas
    - Completo: saídas = entradas
    """
    STATUS_CHOICES = (
        ('P', 'Pendente'),
        ('M', 'Mismatch'),
        ('C', 'Completo'),
    )

    company = models.ForeignKey('Company', on_delete=models.CASCADE)
    from_bank = models.ForeignKey(
        'ContaBancaria',
        on_delete=models.PROTECT,
        related_name='transfers_out',
        verbose_name='Banco de Origem'
    )
    to_bank = models.ForeignKey(
        'ContaBancaria',
        on_delete=models.PROTECT,
        related_name='transfers_in',
        verbose_name='Banco de Destino'
    )
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data_transferencia = models.DateField()
    descricao = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default='P')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Transferência"
        verbose_name_plural = "Transferências"
        ordering = ['-data_transferencia', '-criado_em']

    def __str__(self):
        return f"Transferência de {self.from_bank.nome} para {self.to_bank.nome} - R$ {self.valor}"

    def atualizar_status(self):
        total_saidas = self.allocations.filter(
            payment__tipo='S'
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        total_entradas = self.allocations.filter(
            payment__tipo='E'
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if total_saidas == Decimal('0.00') and total_entradas == Decimal('0.00'):
            self.status = 'P'
        elif total_saidas == total_entradas:
            self.status = 'C'
        else:
            self.status = 'M'

        self.save()
