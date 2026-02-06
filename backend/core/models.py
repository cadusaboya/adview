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
    nome = models.CharField(max_length=255, unique=True)
    cpf = models.CharField(max_length=14, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
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
        # Calcula total pago através das alocações
        total_pago = self.allocations.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if total_pago >= self.valor:
            self.situacao = 'P'  # Pago
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.situacao = 'V'  # Vencido
        else:
            self.situacao = 'A'  # Em aberto

        self.save()


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

    # Multi-tenancy
    company = models.ForeignKey(Company, on_delete=models.CASCADE)

    # Dados básicos
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        help_text="Cliente da receita"
    )

    # Valores
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES, default='F')
    forma_pagamento = models.CharField(max_length=1, choices=FORMA_CHOICES, blank=True, null=True)
    comissionado = models.ForeignKey(
        Funcionario,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        limit_choices_to={'tipo__in': ['F', 'P']},
        help_text="Funcionário ou Parceiro que receberá comissão"
    )

    # Recorrência
    data_inicio = models.DateField(
        help_text="Data da primeira ocorrência"
    )
    data_fim = models.DateField(
        null=True,
        blank=True,
        help_text="Data da última ocorrência (opcional)"
    )
    dia_vencimento = models.IntegerField(
        default=1,
        help_text="Dia do mês para vencimento (1-31)"
    )

    # Controle
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default='A')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.nome} - {self.cliente.nome}'

    class Meta:
        verbose_name = 'Receita Recorrente'
        verbose_name_plural = 'Receitas Recorrentes'
        ordering = ['nome']


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
        # Calcula total pago através das alocações
        total_pago = self.allocations.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if total_pago >= self.valor:
            self.situacao = 'P'  # Pago
        elif self.data_vencimento and self.data_vencimento < timezone.now().date():
            self.situacao = 'V'  # Vencido
        else:
            self.situacao = 'A'  # Em aberto

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

    # Multi-tenancy
    company = models.ForeignKey(Company, on_delete=models.CASCADE)

    # Dados básicos
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    responsavel = models.ForeignKey(
        Funcionario,
        on_delete=models.PROTECT,
        help_text="Favorecido da despesa"
    )

    # Valores
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES, default='F')
    forma_pagamento = models.CharField(max_length=1, choices=FORMA_CHOICES, blank=True, null=True)

    # Recorrência
    data_inicio = models.DateField(
        help_text="Data da primeira ocorrência"
    )
    data_fim = models.DateField(
        null=True,
        blank=True,
        help_text="Data da última ocorrência (opcional)"
    )
    dia_vencimento = models.IntegerField(
        default=1,
        help_text="Dia do mês para vencimento (1-31)"
    )

    # Controle
    status = models.CharField(max_length=1, choices=STATUS_CHOICES, default='A')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.nome} - {self.responsavel.nome}'

    class Meta:
        verbose_name = 'Despesa Recorrente'
        verbose_name_plural = 'Despesas Recorrentes'
        ordering = ['nome']


class Payment(models.Model):
    """
    Pagamento neutro que representa entrada ou saída de caixa.
    A alocação para Receitas/Despesas/Passivos é feita via modelo Allocation.
    """
    TIPO_CHOICES = (
        ('E', 'Entrada'),  # Recebimento
        ('S', 'Saída'),    # Pagamento
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

class ContaBancaria(models.Model):
    company = models.ForeignKey('Company', on_delete=models.CASCADE)

    nome = models.CharField(max_length=100)  # Ex.: Itaú PJ, Caixa, Nubank, Carteira
    descricao = models.TextField(blank=True, null=True)

    saldo_atual = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Conta Bancária"
        verbose_name_plural = "Contas Bancárias"

    def __str__(self):
        return self.nome


class Custodia(models.Model):
    """
    Representa valores de terceiros (ativos e passivos de custódia).
    - Passivo: valores que a empresa deve repassar a terceiros
      Ex: Recebe R$ 14.000, mas apenas 10% é da empresa (R$ 1.400),
      então há uma receita de R$ 1.400 e um passivo de custódia de R$ 12.600 a repassar.
    - Ativo: valores que terceiros devem à empresa
      Ex: Pagou R$ 10.000 em nome de um cliente, que deve reembolsar.
    """
    TIPO_CHOICES = (
        ('P', 'Passivo'),  # Valores que devo a terceiros
        ('A', 'Ativo'),    # Valores que terceiros me devem
    )

    STATUS_CHOICES = (
        ('A', 'Aberto'),
        ('P', 'Parcial'),
        ('L', 'Liquidado'),
    )

    company = models.ForeignKey('Company', on_delete=models.CASCADE)

    # Tipo de custódia
    tipo = models.CharField(max_length=1, choices=TIPO_CHOICES, default='P')

    # Pessoa pode ser Cliente OU Funcionário/Fornecedor/Parceiro
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
        db_table = 'core_passivo'  # Manter nome da tabela existente

    def __str__(self):
        pessoa = self.cliente.nome if self.cliente else (self.funcionario.nome if self.funcionario else 'Sem pessoa')
        tipo_display = 'Passivo' if self.tipo == 'P' else 'Ativo'
        return f'{self.nome} ({tipo_display}) - {pessoa}'

    def atualizar_status(self):
        """
        Atualiza o status baseado no valor liquidado.

        Lógica de liquidação (considera ambas contrapartes):
        - Passivo (P): precisa ter Entrada(E) que registra recebimento E Saída(S) que registra repasse
          - valor_liquidado = mínimo entre total de entradas e total de saídas
        - Ativo (A): precisa ter Saída(S) que registra pagamento E Entrada(E) que registra reembolso
          - valor_liquidado = mínimo entre total de saídas e total de entradas

        Uma custódia só está liquidada quando ambas contrapartes estão registradas.
        """
        # Calcula totais de entradas e saídas
        total_entradas = self.allocations.filter(
            payment__tipo='E'
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        total_saidas = self.allocations.filter(
            payment__tipo='S'
        ).aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

        if self.tipo == 'P':  # Passivo
            # Liquidado = menor valor entre o que entrou e o que foi repassado
            # (só considera liquidado o que tem ambas contrapartes)
            self.valor_liquidado = min(total_entradas, total_saidas)
        else:  # Ativo
            # Liquidado = menor valor entre o que foi pago e o que foi reembolsado
            # (só considera liquidado o que tem ambas contrapartes)
            self.valor_liquidado = min(total_saidas, total_entradas)

        # Atualiza status
        if self.valor_liquidado >= self.valor_total:
            self.status = 'L'  # Liquidado
        elif self.valor_liquidado > Decimal('0.00'):
            self.status = 'P'  # Parcial
        else:
            self.status = 'A'  # Aberto

        self.save()


class Allocation(models.Model):
    """
    Alocação de um pagamento a uma conta (Receita, Despesa ou Passivo).
    Permite dividir um único pagamento entre múltiplas contas.
    """
    company = models.ForeignKey('Company', on_delete=models.CASCADE)

    # Relação com Payment
    payment = models.ForeignKey('Payment', on_delete=models.CASCADE, related_name='allocations')

    # Relação polimórfica com as contas (apenas uma deve ser preenchida)
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

    # Valor alocado para essa conta
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
        return f"Alocação {self.id} - R$ {self.valor}"

    def clean(self):
        from django.core.exceptions import ValidationError

        # Validar que apenas uma conta foi preenchida
        contas_preenchidas = sum([
            bool(self.receita),
            bool(self.despesa),
            bool(self.custodia)
        ])

        if contas_preenchidas == 0:
            raise ValidationError(
                "A alocação deve estar vinculada a uma Receita, Despesa ou Custódia."
            )

        if contas_preenchidas > 1:
            raise ValidationError(
                "A alocação só pode estar vinculada a uma única conta (Receita, Despesa ou Custódia)."
            )

        # Validar que o valor é positivo
        if self.valor <= 0:
            raise ValidationError("O valor da alocação deve ser maior que zero.")

        # Validar que o valor não excede o valor do payment
        if self.payment:
            # Calcular total já alocado (excluindo esta alocação se estiver sendo editada)
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
        # Executa validação antes de salvar
        self.clean()
        super().save(*args, **kwargs)





