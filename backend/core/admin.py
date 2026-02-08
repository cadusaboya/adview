from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    Company,
    CustomUser,
    Cliente,
    FormaCobranca,
    Funcionario,
    Receita,
    Despesa,
    Payment,
    ContaBancaria,
    Custodia
)

# =========================
# COMPANY
# =========================
@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'cnpj', 'cidade', 'estado', 'criado_em')
    search_fields = ('name', 'cnpj')
    list_filter = ('estado',)


# =========================
# CUSTOM USER
# =========================
@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):

    # CAMPOS AO EDITAR USUÁRIO
    fieldsets = UserAdmin.fieldsets + (
        ('Empresa', {'fields': ('company',)}),
    )

    # CAMPOS AO CRIAR USUÁRIO (ESTE ERA O PROBLEMA)
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Empresa', {'fields': ('company',)}),
    )

    list_display = ('username', 'email', 'company', 'is_staff', 'is_active')
    list_filter = ('company', 'is_staff', 'is_active')
    search_fields = ('username', 'email')


# =========================
# CLIENTE
# =========================
class FormaCobrancaInline(admin.TabularInline):
    model = FormaCobranca
    extra = 1


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nome', 'company', 'tipo', 'email', 'telefone')
    search_fields = ('nome', 'email', 'cpf')
    list_filter = ('company', 'tipo')
    inlines = [FormaCobrancaInline]


# =========================
# FUNCIONÁRIO
# =========================
@admin.register(Funcionario)
class FuncionarioAdmin(admin.ModelAdmin):
    list_display = ('nome', 'company', 'tipo', 'email', 'salario_mensal')
    list_filter = ('company', 'tipo')
    search_fields = ('nome', 'email', 'cpf')


# =========================
# RECEITA
# =========================
@admin.register(Receita)
class ReceitaAdmin(admin.ModelAdmin):
    list_display = (
        'nome',
        'company',
        'cliente',
        'valor',
        'valor_pago',
        'situacao',
        'data_vencimento'
    )
    list_filter = ('company', 'situacao', 'tipo')
    search_fields = ('nome', 'cliente__nome')
    date_hierarchy = 'data_vencimento'
    readonly_fields = ('situacao',)


# =========================
# DESPESA
# =========================
@admin.register(Despesa)
class DespesaAdmin(admin.ModelAdmin):
    list_display = (
        'nome',
        'company',
        'responsavel',
        'valor',
        'situacao',
        'data_vencimento'
    )
    list_filter = ('company', 'tipo', 'situacao')
    search_fields = ('nome', 'responsavel__nome')
    date_hierarchy = 'data_vencimento'
    readonly_fields = ('situacao',)


# =========================
# CONTA BANCÁRIA
# =========================
@admin.register(ContaBancaria)
class ContaBancariaAdmin(admin.ModelAdmin):
    list_display = (
        'nome',
        'company',
        'saldo_atual',
        'criado_em'
    )
    list_filter = ('company',)


# =========================
# PAYMENT
# =========================
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'company',
        'tipo',
        'valor',
        'data_pagamento',
        'conta_bancaria'
    )
    list_filter = ('company', 'tipo', 'conta_bancaria')
    date_hierarchy = 'data_pagamento'


# =========================
# PASSIVO
# =========================
@admin.register(Custodia)
class CustodiaAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'nome',
        'tipo',
        'company',
        'cliente',
        'funcionario',
        'valor_total',
        'valor_liquidado',
        'status',
        'criado_em'
    )
    list_filter = ('company', 'tipo', 'status')
    search_fields = ('nome', 'cliente__nome', 'funcionario__nome')
    date_hierarchy = 'criado_em'
    readonly_fields = ('status', 'criado_em', 'atualizado_em')
