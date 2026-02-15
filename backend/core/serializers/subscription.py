from rest_framework import serializers
from ..models import PlanoAssinatura, AssinaturaEmpresa


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
