from rest_framework import serializers
from django.db.models import Sum
from decimal import Decimal
from ..models import Payment, ContaBancaria, Transfer, Custodia, Allocation, Receita, Despesa
from .identity import CompanySerializer
from .people import ClienteSerializer, FuncionarioSerializer


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


class PaymentSerializer(serializers.ModelSerializer):
    conta_bancaria_nome = serializers.CharField(source='conta_bancaria.nome', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
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
        valor = data.get('valor')
        if valor and valor <= 0:
            raise serializers.ValidationError({
                'valor': 'O valor do pagamento deve ser maior que zero.'
            })
        return data


class CustodiaSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    cliente = ClienteSerializer(read_only=True)
    funcionario = FuncionarioSerializer(read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    cliente_id = serializers.PrimaryKeyRelatedField(
        queryset=Custodia._meta.get_field('cliente').related_model.objects.all(),
        source='cliente',
        write_only=True,
        required=False,
        allow_null=True
    )
    funcionario_id = serializers.PrimaryKeyRelatedField(
        queryset=Custodia._meta.get_field('funcionario').related_model.objects.all(),
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


class TransferSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    from_bank_nome = serializers.CharField(source='from_bank.nome', read_only=True)
    to_bank_nome = serializers.CharField(source='to_bank.nome', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

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
        if hasattr(obj, 'valor_saida'):
            return obj.valor_saida
        total = obj.allocations.filter(payment__tipo='S').aggregate(total=Sum('valor'))['total']
        return total or Decimal('0.00')

    def get_valor_entrada(self, obj):
        if hasattr(obj, 'valor_entrada'):
            return obj.valor_entrada
        total = obj.allocations.filter(payment__tipo='E').aggregate(total=Sum('valor'))['total']
        return total or Decimal('0.00')

    def validate(self, data):
        from_bank = data.get('from_bank')
        to_bank = data.get('to_bank')

        if from_bank and to_bank and from_bank == to_bank:
            raise serializers.ValidationError(
                "Os bancos de origem e destino devem ser diferentes."
            )

        valor = data.get('valor')
        if valor and valor <= 0:
            raise serializers.ValidationError({
                'valor': 'O valor da transferência deve ser maior que zero.'
            })
        return data


class AllocationSerializer(serializers.ModelSerializer):
    payment_info = serializers.SerializerMethodField(read_only=True)
    receita_info = serializers.SerializerMethodField(read_only=True)
    despesa_info = serializers.SerializerMethodField(read_only=True)
    custodia_info = serializers.SerializerMethodField(read_only=True)
    transfer_info = serializers.SerializerMethodField(read_only=True)

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
        if obj.payment:
            return {
                'id': obj.payment.id,
                'tipo': obj.payment.tipo,
                'valor': obj.payment.valor,
                'data_pagamento': obj.payment.data_pagamento,
                'conta_bancaria': obj.payment.conta_bancaria.id if obj.payment.conta_bancaria else None,
                'conta_bancaria_nome': obj.payment.conta_bancaria.nome if obj.payment.conta_bancaria else None
            }
        return None

    def get_receita_info(self, obj):
        if obj.receita:
            return {
                'id': obj.receita.id,
                'nome': obj.receita.nome,
                'cliente': obj.receita.cliente.nome if obj.receita.cliente else None,
                'valor': obj.receita.valor
            }
        return None

    def get_despesa_info(self, obj):
        if obj.despesa:
            return {
                'id': obj.despesa.id,
                'nome': obj.despesa.nome,
                'responsavel': obj.despesa.responsavel.nome if obj.despesa.responsavel else None,
                'valor': obj.despesa.valor
            }
        return None

    def get_custodia_info(self, obj):
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
        receita = data.get('receita')
        despesa = data.get('despesa')
        custodia = data.get('custodia')
        transfer = data.get('transfer')

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

        valor = data.get('valor')
        if valor and valor <= 0:
            raise serializers.ValidationError({
                'valor': 'O valor da alocação deve ser maior que zero.'
            })

        payment = data.get('payment')
        if payment and valor:
            total_alocado = Allocation.objects.filter(payment=payment)
            if self.instance:
                total_alocado = total_alocado.exclude(pk=self.instance.pk)
            total_alocado = total_alocado.aggregate(total=Sum('valor'))['total'] or Decimal('0.00')

            if total_alocado + valor > payment.valor:
                raise serializers.ValidationError({
                    'valor': f'O valor total alocado (R$ {total_alocado + valor}) excede o valor do pagamento (R$ {payment.valor}).'
                })

        return data
