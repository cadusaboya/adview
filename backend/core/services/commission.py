"""
Serviço de cálculo e geração de comissões.

Hierarquia de regras (maior prioridade primeiro):
  1. Regras específicas da Receita (ReceitaComissao)
  2. Regras do Cliente (ClienteComissao)
  (A regra da company como percentual padrão não é aplicada automaticamente
   — só é usada se alguma regra explícita definir funcionário sem percentual,
   mas o modelo atual exige percentual explícito em todas as regras.)
"""

import calendar
from datetime import date
from decimal import Decimal

from ..models import Allocation, Despesa


def calcular_comissoes_mes(company, mes: int, ano: int) -> dict:
    """
    Calcula as comissões de todos os comissionados para um mês/ano.

    Lê as alocações de receitas pagas no mês e aplica as regras de comissão
    (nível receita → nível cliente). Retorna um dict indexado por funcionario.id:

        {
            <func_id>: {
                'comissionado': <Funcionario>,
                'valor_comissao': Decimal,
            },
            ...
        }
    """
    allocations = Allocation.objects.filter(
        company=company,
        receita__isnull=False,
        payment__data_pagamento__month=mes,
        payment__data_pagamento__year=ano,
    ).prefetch_related(
        'receita__comissoes__funcionario',
        'receita__cliente__comissoes__funcionario',
    ).select_related('payment', 'receita__cliente')

    comissionados: dict = {}

    for allocation in allocations:
        # Regras efetivas: da receita se existirem, senão do cliente
        regras = list(allocation.receita.comissoes.all())
        if not regras:
            regras = list(allocation.receita.cliente.comissoes.all())

        for regra in regras:
            func = regra.funcionario
            percentual = regra.percentual / Decimal('100.00')
            valor_comissao_alloc = allocation.valor * percentual

            if func.id not in comissionados:
                comissionados[func.id] = {
                    'comissionado': func,
                    'valor_comissao': Decimal('0.00'),
                }
            comissionados[func.id]['valor_comissao'] += valor_comissao_alloc

    return comissionados


def gerar_despesas_comissao(company, mes: int, ano: int) -> list[dict]:
    """
    Calcula comissões e persiste/atualiza as Despesas do tipo 'C' (Comissionamento).

    Remove despesas de comissão do mês para funcionários que não aparecem mais
    no cálculo (ex: receitas desalocadas).

    Retorna lista de dicts:
        [{'id': ..., 'nome': ..., 'valor': ...}, ...]
    """
    ultimo_dia = calendar.monthrange(ano, mes)[1]
    data_vencimento = date(ano, mes, ultimo_dia)

    comissionados = calcular_comissoes_mes(company, mes, ano)

    # Remove despesas de comissão do mês para quem não aparece mais
    ids_ativos = list(comissionados.keys())
    Despesa.objects.filter(
        company=company,
        tipo='C',
        data_vencimento=data_vencimento,
    ).exclude(responsavel_id__in=ids_ativos).delete()

    resultado = []
    for entry in comissionados.values():
        comissionado = entry['comissionado']
        valor_comissao = entry['valor_comissao']

        if valor_comissao <= 0:
            continue

        Despesa.objects.update_or_create(
            company=company,
            responsavel=comissionado,
            tipo='C',
            data_vencimento=data_vencimento,
            defaults={
                'nome': f'Comissão {mes}/{ano} - {comissionado.nome}',
                'descricao': f'Comissão referente aos pagamentos de {mes}/{ano}',
                'valor': valor_comissao,
                'situacao': 'A',
            },
        )

        resultado.append({
            'id': comissionado.id,
            'nome': comissionado.nome,
            'valor': float(valor_comissao),
        })

    return resultado
