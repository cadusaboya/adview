from django.db import models
from .identity import Company


class Cliente(models.Model):
    TIPO_CHOICES = (
        ('F', 'Fixo'),
        ('A', 'Avulso'),
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    nome = models.CharField(max_length=255, unique=True)
    cpf = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    aniversario = models.DateField(blank=True, null=True)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES)

    def __str__(self):
        return self.nome


class FormaCobranca(models.Model):
    FORMATO_CHOICES = (
        ('M', 'Valor Mensal'),
        ('E', 'Êxito'),
    )

    cliente = models.ForeignKey('Cliente', on_delete=models.CASCADE, related_name='formas_cobranca')
    formato = models.CharField(max_length=1, choices=FORMATO_CHOICES)
    descricao = models.CharField(max_length=255, blank=True, null=True)
    valor_mensal = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    percentual_exito = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)

    def __str__(self):
        if self.formato == 'M':
            return f"Mensal: R$ {self.valor_mensal}"
        elif self.formato == 'E':
            return f"Êxito {self.descricao}: {self.percentual_exito}%"
        return "Forma de Cobrança"


class Funcionario(models.Model):
    TIPO_CHOICES = (
        ('F', 'Funcionário'),
        ('P', 'Parceiro'),
        ('O', 'Fornecedor'),
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    nome = models.CharField(max_length=255, unique=True)
    cpf = models.CharField(max_length=14, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    aniversario = models.DateField(blank=True, null=True)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES)
    salario_mensal = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    def __str__(self):
        return self.nome


class ClienteComissao(models.Model):
    """Regra de comissão de um cliente para um funcionário/parceiro."""
    cliente = models.ForeignKey('Cliente', on_delete=models.CASCADE, related_name='comissoes')
    funcionario = models.ForeignKey(
        'Funcionario',
        on_delete=models.CASCADE,
        limit_choices_to={'tipo__in': ['F', 'P']},
        verbose_name='Comissionado'
    )
    percentual = models.DecimalField(max_digits=5, decimal_places=2, help_text='Percentual de comissão (%)')

    class Meta:
        unique_together = ('cliente', 'funcionario')
        verbose_name = 'Comissão do Cliente'
        verbose_name_plural = 'Comissões do Cliente'

    def __str__(self):
        return f'{self.funcionario.nome} — {self.percentual}% ({self.cliente.nome})'
