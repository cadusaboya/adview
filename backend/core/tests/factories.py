from itertools import count
from datetime import date, timedelta
from decimal import Decimal

from core.models import (
    Company,
    CustomUser,
    Cliente,
    Funcionario,
    FormaCobranca,
    ClienteComissao,
    Receita,
    ReceitaComissao,
    Despesa,
    ContaBancaria,
    Payment,
    Allocation,
    ReceitaRecorrente,
    DespesaRecorrente,
    Custodia,
    Transfer,
)

_seq = count(1)


def _n(prefix: str) -> str:
    return f"{prefix}-{next(_seq)}"


def make_company(name=None):
    return Company.objects.create(name=name or _n("Empresa"), cnpj=f"{next(_seq):014d}")


def make_user(company, username=None, password="Senha@1234"):
    return CustomUser.objects.create_user(
        username=username or _n("user"),
        email=f"{_n('mail')}@test.com",
        password=password,
        company=company,
    )


def make_funcionario(company, tipo="F", nome=None):
    return Funcionario.objects.create(company=company, nome=nome or _n("Funcionario"), tipo=tipo)


def make_cliente(company, nome=None, tipo="F"):
    cliente = Cliente.objects.create(company=company, nome=nome or _n("Cliente"), tipo=tipo)
    FormaCobranca.objects.create(cliente=cliente, formato="M", valor_mensal="1000.00")
    return cliente


def make_cliente_comissao(cliente, funcionario, percentual="10.00"):
    return ClienteComissao.objects.create(cliente=cliente, funcionario=funcionario, percentual=percentual)


def make_receita(company, cliente, nome=None, valor="100.00", tipo="F", vencimento=None, situacao="A"):
    return Receita.objects.create(
        company=company,
        cliente=cliente,
        nome=nome or _n("Receita"),
        data_vencimento=vencimento or (date.today() + timedelta(days=5)),
        valor=Decimal(str(valor)),
        tipo=tipo,
        situacao=situacao,
    )


def make_receita_comissao(receita, funcionario, percentual="15.00"):
    return ReceitaComissao.objects.create(receita=receita, funcionario=funcionario, percentual=percentual)


def make_despesa(company, responsavel, nome=None, valor="100.00", tipo="F", vencimento=None, situacao="A"):
    return Despesa.objects.create(
        company=company,
        responsavel=responsavel,
        nome=nome or _n("Despesa"),
        data_vencimento=vencimento or (date.today() + timedelta(days=5)),
        valor=Decimal(str(valor)),
        tipo=tipo,
        situacao=situacao,
    )


def make_conta(company, nome=None, saldo="0.00"):
    return ContaBancaria.objects.create(
        company=company,
        nome=nome or _n("Conta"),
        saldo_atual=Decimal(str(saldo)),
    )


def make_payment(company, conta, tipo="E", valor="100.00", data_pagamento=None, observacao=""):
    return Payment.objects.create(
        company=company,
        conta_bancaria=conta,
        tipo=tipo,
        valor=Decimal(str(valor)),
        data_pagamento=data_pagamento or date.today(),
        observacao=observacao,
    )


def make_allocation(company, payment, valor="100.00", receita=None, despesa=None, custodia=None, transfer=None):
    return Allocation.objects.create(
        company=company,
        payment=payment,
        valor=Decimal(str(valor)),
        receita=receita,
        despesa=despesa,
        custodia=custodia,
        transfer=transfer,
    )


def make_receita_recorrente(company, cliente, nome=None, dia=5):
    return ReceitaRecorrente.objects.create(
        company=company,
        cliente=cliente,
        nome=nome or _n("ReceitaRec"),
        valor=Decimal("150.00"),
        tipo="F",
        data_inicio=date.today().replace(day=1),
        dia_vencimento=dia,
        status="A",
    )


def make_despesa_recorrente(company, responsavel, nome=None, dia=5):
    return DespesaRecorrente.objects.create(
        company=company,
        responsavel=responsavel,
        nome=nome or _n("DespesaRec"),
        valor=Decimal("120.00"),
        tipo="F",
        data_inicio=date.today().replace(day=1),
        dia_vencimento=dia,
        status="A",
    )


def make_custodia(company, cliente=None, funcionario=None, tipo="P", valor_total="100.00"):
    return Custodia.objects.create(
        company=company,
        tipo=tipo,
        cliente=cliente,
        funcionario=funcionario,
        nome=_n("Custodia"),
        valor_total=Decimal(str(valor_total)),
    )


def make_transfer(company, from_bank, to_bank, valor="100.00"):
    return Transfer.objects.create(
        company=company,
        from_bank=from_bank,
        to_bank=to_bank,
        valor=Decimal(str(valor)),
        data_transferencia=date.today(),
    )
