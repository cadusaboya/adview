from rest_framework import serializers
from .models import Company, CustomUser, Cliente, Funcionario, Receita, Despesa, FormaCobranca


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

    class Meta:
        model = Cliente
        fields = ('id', 'nome', 'cpf', 'email', 'telefone', 'aniversario', 'tipo',
                  'tipo_display', 'company', 'formas_cobranca')
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
