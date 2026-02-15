from django.db import models
from django.db.models import Sum
from django.core.exceptions import ValidationError
from decimal import Decimal
from .identity import Company


class Custodia(models.Model):
    """
    Representa valores de terceiros (ativos e passivos de custódia).
    - Passivo: valores que a empresa deve repassar a terceiros
    - Ativo: valores que terceiros devem à empresa
    """
    TIPO_CHOICES = (
        ('P', 'Passivo'),
        ('A', 'Ativo'),
    )

    STATUS_CHOICES = (
        ('A', 'Aberto'),
        ('P', 'Parcial'),
        ('L', 'Liquidado'),
    )

    company = models.ForeignKey('Company', on_delete=models.CASCADE)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES, default='P')
    cliente = models.ForeignKey(
        'Cliente',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='custodias',
        help_text="Cliente relacionado à custódia"
    )
    funcionario = models.ForeignKey(
        'Funcionario',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='custodias',
        help_text="Funcionário/Fornecedor/Parceiro relacionado à custódia"
    )
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    valor_total = models.DecimalField(max_digits=10, decimal_places=2)
    valor_liquidado = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default='A')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Custódia"
        verbose_name_plural = "Custódias"
        ordering = ['-criado_em']
        db_table = 'core_passivo'

    def __str__(self):
        pessoa = self.cliente.nome if self.cliente else (self.funcionario.nome if self.funcionario else 'Sem pessoa')
        tipo_display = 'Passivo' if self.tipo == 'P' else 'Ativo'
        return f'{self.nome} ({tipo_display}) - {pessoa}'

    def atualizar_status(self):
        total_entradas = self.allocations.filter(
            payment__tipo='E'
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        total_saidas = self.allocations.filter(
            payment__tipo='S'
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if self.tipo == 'P':
            self.valor_liquidado = min(total_entradas, total_saidas)
        else:
            self.valor_liquidado = min(total_saidas, total_entradas)

        if self.valor_liquidado >= self.valor_total:
            self.status = 'L'
        elif self.valor_liquidado > Decimal('0.00'):
            self.status = 'P'
        else:
            self.status = 'A'

        self.save()


class Allocation(models.Model):
    """
    Alocação de um pagamento a uma conta (Receita, Despesa, Custódia ou Transferência).
    Permite dividir um único pagamento entre múltiplas contas.
    """
    company = models.ForeignKey('Company', on_delete=models.CASCADE)
    payment = models.ForeignKey('Payment', on_delete=models.CASCADE, related_name='allocations')
    receita = models.ForeignKey(
        'Receita',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='allocations',
        help_text="Receita para a qual este pagamento foi alocado"
    )
    despesa = models.ForeignKey(
        'Despesa',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='allocations',
        help_text="Despesa para a qual este pagamento foi alocado"
    )
    custodia = models.ForeignKey(
        'Custodia',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='allocations',
        help_text="Custódia para a qual este pagamento foi alocado"
    )
    transfer = models.ForeignKey(
        'Transfer',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='allocations',
        help_text="Transferência para a qual este pagamento foi alocado"
    )
    valor = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Quanto deste pagamento foi alocado para esta conta"
    )
    observacao = models.TextField(blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Alocação"
        verbose_name_plural = "Alocações"
        ordering = ['-criado_em']

    def __str__(self):
        if self.receita:
            return f"Alocação de R$ {self.valor} para Receita: {self.receita.nome}"
        elif self.despesa:
            return f"Alocação de R$ {self.valor} para Despesa: {self.despesa.nome}"
        elif self.custodia:
            return f"Alocação de R$ {self.valor} para Custódia: {self.custodia.nome}"
        elif self.transfer:
            return f"Alocação de R$ {self.valor} para Transferência: {self.transfer}"
        return f"Alocação {self.id} - R$ {self.valor}"

    def clean(self):
        contas_preenchidas = sum([
            bool(self.receita),
            bool(self.despesa),
            bool(self.custodia),
            bool(self.transfer)
        ])

        if contas_preenchidas == 0:
            raise ValidationError(
                "A alocação deve estar vinculada a uma Receita, Despesa, Custódia ou Transferência."
            )

        if contas_preenchidas > 1:
            raise ValidationError(
                "A alocação só pode estar vinculada a uma única conta (Receita, Despesa, Custódia ou Transferência)."
            )

        if self.valor <= 0:
            raise ValidationError("O valor da alocação deve ser maior que zero.")

        if self.payment:
            total_alocado = Allocation.objects.filter(
                payment=self.payment
            ).exclude(pk=self.pk).aggregate(
                total=Sum('valor')
            )['total'] or Decimal('0.00')

            if total_alocado + self.valor > self.payment.valor:
                raise ValidationError(
                    f"O valor total alocado (R$ {total_alocado + self.valor}) "
                    f"excede o valor do pagamento (R$ {self.payment.valor})."
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
