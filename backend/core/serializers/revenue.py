from rest_framework import serializers
from decimal import Decimal
from ..models import Receita, ReceitaComissao, ReceitaRecorrente, ReceitaRecorrenteComissao, Funcionario, Cliente
from .identity import CompanySerializer
from .people import ClienteSerializer


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


class ReceitaSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source='cliente'
    )
    cliente = ClienteSerializer(read_only=True)

    forma_pagamento_display = serializers.CharField(source='get_forma_pagamento_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    situacao_display = serializers.CharField(source='get_situacao_display', read_only=True)

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
        pass

    def get_valor_aberto(self, obj):
        total_pago = sum(
            (alloc.valor for alloc in obj.allocations.all()),
            Decimal("0.00")
        )
        return obj.valor - total_pago


class ReceitaRecorrenteSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    cliente = ClienteSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    forma_pagamento_display = serializers.CharField(source='get_forma_pagamento_display', read_only=True)

    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Cliente.objects.all(),
        source='cliente',
        write_only=True
    )

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
        if not 1 <= value <= 31:
            raise serializers.ValidationError("Dia de vencimento deve estar entre 1 e 31")
        return value

    def validate(self, data):
        data_inicio = data.get('data_inicio')
        data_fim = data.get('data_fim')
        if data_fim and data_inicio and data_fim < data_inicio:
            raise serializers.ValidationError({
                'data_fim': 'Data fim não pode ser anterior à data início'
            })
        return data
