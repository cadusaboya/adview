from rest_framework import serializers
from django.db.models import Sum
from .models import Company, CustomUser, Cliente, Funcionario, Receita, ReceitaRecorrente, Despesa, DespesaRecorrente, FormaCobranca, ContaBancaria, Payment, Custodia, Transfer, Allocation, ClienteComissao, ReceitaComissao, ReceitaRecorrenteComissao, PlanoAssinatura, AssinaturaEmpresa
from decimal import Decimal


# 🔹 Company
class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'


# 🔹 Custom User
class CustomUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    company = CompanySerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'password', 'company')
        read_only_fields = ('id', 'company')

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user


# 🔹 FormaCobranca
class FormaCobrancaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormaCobranca
        fields = ('id', 'formato', 'descricao', 'valor_mensal', 'percentual_exito')


# 🔹 Comissao serializers (compartilhados)
class ClienteComissaoSerializer(serializers.ModelSerializer):
    funcionario_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.filter(tipo__in=['F', 'P']),
        source='funcionario'
    )
    funcionario_nome = serializers.CharField(source='funcionario.nome', read_only=True)

    class Meta:
        model = ClienteComissao
        fields = ('id', 'funcionario_id', 'funcionario_nome', 'percentual')


class ReceitaComissaoSerializer(serializers.ModelSerializer):
    funcionario_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.filter(tipo__in=['F', 'P']),
        source='funcionario'
    )
    funcionario_nome = serializers.CharField(source='funcionario.nome', read_only=True)

    class Meta:
        model = ReceitaComissao
        fields = ('id', 'funcionario_id', 'funcionario_nome', 'percentual')


class ReceitaRecorrenteComissaoSerializer(serializers.ModelSerializer):
    funcionario_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.filter(tipo__in=['F', 'P']),
        source='funcionario'
    )
    funcionario_nome = serializers.CharField(source='funcionario.nome', read_only=True)

    class Meta:
        model = ReceitaRecorrenteComissao
        fields = ('id', 'funcionario_id', 'funcionario_nome', 'percentual')


# 🔹 Cliente
class ClienteSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    formas_cobranca = FormaCobrancaSerializer(many=True)
    comissoes = ClienteComissaoSerializer(many=True, default=[])

    cpf = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    telefone = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    aniversario = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Cliente
        fields = (
            'id',
            'nome',
            'cpf',
            'email',
            'telefone',
            'aniversario',
            'tipo',
            'tipo_display',
            'company',
            'formas_cobranca',
            'comissoes',
        )
        read_only_fields = ('company', 'tipo_display')

    def create(self, validated_data):
        formas_data = validated_data.pop('formas_cobranca')
        comissoes_data = validated_data.pop('comissoes', [])
        cliente = Cliente.objects.create(**validated_data)
        for forma in formas_data:
            FormaCobranca.objects.create(cliente=cliente, **forma)
        for c in comissoes_data:
            ClienteComissao.objects.create(cliente=cliente, **c)
        return cliente

    def update(self, instance, validated_data):
        formas_data = validated_data.pop('formas_cobranca', None)
        comissoes_data = validated_data.pop('comissoes', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if formas_data is not None:
            instance.formas_cobranca.all().delete()
            for forma in formas_data:
                FormaCobranca.objects.create(cliente=instance, **forma)

        if comissoes_data is not None:
            instance.comissoes.all().delete()
            for c in comissoes_data:
                ClienteComissao.objects.create(cliente=instance, **c)

        return instance



# 🔹 Funcionario
class FuncionarioSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    cpf = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    telefone = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    aniversario = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Funcionario
        fields = '__all__'
        read_only_fields = ('company', 'tipo_display')

    def validate(self, data):
        tipo = data.get('tipo')

        # Limpa salário mensal para Parceiros e Fornecedores
        if tipo != 'F':
            data['salario_mensal'] = None

        return data


# 🔹 Receita
class ReceitaSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    cliente_id = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all(), source='cliente')
    cliente = ClienteSerializer(read_only=True)

    forma_pagamento_display = serializers.CharField(source='get_forma_pagamento_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    situacao_display = serializers.CharField(source='get_situacao_display', read_only=True)

    # Regras de comissão específicas (opcionais, substituem as do cliente)
    comissoes = ReceitaComissaoSerializer(many=True, default=[])

    class Meta:
        model = Receita
        fields = '__all__'
        read_only_fields = ('company', 'cliente',
                            'forma_pagamento_display', 'tipo_display', 'situacao_display')

    def create(self, validated_data):
        comissoes_data = validated_data.pop('comissoes', [])
        receita = Receita.objects.create(**validated_data)
        for c in comissoes_data:
            ReceitaComissao.objects.create(receita=receita, **c)
        return receita

    def update(self, instance, validated_data):
        comissoes_data = validated_data.pop('comissoes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if comissoes_data is not None:
            instance.comissoes.all().delete()
            for c in comissoes_data:
                ReceitaComissao.objects.create(receita=instance, **c)
        return instance

    def validate(self, data):
        situacao = data.get('situacao')
        data_pagamento = data.get('data_pagamento')
        valor_pago = data.get('valor_pago')

        if situacao == 'P' and not data_pagamento:
            raise serializers.ValidationError("Data de Pagamento é obrigatória quando Situação é 'Paga'.")
        if situacao == 'P' and valor_pago is None:
            raise serializers.ValidationError("Valor Pago é obrigatório quando Situação é 'Paga'.")

        return data

class ReceitaAbertaSerializer(ReceitaSerializer):
    valor_aberto = serializers.SerializerMethodField()

    class Meta(ReceitaSerializer.Meta):
        pass  # mantém fields="__all__"

    def get_valor_aberto(self, obj):
        from decimal import Decimal

        total_pago = sum(
            (alloc.valor for alloc in obj.allocations.all()),
            Decimal("0.00")
        )
        return obj.valor - total_pago


# 🔹 Receita Recorrente
class ReceitaRecorrenteSerializer(serializers.ModelSerializer):
    """Serializer para receitas recorrentes"""

    # Read-only fields
    company = CompanySerializer(read_only=True)
    cliente = ClienteSerializer(read_only=True)
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True
    )
    forma_pagamento_display = serializers.CharField(
        source='get_forma_pagamento_display',
        read_only=True
    )

    # Write-only fields
    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source='cliente',
        write_only=True
    )

    # Regras de comissão específicas (opcionais, substituem as do cliente)
    comissoes = ReceitaRecorrenteComissaoSerializer(many=True, default=[])

    class Meta:
        model = ReceitaRecorrente
        fields = '__all__'
        read_only_fields = ('company', 'cliente')

    def create(self, validated_data):
        comissoes_data = validated_data.pop('comissoes', [])
        recorrente = ReceitaRecorrente.objects.create(**validated_data)
        for c in comissoes_data:
            ReceitaRecorrenteComissao.objects.create(receita_recorrente=recorrente, **c)
        return recorrente

    def update(self, instance, validated_data):
        comissoes_data = validated_data.pop('comissoes', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if comissoes_data is not None:
            instance.comissoes.all().delete()
            for c in comissoes_data:
                ReceitaRecorrenteComissao.objects.create(receita_recorrente=instance, **c)
        return instance

    def validate_dia_vencimento(self, value):
        """Valida que dia está entre 1 e 31"""
        if not 1 <= value <= 31:
            raise serializers.ValidationError(
                "Dia de vencimento deve estar entre 1 e 31"
            )
        return value

    def validate(self, data):
        """Validações gerais"""
        data_inicio = data.get('data_inicio')
        data_fim = data.get('data_fim')

        if data_fim and data_inicio and data_fim < data_inicio:
            raise serializers.ValidationError({
                'data_fim': 'Data fim não pode ser anterior à data início'
            })

        return data


# 🔹 Despesa
class DespesaSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    responsavel_id = serializers.PrimaryKeyRelatedField(queryset=Funcionario.objects.all(), source='responsavel')
    responsavel = FuncionarioSerializer(read_only=True)

    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    situacao_display = serializers.CharField(source='get_situacao_display', read_only=True)

    class Meta:
        model = Despesa
        fields = '__all__'
        read_only_fields = ('company', 'responsavel', 'tipo_display', 'situacao_display')

    def validate(self, data):
        situacao = data.get('situacao')
        data_pagamento = data.get('data_pagamento')
        valor_pago = data.get('valor_pago')

        if situacao == 'P' and not data_pagamento:
            raise serializers.ValidationError("Data de Pagamento é obrigatória quando Situação é 'Paga'.")
        if situacao == 'P' and valor_pago is None:
            raise serializers.ValidationError("Valor Pago é obrigatório quando Situação é 'Paga'.")

        return data

# 🔹 Conta Bancaria
class ContaBancariaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContaBancaria
        fields = (
            'id',
            'company',
            'nome',
            'descricao',
            'saldo_atual',
            'criado_em',
            'atualizado_em'
        )
        read_only_fields = (
            'id',
            'company',
            'criado_em',
            'atualizado_em'
        )

class DespesaAbertaSerializer(DespesaSerializer):
    valor_aberto = serializers.SerializerMethodField()

    class Meta(DespesaSerializer.Meta):
        pass  # mantém fields="__all__"

    def get_valor_aberto(self, obj):
        from decimal import Decimal

        total_pago = sum(
            (alloc.valor for alloc in obj.allocations.all()),
            Decimal("0.00")
        )
        return obj.valor - total_pago


# 🔹 Despesa Recorrente
class DespesaRecorrenteSerializer(serializers.ModelSerializer):
    """Serializer para despesas recorrentes"""

    # Read-only fields
    company = CompanySerializer(read_only=True)
    responsavel = FuncionarioSerializer(read_only=True)
    status_display = serializers.CharField(
        source='get_status_display',
        read_only=True
    )
    tipo_display = serializers.CharField(
        source='get_tipo_display',
        read_only=True
    )
    forma_pagamento_display = serializers.CharField(
        source='get_forma_pagamento_display',
        read_only=True
    )

    # Write-only fields
    responsavel_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.all(),
        source='responsavel',
        write_only=True
    )

    class Meta:
        model = DespesaRecorrente
        fields = '__all__'
        read_only_fields = ('company', 'responsavel')

    def validate_dia_vencimento(self, value):
        """Valida que dia está entre 1 e 31"""
        if not 1 <= value <= 31:
            raise serializers.ValidationError(
                "Dia de vencimento deve estar entre 1 e 31"
            )
        return value

    def validate(self, data):
        """Validações gerais"""
        data_inicio = data.get('data_inicio')
        data_fim = data.get('data_fim')

        if data_fim and data_inicio and data_fim < data_inicio:
            raise serializers.ValidationError({
                'data_fim': 'Data fim não pode ser anterior à data início'
            })

        return data


# 🔹 Payment
class PaymentSerializer(serializers.ModelSerializer):
    """
    Serializer para pagamentos neutros (entrada/saída de caixa).
    As alocações para Receitas/Despesas/Custódias são feitas via Allocation.
    """
    conta_bancaria_nome = serializers.CharField(
        source='conta_bancaria.nome', read_only=True
    )
    tipo_display = serializers.CharField(
        source='get_tipo_display', read_only=True
    )

    # Informações das alocações vinculadas
    allocations_info = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Payment
        fields = (
            'id',
            'company',
            'tipo',
            'tipo_display',
            'conta_bancaria',
            'conta_bancaria_nome',
            'valor',
            'data_pagamento',
            'observacao',
            'allocations_info',
            'criado_em'
        )
        read_only_fields = (
            'id',
            'company',
            'conta_bancaria_nome',
            'tipo_display',
            'criado_em'
        )

    def get_allocations_info(self, obj):
        """Retorna informações sobre as alocações deste payment"""
        allocations = obj.allocations.all()
        return [{
            'id': alloc.id,
            'valor': alloc.valor,
            'receita': {
                'id': alloc.receita.id,
                'nome': alloc.receita.nome,
                'cliente': alloc.receita.cliente.nome
            } if alloc.receita else None,
            'despesa': {
                'id': alloc.despesa.id,
                'nome': alloc.despesa.nome,
                'responsavel': alloc.despesa.responsavel.nome
            } if alloc.despesa else None,
            'custodia': {
                'id': alloc.custodia.id,
                'nome': alloc.custodia.nome,
                'tipo': alloc.custodia.tipo,
                'tipo_display': alloc.custodia.get_tipo_display()
            } if alloc.custodia else None,
            'transfer': {
                'id': alloc.transfer.id,
                'from_bank': alloc.transfer.from_bank.nome,
                'to_bank': alloc.transfer.to_bank.nome,
                'status': alloc.transfer.status,
                'status_display': alloc.transfer.get_status_display()
            } if alloc.transfer else None
        } for alloc in allocations]

    def validate(self, data):
        # Validar que o valor é positivo
        valor = data.get('valor')
        if valor and valor <= 0:
            raise serializers.ValidationError({
                'valor': 'O valor do pagamento deve ser maior que zero.'
            })

        return data


# 🔹 Passivo
class CustodiaSerializer(serializers.ModelSerializer):
    """Serializer para custódias (valores de terceiros - ativos e passivos)"""

    # Read-only fields
    company = CompanySerializer(read_only=True)
    cliente = ClienteSerializer(read_only=True)
    funcionario = FuncionarioSerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # Write-only fields
    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source='cliente',
        write_only=True,
        required=False,
        allow_null=True
    )
    funcionario_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.all(),
        source='funcionario',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Custodia
        fields = '__all__'
        read_only_fields = ('company', 'cliente', 'funcionario', 'tipo_display', 'status_display')

    def validate(self, data):
        """Validação: deve ter cliente OU funcionário, mas não ambos"""
        cliente = data.get('cliente')
        funcionario = data.get('funcionario')

        if not cliente and not funcionario:
            raise serializers.ValidationError(
                "A custódia deve estar associada a um Cliente ou Funcionário/Fornecedor/Parceiro."
            )
        if cliente and funcionario:
            raise serializers.ValidationError(
                "A custódia não pode estar vinculada a Cliente e Funcionário ao mesmo tempo."
            )

        return data


# 🔹 Transfer
class TransferSerializer(serializers.ModelSerializer):
    """Serializer para transferências entre contas bancárias"""

    # Read-only fields
    company = CompanySerializer(read_only=True)
    from_bank_nome = serializers.CharField(source='from_bank.nome', read_only=True)
    to_bank_nome = serializers.CharField(source='to_bank.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    # Write-only fields for IDs
    from_bank_id = serializers.PrimaryKeyRelatedField(
        queryset=ContaBancaria.objects.all(),
        source='from_bank',
        write_only=True
    )
    to_bank_id = serializers.PrimaryKeyRelatedField(
        queryset=ContaBancaria.objects.all(),
        source='to_bank',
        write_only=True
    )

    # Campos calculados
    valor_saida = serializers.SerializerMethodField(read_only=True)
    valor_entrada = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Transfer
        fields = (
            'id',
            'company',
            'from_bank',
            'from_bank_id',
            'from_bank_nome',
            'to_bank',
            'to_bank_id',
            'to_bank_nome',
            'valor',
            'data_transferencia',
            'descricao',
            'status',
            'status_display',
            'valor_saida',
            'valor_entrada',
            'criado_em',
            'atualizado_em'
        )
        read_only_fields = (
            'id',
            'company',
            'from_bank',
            'to_bank',
            'status',
            'criado_em',
            'atualizado_em'
        )

    def get_valor_saida(self, obj):
        """Retorna o total de saídas alocadas (usa annotation do ViewSet se disponível)"""
        if hasattr(obj, 'valor_saida'):
            return obj.valor_saida
        # Fallback para quando não há annotation
        total = obj.allocations.filter(
            payment__tipo='S'
        ).aggregate(total=Sum('valor'))['total']
        return total or Decimal('0.00')

    def get_valor_entrada(self, obj):
        """Retorna o total de entradas alocadas (usa annotation do ViewSet se disponível)"""
        if hasattr(obj, 'valor_entrada'):
            return obj.valor_entrada
        # Fallback para quando não há annotation
        total = obj.allocations.filter(
            payment__tipo='E'
        ).aggregate(total=Sum('valor'))['total']
        return total or Decimal('0.00')

    def validate(self, data):
        """Validação: bancos origem e destino devem ser diferentes"""
        from_bank = data.get('from_bank')
        to_bank = data.get('to_bank')

        if from_bank and to_bank and from_bank == to_bank:
            raise serializers.ValidationError(
                "Os bancos de origem e destino devem ser diferentes."
            )

        # Validar que o valor é positivo
        valor = data.get('valor')
        if valor and valor <= 0:
            raise serializers.ValidationError({
                'valor': 'O valor da transferência deve ser maior que zero.'
            })

        return data


# 🔹 Allocation
class AllocationSerializer(serializers.ModelSerializer):
    """Serializer para alocações de pagamentos"""

    # Read-only nested fields
    payment_info = serializers.SerializerMethodField(read_only=True)
    receita_info = serializers.SerializerMethodField(read_only=True)
    despesa_info = serializers.SerializerMethodField(read_only=True)
    custodia_info = serializers.SerializerMethodField(read_only=True)
    transfer_info = serializers.SerializerMethodField(read_only=True)

    # Write-only fields for IDs
    payment_id = serializers.PrimaryKeyRelatedField(
        queryset=Payment.objects.all(),
        source='payment',
        write_only=True
    )
    receita_id = serializers.PrimaryKeyRelatedField(
        queryset=Receita.objects.all(),
        source='receita',
        write_only=True,
        required=False,
        allow_null=True
    )
    despesa_id = serializers.PrimaryKeyRelatedField(
        queryset=Despesa.objects.all(),
        source='despesa',
        write_only=True,
        required=False,
        allow_null=True
    )
    custodia_id = serializers.PrimaryKeyRelatedField(
        queryset=Custodia.objects.all(),
        source='custodia',
        write_only=True,
        required=False,
        allow_null=True
    )
    transfer_id = serializers.PrimaryKeyRelatedField(
        queryset=Transfer.objects.all(),
        source='transfer',
        write_only=True,
        required=False,
        allow_null=True
    )

    class Meta:
        model = Allocation
        fields = (
            'id',
            'company',
            'payment',
            'payment_id',
            'payment_info',
            'receita',
            'receita_id',
            'receita_info',
            'despesa',
            'despesa_id',
            'despesa_info',
            'custodia',
            'custodia_id',
            'custodia_info',
            'transfer',
            'transfer_id',
            'transfer_info',
            'valor',
            'observacao',
            'criado_em',
            'atualizado_em'
        )
        read_only_fields = (
            'id',
            'company',
            'payment',
            'receita',
            'despesa',
            'custodia',
            'transfer',
            'criado_em',
            'atualizado_em'
        )

    def get_payment_info(self, obj):
        """Retorna informações básicas do payment"""
        if obj.payment:
            return {
                'id': obj.payment.id,
                'valor': obj.payment.valor,
                'data_pagamento': obj.payment.data_pagamento,
                'conta_bancaria': obj.payment.conta_bancaria.id if obj.payment.conta_bancaria else None,
                'conta_bancaria_nome': obj.payment.conta_bancaria.nome if obj.payment.conta_bancaria else None
            }
        return None

    def get_receita_info(self, obj):
        """Retorna informações básicas da receita"""
        if obj.receita:
            return {
                'id': obj.receita.id,
                'nome': obj.receita.nome,
                'cliente': obj.receita.cliente.nome if obj.receita.cliente else None,
                'valor': obj.receita.valor
            }
        return None

    def get_despesa_info(self, obj):
        """Retorna informações básicas da despesa"""
        if obj.despesa:
            return {
                'id': obj.despesa.id,
                'nome': obj.despesa.nome,
                'responsavel': obj.despesa.responsavel.nome if obj.despesa.responsavel else None,
                'valor': obj.despesa.valor
            }
        return None

    def get_custodia_info(self, obj):
        """Retorna informações básicas da custódia"""
        if obj.custodia:
            pessoa = None
            if obj.custodia.cliente:
                pessoa = obj.custodia.cliente.nome
            elif obj.custodia.funcionario:
                pessoa = obj.custodia.funcionario.nome

            return {
                'id': obj.custodia.id,
                'nome': obj.custodia.nome,
                'tipo': obj.custodia.tipo,
                'tipo_display': obj.custodia.get_tipo_display(),
                'pessoa': pessoa,
                'valor_total': obj.custodia.valor_total
            }
        return None

    def get_transfer_info(self, obj):
        """Retorna informações básicas da transferência"""
        if obj.transfer:
            return {
                'id': obj.transfer.id,
                'from_bank': obj.transfer.from_bank.nome if obj.transfer.from_bank else None,
                'to_bank': obj.transfer.to_bank.nome if obj.transfer.to_bank else None,
                'valor': obj.transfer.valor,
                'status': obj.transfer.status,
                'status_display': obj.transfer.get_status_display()
            }
        return None

    def validate(self, data):
        """Validação: deve ter receita, despesa, custódia OU transferência, mas não mais de um"""
        receita = data.get('receita')
        despesa = data.get('despesa')
        custodia = data.get('custodia')
        transfer = data.get('transfer')

        # Contar quantas contas foram especificadas
        contas_preenchidas = sum([
            bool(receita),
            bool(despesa),
            bool(custodia),
            bool(transfer)
        ])

        if contas_preenchidas == 0:
            raise serializers.ValidationError(
                "A alocação deve estar vinculada a uma Receita, Despesa, Custódia ou Transferência."
            )

        if contas_preenchidas > 1:
            raise serializers.ValidationError(
                "A alocação só pode estar vinculada a uma única conta (Receita, Despesa, Custódia ou Transferência)."
            )

        # Validar que o valor é positivo
        valor = data.get('valor')
        if valor and valor <= 0:
            raise serializers.ValidationError({
                'valor': 'O valor da alocação deve ser maior que zero.'
            })

        # Validar que o valor não excede o valor do payment
        payment = data.get('payment')
        if payment and valor:
            # Calcular total já alocado para este payment (excluindo esta alocação se for update)
            total_alocado = Allocation.objects.filter(
                payment=payment
            )

            # Se for update, excluir a alocação atual
            if self.instance:
                total_alocado = total_alocado.exclude(pk=self.instance.pk)

            total_alocado = total_alocado.aggregate(
                total=Sum('valor')
            )['total'] or Decimal('0.00')

            if total_alocado + valor > payment.valor:
                raise serializers.ValidationError({
                    'valor': f'O valor total alocado (R$ {total_alocado + valor}) excede o valor do pagamento (R$ {payment.valor}).'
                })

        return data


# ──────────────────────────────────────────────
# Subscription serializers
# ──────────────────────────────────────────────

class PlanoAssinaturaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanoAssinatura
        fields = (
            'id', 'nome', 'slug', 'subtitulo', 'descricao',
            'preco_mensal', 'preco_anual', 'max_usuarios',
            'features', 'tem_trial', 'ativo', 'ordem',
        )


class AssinaturaEmpresaSerializer(serializers.ModelSerializer):
    plano = PlanoAssinaturaSerializer(read_only=True)
    pending_plano = PlanoAssinaturaSerializer(read_only=True)
    trial_ativo = serializers.SerializerMethodField()
    dias_trial_restantes = serializers.SerializerMethodField()
    acesso_permitido = serializers.SerializerMethodField()

    class Meta:
        model = AssinaturaEmpresa
        fields = (
            'id', 'plano', 'ciclo', 'status',
            'trial_inicio', 'trial_fim',
            'trial_ativo', 'dias_trial_restantes', 'acesso_permitido',
            'asaas_customer_id', 'asaas_subscription_id',
            'pending_plano', 'pending_ciclo',
            'proxima_cobranca',
            'card_last_four', 'card_brand',
            'criado_em', 'atualizado_em',
        )
        read_only_fields = fields

    def get_trial_ativo(self, obj):
        return obj.trial_ativo

    def get_dias_trial_restantes(self, obj):
        return obj.dias_trial_restantes

    def get_acesso_permitido(self, obj):
        return obj.acesso_permitido
