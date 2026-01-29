from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from decimal import Decimal
from django.db.models import Sum
from django.utils import timezone

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
    # Add any other custom user fields here

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

class Cliente(models.Model):
    TIPO_CHOICES = (
        ('F', 'Fixo'),
        ('A', 'Avulso'),
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    nome = models.CharField(max_length=255)
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
    descricao = models.CharField(max_length=255, blank=True, null=True)  # Ex.: "Tributário", "Trabalhista"
    valor_mensal = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    percentual_exito = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)  # 30.00 = 30%

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
        ('O', 'Fornecedor'), # 'O' for 'Other' or 'Fornecedor'
    )

    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    nome = models.CharField(max_length=255)
    cpf = models.CharField(max_length=14, unique=True, blank=True, null=True) # Consider using a validator
    email = models.EmailField(unique=True, blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    aniversario = models.DateField(blank=True, null=True)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES)
    salario_mensal = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

    def __str__(self):
        return self.nome

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
    cliente = models.ForeignKey(Cliente, on_delete=models.PROTECT) # Protect deletion if receitas exist
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(blank=True, null=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    valor_pago = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    forma_pagamento = models.CharField(max_length=1, choices=FORMA_CHOICES, blank=True, null=True)
    comissionado = models.ForeignKey(Funcionario, on_delete=models.SET_NULL, blank=True, null=True, limit_choices_to={'tipo__in': ['F', 'P']}) # Only Funcionário or Parceiro
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES)
    situacao = models.CharField(max_length=1, choices=SITUACAO_CHOICES, default='A')

    def __str__(self):
        return f'{self.nome} - {self.cliente.nome}'

    def atualizar_status(self):
        total_pago = self.payments.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if total_pago >= self.valor:
            self.situacao = 'P'  # Pago
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.situacao = 'V'  # Vencido
        else:
            self.situacao = 'A'  # Em aberto

        self.save()

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
    responsavel = models.ForeignKey(Funcionario, on_delete=models.PROTECT) # Ligada a um Fornecedor / Funcionário / Parceiro
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
        # Auto-create fixed monthly expense for 'Funcionário'
        # This logic might be better placed in a separate task or signal
        # For simplicity, keeping it here for now, but be aware of potential performance issues
        # if self.responsavel.tipo == 'F' and self.tipo == 'F' and not self.pk: # Only on creation of fixed expense for employee
        #    pass # Logic to generate monthly expense needs refinement - likely better handled by a scheduled task

        # Auto-create fixed expense based on Funcionario salary
        # This logic is complex: should it create *this* expense based on salary, or create *other* expenses?
        # Assuming 'Salário Mensal' in Funcionario implies a recurring Despesa Fixa.
        # This creation logic is better handled outside the model's save method, perhaps via a management command or scheduled task.

        super().save(*args, **kwargs)

    def atualizar_status(self):
        total_pago = self.payments.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if total_pago >= self.valor:
            self.situacao = 'P'  # Pago
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.situacao = 'V'  # Vencido
        else:
            self.situacao = 'A'  # Em aberto

        self.save()


class Payment(models.Model):
    company = models.ForeignKey('Company', on_delete=models.CASCADE)

    receita = models.ForeignKey('Receita', on_delete=models.CASCADE, null=True, blank=True, related_name='payments')
    despesa = models.ForeignKey('Despesa', on_delete=models.CASCADE, null=True, blank=True, related_name='payments')

    conta_bancaria = models.ForeignKey('ContaBancaria', on_delete=models.PROTECT, related_name='payments')

    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data_pagamento = models.DateField()

    observacao = models.TextField(blank=True, null=True)

    criado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.receita:
            return f"Recebimento de {self.receita.nome} - {self.valor}"
        elif self.despesa:
            return f"Pagamento de {self.despesa.nome} - {self.valor}"
        return f"Pagamento {self.id} - {self.valor}"

class ContaBancaria(models.Model):
    company = models.ForeignKey('Company', on_delete=models.CASCADE)

    nome = models.CharField(max_length=100)  # Ex.: Itaú PJ, Caixa, Nubank, Carteira
    descricao = models.TextField(blank=True, null=True)

    saldo_inicial = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    saldo_atual = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # Sempre atualizado

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conta Bancária"
        verbose_name_plural = "Contas Bancárias"

    def __str__(self):
        return self.nome

    def save(self, *args, **kwargs):
        # Se estiver criando a conta (não existe PK ainda)
        if not self.pk:
            self.saldo_atual = self.saldo_inicial

        super().save(*args, **kwargs)

    def atualizar_saldo(self):
        entradas = self.payments.filter(receita__isnull=False).aggregate(
            total=models.Sum('valor')
        )['total'] or Decimal('0.00')

        saidas = self.payments.filter(despesa__isnull=False).aggregate(
            total=models.Sum('valor')
        )['total'] or Decimal('0.00')

        self.saldo_atual = self.saldo_inicial + Decimal(entradas) - Decimal(saidas)
        self.save()





