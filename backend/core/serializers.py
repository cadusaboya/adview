from rest_framework import serializers
from .models import Company, CustomUser, Cliente, Funcionario, Receita, Despesa, FormaCobranca, ContaBancaria, Payment
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


# 🔹 Cliente
class ClienteSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    formas_cobranca = FormaCobrancaSerializer(many=True)

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
        )
        read_only_fields = ('company', 'tipo_display')

    def create(self, validated_data):
        formas_data = validated_data.pop('formas_cobranca')
        cliente = Cliente.objects.create(**validated_data)
        for forma in formas_data:
            FormaCobranca.objects.create(cliente=cliente, **forma)
        return cliente

    def update(self, instance, validated_data):
        formas_data = validated_data.pop('formas_cobranca', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if formas_data is not None:
            instance.formas_cobranca.all().delete()
            for forma in formas_data:
                FormaCobranca.objects.create(cliente=instance, **forma)

        return instance



# 🔹 Funcionario
class FuncionarioSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Funcionario
        fields = '__all__'
        read_only_fields = ('company', 'tipo_display')

    def validate(self, data):
        tipo = data.get('tipo')
        salario_mensal = data.get('salario_mensal')

        if tipo == 'F' and not salario_mensal:
            raise serializers.ValidationError("Salário Mensal é obrigatório para Funcionário.")
        if tipo != 'F':
            data['salario_mensal'] = None

        return data


# 🔹 Receita
class ReceitaSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    cliente_id = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all(), source='cliente')
    cliente = ClienteSerializer(read_only=True)
    comissionado_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.filter(tipo__in=['F', 'P']),
        source='comissionado', allow_null=True, required=False
    )
    comissionado = FuncionarioSerializer(read_only=True)

    forma_pagamento_display = serializers.CharField(source='get_forma_pagamento_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    situacao_display = serializers.CharField(source='get_situacao_display', read_only=True)

    class Meta:
        model = Receita
        fields = '__all__'
        read_only_fields = ('company', 'cliente', 'comissionado',
                            'forma_pagamento_display', 'tipo_display', 'situacao_display')

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
            (p.valor for p in obj.payments.all()),
            Decimal("0.00")
        )
        return obj.valor - total_pago

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
            (p.valor for p in obj.payments.all()),
            Decimal("0.00")
        )
        return obj.valor - total_pago


# 🔹 Payment
class PaymentSerializer(serializers.ModelSerializer):
    receita_nome = serializers.CharField(
        source='receita.nome', read_only=True
    )
    despesa_nome = serializers.CharField(
        source='despesa.nome', read_only=True
    )
    conta_bancaria_nome = serializers.CharField(
        source='conta_bancaria.nome', read_only=True
    )
    favorecido_nome = serializers.CharField(
        source='despesa.responsavel.nome', read_only=True
    )
    cliente_nome = serializers.CharField(
        source='receita.cliente.nome', read_only=True
    )

    class Meta:
        model = Payment
        fields = (
            'id',
            'company',
            'receita',
            'receita_nome',
            'despesa',
            'despesa_nome',
            'favorecido_nome',
            'cliente_nome',
            'conta_bancaria',
            'conta_bancaria_nome',
            'valor',
            'data_pagamento',
            'observacao',
            'criado_em'
        )
        read_only_fields = (
            'id',
            'company',
            'receita_nome',
            'despesa_nome',
            'conta_bancaria_nome',
            'criado_em'
        )

    def validate(self, data):
        if not data.get('receita') and not data.get('despesa'):
            raise serializers.ValidationError(
                "O pagamento deve estar associado a uma Receita ou Despesa."
            )
        if data.get('receita') and data.get('despesa'):
            raise serializers.ValidationError(
                "O pagamento não pode estar vinculado a Receita e Despesa ao mesmo tempo."
            )
        return data

