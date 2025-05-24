from rest_framework import serializers
from .models import Company, CustomUser, Cliente, Funcionario, Receita, Despesa, FormaCobranca

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'

class CustomUserSerializer(serializers.ModelSerializer):
    # Password should be write-only and handled separately for creation/update
    password = serializers.CharField(write_only=True, required=False)
    company_id = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='company', write_only=True, allow_null=True)
    company = CompanySerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'password', 'company', 'company_id')
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

class FormaCobrancaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormaCobranca
        fields = ('id', 'formato', 'descricao', 'valor_mensal', 'percentual_exito')

class ClienteSerializer(serializers.ModelSerializer):
    company_id = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='company', write_only=True)
    company = CompanySerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    formas_cobranca = FormaCobrancaSerializer(many=True)

    class Meta:
        model = Cliente
        fields = ('id', 'nome', 'cpf', 'email', 'telefone', 'aniversario', 'tipo',
                  'tipo_display', 'company_id', 'company', 'formas_cobranca')
        read_only_fields = ('company', 'tipo_display')

    def validate(self, data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if 'company' not in data and not data.get('company_id'):
                if request.user.company:
                    pass  # Está sendo tratado via company_id
                else:
                    raise serializers.ValidationError("Company must be specified.")
        elif not data.get('company_id'):
            raise serializers.ValidationError("Company must be specified.")
        return data

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


class FuncionarioSerializer(serializers.ModelSerializer):
    company_id = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='company', write_only=True)
    company = CompanySerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Funcionario
        fields = '__all__'
        read_only_fields = ('company', 'tipo_display')

    def validate(self, data):
        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            if 'company' not in data and not data.get('company_id'):
                 if request.user.company:
                     pass # Let view handle company assignment
                 else:
                     raise serializers.ValidationError("Company must be specified.")
        elif not data.get('company_id'):
             raise serializers.ValidationError("Company must be specified.")

        tipo = data.get('tipo')
        salario_mensal = data.get('salario_mensal')

        if tipo == 'F' and not salario_mensal:
            raise serializers.ValidationError("Salário Mensal is required for Tipo 'Funcionário'.")
        if tipo != 'F':
            data['salario_mensal'] = None

        return data

class ReceitaSerializer(serializers.ModelSerializer):
    company_id = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='company', write_only=True)
    company = CompanySerializer(read_only=True)
    cliente_id = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all(), source='cliente')
    cliente = ClienteSerializer(read_only=True)
    comissionado_id = serializers.PrimaryKeyRelatedField(queryset=Funcionario.objects.filter(tipo__in=['F', 'P']), source='comissionado', allow_null=True, required=False)
    comissionado = FuncionarioSerializer(read_only=True)
    forma_pagamento_display = serializers.CharField(source='get_forma_pagamento_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    situacao_display = serializers.CharField(source='get_situacao_display', read_only=True)

    class Meta:
        model = Receita
        fields = '__all__'
        read_only_fields = ('company', 'cliente', 'comissionado', 'forma_pagamento_display', 'tipo_display', 'situacao_display')

    def validate(self, data):
        request = self.context.get('request')
        user_company = None
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user_company = request.user.company
            if 'company' not in data and not data.get('company_id'):
                 if user_company:
                     pass # Let view handle company assignment
                 else:
                     raise serializers.ValidationError("Company must be specified.")
        elif not data.get('company_id'):
             raise serializers.ValidationError("Company must be specified.")

        # Ensure selected cliente and comissionado belong to the same company as the receita
        company_id = data.get('company_id', user_company.id if user_company else None)
        if not company_id:
             # This case should ideally be prevented by the checks above or view logic
             raise serializers.ValidationError("Could not determine company for validation.")

        cliente_id = data.get('cliente') # This holds the Cliente instance after initial validation
        if cliente_id and cliente_id.company_id != company_id:
            raise serializers.ValidationError("Cliente must belong to the same company.")

        comissionado_id = data.get('comissionado') # This holds the Funcionario instance
        if comissionado_id and comissionado_id.company_id != company_id:
            raise serializers.ValidationError("Comissionado must belong to the same company.")

        # Validate payment data based on situation
        situacao = data.get('situacao')
        data_pagamento = data.get('data_pagamento')
        valor_pago = data.get('valor_pago')

        if situacao == 'P' and not data_pagamento:
            raise serializers.ValidationError("Data de Pagamento is required when Situação is 'Paga'.")
        if situacao == 'P' and valor_pago is None:
             raise serializers.ValidationError("Valor Pago is required when Situação is 'Paga'.")
        # Maybe reset payment fields if situation is not 'Paga'
        # if situacao != 'P':
        #     data['data_pagamento'] = None
        #     data['valor_pago'] = None

        return data

class DespesaSerializer(serializers.ModelSerializer):
    company_id = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all(), source='company', write_only=True)
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
        request = self.context.get('request')
        user_company = None
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            user_company = request.user.company
            if 'company' not in data and not data.get('company_id'):
                 if user_company:
                     pass # Let view handle company assignment
                 else:
                     raise serializers.ValidationError("Company must be specified.")
        elif not data.get('company_id'):
             raise serializers.ValidationError("Company must be specified.")

        # Ensure selected responsavel belongs to the same company
        company_id = data.get('company_id', user_company.id if user_company else None)
        if not company_id:
             raise serializers.ValidationError("Could not determine company for validation.")

        responsavel_id = data.get('responsavel') # This holds the Funcionario instance
        if responsavel_id and responsavel_id.company_id != company_id:
            raise serializers.ValidationError("Responsável must belong to the same company.")

        # Validate payment data based on situation
        situacao = data.get('situacao')
        data_pagamento = data.get('data_pagamento')
        valor_pago = data.get('valor_pago')

        if situacao == 'P' and not data_pagamento:
            raise serializers.ValidationError("Data de Pagamento is required when Situação is 'Paga'.")
        if situacao == 'P' and valor_pago is None:
             raise serializers.ValidationError("Valor Pago is required when Situação is 'Paga'.")

        return data


