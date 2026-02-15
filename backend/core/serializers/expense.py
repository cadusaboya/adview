from rest_framework import serializers
from decimal import Decimal
from ..models import Despesa, DespesaRecorrente, Funcionario
from .identity import CompanySerializer
from .people import FuncionarioSerializer


class DespesaSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    responsavel_id = serializers.PrimaryKeyRelatedField(
        queryset=Funcionario.objects.all(), source='responsavel'
    )
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


class DespesaAbertaSerializer(DespesaSerializer):
    valor_aberto = serializers.SerializerMethodField()

    class Meta(DespesaSerializer.Meta):
        pass

    def get_valor_aberto(self, obj):
        total_pago = sum(
            (alloc.valor for alloc in obj.allocations.all()),
            Decimal("0.00")
        )
        return obj.valor - total_pago


class DespesaRecorrenteSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    responsavel = FuncionarioSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    forma_pagamento_display = serializers.CharField(source='get_forma_pagamento_display', read_only=True)

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
