from rest_framework import serializers
from ..models import Cliente, Funcionario, FormaCobranca, ClienteComissao
from .identity import CompanySerializer


class FormaCobrancaSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormaCobranca
        fields = ('id', 'formato', 'descricao', 'valor_mensal', 'percentual_exito')


class ClienteComissaoSerializer(serializers.ModelSerializer):
    funcionario_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.filter(tipo__in=['F', 'P']),
        source='funcionario'
    )
    funcionario_nome = serializers.CharField(source='funcionario.nome', read_only=True)

    class Meta:
        model = ClienteComissao
        fields = ('id', 'funcionario_id', 'funcionario_nome', 'percentual')


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
        if tipo != 'F':
            data['salario_mensal'] = None
        return data


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
