"""
Views para geração de relatórios em PDF do Vincor
Otimizados com select_related e prefetch_related
"""

from django.http import HttpResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from decimal import Decimal
from datetime import datetime, timedelta, date
from django.db.models import Sum, Q, F, DecimalField, Prefetch
from django.db.models.functions import Coalesce

from .models import Receita, Despesa, Payment, ContaBancaria, Cliente, Funcionario, Company, Allocation, Custodia
from .helpers.pdf import (
    PDFReportBase, format_currency, format_date, truncate_text, TableBuilder
)


def get_company_from_request(request):
    """Extrai a empresa do usuário autenticado."""
    if hasattr(request.user, 'company') and request.user.company:
        return request.user.company
    raise PermissionError("Usuário não possui empresa associada")


def format_date_br(date_obj) -> str:
    """Formata data no padrão DD/MM/YYYY."""
    if date_obj is None:
        return "-"
    return date_obj.strftime("%d/%m/%Y") if date_obj else "-"


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_receitas_pagas(request):
    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    cliente_id = request.query_params.get("cliente_id")
    data_inicio = request.query_params.get("data_inicio")
    data_fim = request.query_params.get("data_fim")
    tipo = request.query_params.get("tipo")

    # Filtra payments que têm alocações com receita
    pagamentos = Payment.objects.filter(
        company=company,
        allocations__receita__isnull=False
    ).select_related(
        "conta_bancaria"
    ).prefetch_related(
        Prefetch(
            'allocations',
            queryset=Allocation.objects.select_related(
                'receita__cliente'
            ).filter(receita__isnull=False)
        )
    ).distinct().order_by("data_pagamento")

    if cliente_id:
        pagamentos = pagamentos.filter(allocations__receita__cliente_id=cliente_id)
    if data_inicio:
        pagamentos = pagamentos.filter(data_pagamento__gte=data_inicio)
    if data_fim:
        pagamentos = pagamentos.filter(data_pagamento__lte=data_fim)
    if tipo:
        pagamentos = pagamentos.filter(allocations__receita__tipo=tipo)

    rows = []
    total = Decimal("0.00")

    # Itera sobre payments e suas allocations de receita
    for p in pagamentos:
        for allocation in p.allocations.all():
            if allocation.receita and (not tipo or allocation.receita.tipo == tipo):
                rows.append({
                    "data": format_date_br(p.data_pagamento),
                    "cliente": truncate_text(allocation.receita.cliente.nome, 25),
                    "descricao": truncate_text(allocation.receita.nome, 35),
                    "tipo": "Recebido",
                    "valor": allocation.valor,
                })
                total += allocation.valor

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_receitas_pagas.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Receitas Recebidas", company.name, company.logo)
    y = report.draw_header(pdf, width, height)

    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": "Cliente", "key": "cliente", "x": margin + 100},
        {"label": "Descrição", "key": "descricao", "x": margin + 260},
        {"label": "Valor", "key": "valor", "x": width - 100, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)
        y = report.draw_row(pdf, y, row, columns)

    y -= 10
    report.draw_total_row(pdf, y, "TOTAL RECEBIDO", total, columns[-2]["x"], columns[-1]["x"])

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response



def calcular_dias_atraso(data_vencimento, data_atual):
    """
    Calcula o número de dias de atraso entre duas datas.
    """
    if data_vencimento >= data_atual:
        return 0

    delta = data_atual - data_vencimento
    return delta.days


def calcular_juros_compostos(valor_principal, percentual_juros_mensal, dias_atraso):
    """
    Calcula juros compostos diários baseado em uma taxa mensal.

    Fórmula:
    - taxa_diaria = (1 + taxa_mensal)^(1/30) - 1
    - juros = valor * ((1 + taxa_diaria)^dias - 1)

    Args:
        valor_principal: Valor sobre o qual calcular juros
        percentual_juros_mensal: Taxa de juros mensal em percentual (ex: 2 para 2%)
        dias_atraso: Número de dias de atraso

    Returns:
        Valor dos juros calculados
    """
    if dias_atraso <= 0 or percentual_juros_mensal <= 0:
        return Decimal("0.00")

    # Converter percentual para decimal (2% -> 0.02)
    taxa_mensal = float(percentual_juros_mensal) / 100

    # Calcular taxa diária: (1 + taxa_mensal)^(1/30) - 1
    taxa_diaria = pow(1 + taxa_mensal, 1/30) - 1

    # Calcular juros: valor * ((1 + taxa_diaria)^dias - 1)
    fator_juros = pow(1 + taxa_diaria, dias_atraso) - 1
    juros = float(valor_principal) * fator_juros

    return Decimal(str(round(juros, 2)))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_cliente_especifico(request):
    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    cliente_id = request.query_params.get("cliente_id")
    if not cliente_id:
        return Response({"error": "cliente_id é obrigatório"}, status=400)

    cliente = Cliente.objects.filter(company=company, id=cliente_id).first()
    if not cliente:
        return Response({"error": "Cliente não encontrado"}, status=404)

    # Get percentual de multa e juros
    percentual_multa = Decimal(request.query_params.get("percentual_multa", "0"))
    percentual_juros = Decimal(request.query_params.get("percentual_juros", "0"))
    visualizacao = request.query_params.get("visualizacao", "ambas")  # ambas, recebidas, a_receber
    incluir_custodias = request.query_params.get("incluir_custodias", "true").lower() == "true"
    hoje = date.today()

    rows = []

    # ===================== CONTAS A RECEBER (CORRIGIDO)
    total_aberto = Decimal("0.00")
    total_juros = Decimal("0.00")
    total_multa = Decimal("0.00")
    total_com_encargos = Decimal("0.00")

    # Só mostra contas a receber se visualizacao for 'ambas' ou 'a_receber'
    if visualizacao in ["ambas", "a_receber"]:
        receitas_abertas = Receita.objects.filter(
            company=company,
            cliente=cliente,
            situacao__in=["A", "V"]
        ).prefetch_related(
            "allocations"
        ).order_by("data_vencimento")

        rows.append({"is_section": True, "section_title": "Contas a Receber"})

        for r in receitas_abertas:
            total_recebido = sum(
                (alloc.valor for alloc in r.allocations.all()),
                Decimal("0.00")
            )

            valor_aberto = r.valor - total_recebido

            # ❌ Não mostrar receitas quitadas
            if valor_aberto <= 0:
                continue

            # Calcular juros e multa se estiver em atraso
            juros = Decimal("0.00")
            multa = Decimal("0.00")

            if r.data_vencimento and r.data_vencimento < hoje:
                # Calcular dias em atraso
                dias_atraso = calcular_dias_atraso(r.data_vencimento, hoje)

                # Calcular multa (aplicada uma vez)
                if percentual_multa > 0:
                    multa = valor_aberto * (percentual_multa / 100)

                # Calcular juros compostos diários
                if percentual_juros > 0 and dias_atraso > 0:
                    juros = calcular_juros_compostos(valor_aberto, percentual_juros, dias_atraso)

            em_aberto = valor_aberto + juros + multa

            rows.append({
                "data": format_date_br(r.data_vencimento),
                "descricao": truncate_text(r.nome, 40),
                "valor": valor_aberto,
                "juros": juros,
                "multa": multa,
                "em_aberto": em_aberto,
            })

            total_aberto += valor_aberto
            total_juros += juros
            total_multa += multa
            total_com_encargos += em_aberto

        rows.append({
            "is_subtotal": True,
            "label": "Total a Receber",
            "valor": total_aberto,
            "juros": total_juros,
            "multa": total_multa,
            "em_aberto": total_com_encargos,
        })

    # ===================== CONTAS RECEBIDAS (JÁ CORRETO)
    total_recebido = Decimal("0.00")

    # Só mostra contas recebidas se visualizacao for 'ambas' ou 'recebidas'
    if visualizacao in ["ambas", "recebidas"]:
        # Buscar alocações de receitas deste cliente
        allocations = Allocation.objects.filter(
            company=company,
            receita__cliente=cliente
        ).select_related(
            "payment",
            "payment__conta_bancaria",
            "receita"
        ).order_by("payment__data_pagamento")

        rows.append({"is_section": True, "section_title": "Contas Recebidas"})

        for allocation in allocations:
            rows.append({
                "data": format_date_br(allocation.payment.data_pagamento),
                "descricao": truncate_text(allocation.receita.nome, 40),
                "valor": allocation.valor,
            })
            total_recebido += allocation.valor

        rows.append({
            "is_subtotal": True,
            "label": "Total Recebido",
            "valor": total_recebido,
        })

    # ===================== MOVIMENTAÇÕES DE CUSTÓDIA (se habilitado)
    if incluir_custodias:
        total_custodia_recebida = Decimal("0.00")
        total_custodia_repassada = Decimal("0.00")

        # Buscar alocações de payments para custódias deste cliente
        allocations_custodia = Allocation.objects.filter(
            company=company,
            custodia__cliente=cliente
        ).select_related(
            "payment",
            "payment__conta_bancaria",
            "custodia"
        ).order_by("payment__data_pagamento")

        if allocations_custodia.exists():
            rows.append({"is_section": True, "section_title": "Movimentações de Custódia"})

            for allocation in allocations_custodia:
                payment = allocation.payment
                custodia = allocation.custodia

                if payment.tipo == 'E':  # Recebimento
                    tipo_mov = "Recebida"
                    total_custodia_recebida += allocation.valor
                else:  # Repasse/Saída
                    tipo_mov = "Repassada"
                    total_custodia_repassada += allocation.valor

                rows.append({
                    "data": format_date_br(payment.data_pagamento),
                    "descricao": truncate_text(f"{custodia.nome} ({tipo_mov})", 40),
                    "valor": allocation.valor,
                })

            rows.append({
                "is_subtotal": True,
                "label": "Total Custódia Recebida",
                "valor": total_custodia_recebida,
            })

            rows.append({
                "is_subtotal": True,
                "label": "Total Custódia Repassada",
                "valor": total_custodia_repassada,
            })

        # ===================== CUSTÓDIAS EM ABERTO
        total_custodia_passivo = Decimal("0.00")
        total_custodia_ativo = Decimal("0.00")

        # Buscar custódias do cliente
        custodias = Custodia.objects.filter(
            company=company,
            cliente=cliente
        ).order_by('criado_em')

        custodias_abertas = []
        for custodia in custodias:
            valor_aberto = custodia.valor_total - custodia.valor_liquidado
            if valor_aberto > 0:
                custodias_abertas.append((custodia, valor_aberto))

        if custodias_abertas:
            rows.append({"is_section": True, "section_title": "Custódias em Aberto"})

            for custodia, valor_aberto in custodias_abertas:
                tipo_custodia = "A Repassar" if custodia.tipo == 'P' else "A Receber"
                rows.append({
                    "data": format_date_br(custodia.criado_em.date()),
                    "descricao": truncate_text(f"{custodia.nome} ({tipo_custodia})", 40),
                    "valor": valor_aberto,
                })

                if custodia.tipo == 'P':
                    total_custodia_passivo += valor_aberto
                else:
                    total_custodia_ativo += valor_aberto

            if total_custodia_passivo > 0:
                rows.append({
                    "is_subtotal": True,
                    "label": "Total a Repassar",
                    "valor": total_custodia_passivo,
                })

            if total_custodia_ativo > 0:
                rows.append({
                    "is_subtotal": True,
                    "label": "Total a Receber",
                    "valor": total_custodia_ativo,
                })

    # ===================== PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=relatorio_cliente_{cliente_id}.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Cliente", company.name, company.logo)
    y = report.draw_header(pdf, width, height, f"Cliente: {cliente.nome}")

    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": "Descrição", "key": "descricao", "x": margin + 100},
        {"label": "Valor", "key": "valor", "x": width - 380, "is_amount": True},
        {"label": "Juros", "key": "juros", "x": width - 280, "is_amount": True},
        {"label": "Multa", "key": "multa", "x": width - 180, "is_amount": True},
        {"label": "Em Aberto", "key": "em_aberto", "x": width - 80, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)

        if row.get("is_section"):
            pdf.setFont("Helvetica-Bold", 10)
            pdf.drawString(margin, y, row["section_title"])
            y -= 15
        elif row.get("is_subtotal"):
            pdf.setFont("Helvetica-Bold", 9)
            pdf.drawString(margin, y, row["label"])
            # Display all totals
            if "valor" in row:
                pdf.drawString(width - 380, y, format_currency(row["valor"]))
            if "juros" in row:
                pdf.drawString(width - 280, y, format_currency(row["juros"]))
            if "multa" in row:
                pdf.drawString(width - 180, y, format_currency(row["multa"]))
            if "em_aberto" in row:
                pdf.drawString(width - 80, y, format_currency(row["em_aberto"]))
            y -= 15
        else:
            y = report.draw_row(pdf, y, row, columns)

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_despesas_pagas(request):
    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    responsavel_id = request.query_params.get("responsavel_id")
    data_inicio = request.query_params.get("data_inicio")
    data_fim = request.query_params.get("data_fim")

    # Filtra payments que têm alocações com despesa
    pagamentos = Payment.objects.filter(
        company=company,
        allocations__despesa__isnull=False
    ).select_related(
        "conta_bancaria"
    ).prefetch_related(
        Prefetch(
            'allocations',
            queryset=Allocation.objects.select_related(
                'despesa__responsavel'
            ).filter(despesa__isnull=False)
        )
    ).distinct().order_by("data_pagamento")

    if responsavel_id:
        pagamentos = pagamentos.filter(allocations__despesa__responsavel_id=responsavel_id)
    if data_inicio:
        pagamentos = pagamentos.filter(data_pagamento__gte=data_inicio)
    if data_fim:
        pagamentos = pagamentos.filter(data_pagamento__lte=data_fim)

    rows = []
    total = Decimal("0.00")

    # Itera sobre payments e suas allocations de despesa
    for p in pagamentos:
        for allocation in p.allocations.all():
            if allocation.despesa:
                rows.append({
                    "data": format_date_br(p.data_pagamento),
                    "responsavel": truncate_text(allocation.despesa.responsavel.nome, 25),
                    "descricao": truncate_text(allocation.despesa.nome, 35),
                    "tipo": "Pago",
                    "valor": allocation.valor,
                })
                total += allocation.valor

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_despesas_pagas.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Despesas Pagas", company.name, company.logo)
    y = report.draw_header(pdf, width, height)

    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": "Favorecido", "key": "responsavel", "x": margin + 100},
        {"label": "Descrição", "key": "descricao", "x": margin + 260},
        {"label": "Valor", "key": "valor", "x": width - 100, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)
        y = report.draw_row(pdf, y, row, columns)

    y -= 10
    report.draw_total_row(pdf, y, "TOTAL PAGO", total, columns[-2]["x"], columns[-1]["x"])

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_despesas_a_pagar(request):
    """
    Relatório de Despesas a Pagar
    Mostra apenas o valor em aberto (considerando pagamentos parciais)
    """

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    responsavel_id = request.query_params.get("responsavel_id")
    data_inicio = request.query_params.get("data_inicio")
    data_fim = request.query_params.get("data_fim")
    tipo = request.query_params.get("tipo")

    despesas = Despesa.objects.filter(
        company=company,
        situacao__in=["A", "V"]
    ).select_related(
        "responsavel"
    ).prefetch_related(
        "allocations"
    ).order_by("data_vencimento")

    if responsavel_id:
        despesas = despesas.filter(responsavel_id=responsavel_id)
    if data_inicio:
        despesas = despesas.filter(data_vencimento__gte=data_inicio)
    if data_fim:
        despesas = despesas.filter(data_vencimento__lte=data_fim)
    if tipo:
        despesas = despesas.filter(tipo=tipo)

    rows = []
    total = Decimal("0.00")

    for despesa in despesas:
        total_pago = sum(
            (alloc.valor for alloc in despesa.allocations.all()),
            Decimal("0.00")
        )

        valor_aberto = despesa.valor - total_pago

        # ❌ Não mostrar despesas totalmente quitadas
        if valor_aberto <= 0:
            continue

        tipo_abreviado = (
            "Fixa" if despesa.tipo == "F"
            else "Variável" if despesa.tipo == "V"
            else "Comissão" if despesa.tipo == "C"
            else despesa.get_tipo_display()
        )

        rows.append({
            "data": format_date_br(despesa.data_vencimento),
            "responsavel": truncate_text(despesa.responsavel.nome, 25),
            "descricao": truncate_text(despesa.nome, 35),
            "tipo": tipo_abreviado,
            "valor": valor_aberto,
        })

        total += valor_aberto

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_despesas_a_pagar.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Despesas a Pagar", company.name, company.logo)

    date_range = ""
    if data_inicio and data_fim:
        date_range = f"{data_inicio} a {data_fim}"
    elif data_inicio:
        date_range = f"A partir de {data_inicio}"

    y = report.draw_header(pdf, width, height, "", date_range)

    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": "Favorecido", "key": "responsavel", "x": margin + 100},
        {"label": "Descrição", "key": "descricao", "x": margin + 250},
        {"label": "Tipo", "key": "tipo", "x": width - 200},
        {"label": "Valor em Aberto", "key": "valor", "x": width - 100, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)
        y = report.draw_row(pdf, y, row, columns)

    if rows:
        y -= 5
        report.draw_total_row(
            pdf,
            y,
            "TOTAL A PAGAR",
            total,
            columns[-2]["x"],
            columns[-1]["x"],
        )

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_receitas_a_receber(request):
    """
    Relatório de Receitas a Receber
    Mostra apenas o valor em aberto (considerando pagamentos parciais)
    """

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    cliente_id = request.query_params.get("cliente_id")
    data_inicio = request.query_params.get("data_inicio")
    data_fim = request.query_params.get("data_fim")
    tipo = request.query_params.get("tipo")

    receitas = Receita.objects.filter(
        company=company,
        situacao__in=["A", "V"]
    ).select_related(
        "cliente"
    ).prefetch_related(
        "allocations"
    ).order_by("data_vencimento")

    if cliente_id:
        receitas = receitas.filter(cliente_id=cliente_id)
    if data_inicio:
        receitas = receitas.filter(data_vencimento__gte=data_inicio)
    if data_fim:
        receitas = receitas.filter(data_vencimento__lte=data_fim)
    if tipo:
        receitas = receitas.filter(tipo=tipo)

    rows = []
    total = Decimal("0.00")

    for receita in receitas:
        total_recebido = sum(
            (alloc.valor for alloc in receita.allocations.all()),
            Decimal("0.00")
        )

        valor_aberto = receita.valor - total_recebido

        # ❌ Não mostrar receitas totalmente quitadas
        if valor_aberto <= 0:
            continue

        tipo_abreviado = (
            "Fixa" if receita.tipo == "F"
            else "Variável" if receita.tipo == "V"
            else "Estorno" if receita.tipo == "E"
            else receita.get_tipo_display()
        )

        rows.append({
            "data": format_date_br(receita.data_vencimento),
            "cliente": truncate_text(receita.cliente.nome, 25),
            "descricao": truncate_text(receita.nome, 35),
            "tipo": tipo_abreviado,
            "valor": valor_aberto,
        })

        total += valor_aberto

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_receitas_a_receber.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Receitas a Receber", company.name, company.logo)

    date_range = ""
    if data_inicio and data_fim:
        date_range = f"{data_inicio} a {data_fim}"
    elif data_inicio:
        date_range = f"A partir de {data_inicio}"

    y = report.draw_header(pdf, width, height, "", date_range)

    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": "Cliente", "key": "cliente", "x": margin + 100},
        {"label": "Descrição", "key": "descricao", "x": margin + 250},
        {"label": "Tipo", "key": "tipo", "x": width - 200},
        {"label": "Valor em Aberto", "key": "valor", "x": width - 100, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)
        y = report.draw_row(pdf, y, row, columns)

    if rows:
        y -= 5
        report.draw_total_row(
            pdf,
            y,
            "TOTAL A RECEBER",
            total,
            columns[-2]["x"],
            columns[-1]["x"],
        )

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_fluxo_de_caixa(request):
    """
    Relatório de Fluxo de Caixa Realizado
    Layout dia-a-dia com saldo inicial/final, espelhando a visão da tela.

    Filtros: conta_bancaria_id, data_inicio, data_fim
    """
    from reportlab.lib import colors
    from collections import defaultdict

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    conta_bancaria_id = request.query_params.get("conta_bancaria_id")
    data_inicio = request.query_params.get("data_inicio")
    data_fim = request.query_params.get("data_fim")

    # ── Pagamentos do período ─────────────────────────────────────────────────
    pagamentos = Payment.objects.filter(
        company=company,
        conta_bancaria__isnull=False
    ).select_related(
        "conta_bancaria"
    ).prefetch_related(
        Prefetch(
            'allocations',
            queryset=Allocation.objects.select_related(
                'receita',
                'despesa',
                'custodia',
                'custodia__cliente',
                'custodia__funcionario'
            )
        )
    ).order_by("data_pagamento", "id")

    if conta_bancaria_id:
        pagamentos = pagamentos.filter(conta_bancaria_id=conta_bancaria_id)
    if data_inicio:
        pagamentos = pagamentos.filter(data_pagamento__gte=data_inicio)
    if data_fim:
        pagamentos = pagamentos.filter(data_pagamento__lte=data_fim)

    # ── Agrupar transações por dia ────────────────────────────────────────────
    by_date = defaultdict(list)   # "DD/MM/YYYY" -> list of dicts
    total_entrada = Decimal("0.00")
    total_saida   = Decimal("0.00")

    for p in pagamentos:
        date_str = format_date_br(p.data_pagamento)
        for allocation in p.allocations.all():
            if allocation.receita:
                tipo = "Entrada"
                descricao = truncate_text(allocation.receita.nome, 38)
                total_entrada += allocation.valor
                is_entrada = True
            elif allocation.despesa:
                tipo = "Saída"
                descricao = truncate_text(allocation.despesa.nome, 38)
                total_saida += allocation.valor
                is_entrada = False
            elif allocation.custodia:
                custodia = allocation.custodia
                pessoa = (
                    custodia.cliente.nome if custodia.cliente
                    else custodia.funcionario.nome if custodia.funcionario
                    else "N/A"
                )
                is_entrada = (p.tipo == 'E')
                tipo = "Custódia Ent." if is_entrada else "Custódia Saí."
                descricao = truncate_text(f"{custodia.nome} – {pessoa}", 38)
                if is_entrada:
                    total_entrada += allocation.valor
                else:
                    total_saida += allocation.valor
            else:
                continue   # transferência interna – ignora

            by_date[date_str].append({
                "conta":      truncate_text(p.conta_bancaria.nome, 20),
                "descricao":  descricao,
                "tipo":       tipo,
                "valor":      allocation.valor,
                "is_entrada": is_entrada,
            })

    # ── Saldo inicial / final ─────────────────────────────────────────────────
    bancos = ContaBancaria.objects.filter(company=company)
    if conta_bancaria_id:
        bancos = bancos.filter(id=conta_bancaria_id)
    saldo_atual = bancos.aggregate(total=Sum('saldo_atual'))['total'] or Decimal("0.00")

    impacto_futuro = Decimal("0.00")
    if data_fim:
        futuros = Payment.objects.filter(
            company=company,
            conta_bancaria__isnull=False,
            data_pagamento__gt=data_fim
        )
        if conta_bancaria_id:
            futuros = futuros.filter(conta_bancaria_id=conta_bancaria_id)
        for fp in futuros:
            impacto_futuro += fp.valor if fp.tipo == 'E' else -fp.valor

    saldo_final   = saldo_atual - impacto_futuro
    saldo_inicial = saldo_final - total_entrada + total_saida

    # ── Montar PDF ────────────────────────────────────────────────────────────
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_fluxo_caixa.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    # Paleta de cores
    COLOR_HDR_BG   = colors.HexColor("#1E3A5F")
    COLOR_HDR_FG   = colors.white
    COLOR_DAY_BG   = colors.HexColor("#EFF6FF")
    COLOR_DAY_FG   = colors.HexColor("#1E40AF")
    COLOR_SALDO_BG = colors.HexColor("#ECFDF5")
    COLOR_GREEN    = colors.HexColor("#15803D")
    COLOR_RED      = colors.HexColor("#B91C1C")
    COLOR_ZEBRA    = colors.HexColor("#F9FAFB")
    COLOR_SEP      = colors.HexColor("#CBD5E1")
    COLOR_SUBTLE   = colors.HexColor("#6B7280")

    report = PDFReportBase("Relatório de Fluxo de Caixa Realizado", company.name, company.logo)

    date_range = ""
    if data_inicio and data_fim:
        date_range = f"{data_inicio} a {data_fim}"
    elif data_inicio:
        date_range = f"A partir de {data_inicio}"
    elif data_fim:
        date_range = f"Até {data_fim}"

    y = report.draw_header(pdf, width, height, "", date_range)
    y -= 8

    # Posições de coluna
    col_data    = margin
    col_conta   = margin + 90
    col_desc    = margin + 220
    col_tipo    = width - 285
    col_entrada = width - 185
    col_saida   = width - 95
    col_saldo   = width - margin + 5   # drawRightString

    ROW_H = 14
    DAY_H = 16

    # ── helpers locais ────────────────────────────────────────────────────────

    def draw_col_header(y_pos):
        pdf.setFillColor(COLOR_HDR_BG)
        pdf.rect(margin - 2, y_pos - 4, width - 2 * margin + 4, 16,
                 fill=True, stroke=False)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(COLOR_HDR_FG)
        pdf.drawString(col_data,  y_pos, "Data")
        pdf.drawString(col_conta, y_pos, "Conta")
        pdf.drawString(col_desc,  y_pos, "Descrição")
        pdf.drawString(col_tipo,  y_pos, "Tipo")
        pdf.drawRightString(col_entrada, y_pos, "Entradas")
        pdf.drawRightString(col_saida,   y_pos, "Saídas")
        pdf.drawRightString(col_saldo,   y_pos, "Saldo")
        pdf.setFillColor(colors.black)
        return y_pos - 20

    def check_break(y_pos, needed=ROW_H + 2):
        if y_pos < margin + needed + 20:
            report.draw_footer(pdf, width)
            pdf.showPage()
            report.page_count += 1
            return draw_col_header(height - 50)
        return y_pos

    def draw_saldo_row(y_pos, label, valor):
        pdf.setFillColor(COLOR_SALDO_BG)
        pdf.rect(margin - 2, y_pos - 4, width - 2 * margin + 4, DAY_H,
                 fill=True, stroke=False)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.setFillColor(COLOR_GREEN)
        pdf.drawString(col_data, y_pos, label)
        pdf.setFillColor(COLOR_GREEN if valor >= 0 else COLOR_RED)
        pdf.drawRightString(col_saldo, y_pos, format_currency(valor))
        pdf.setFillColor(colors.black)
        return y_pos - DAY_H - 3

    # ── Cabeçalho de colunas ──────────────────────────────────────────────────
    y = draw_col_header(y)

    # ── Saldo inicial ─────────────────────────────────────────────────────────
    y = draw_saldo_row(y, "Saldo Inicial do Período", saldo_inicial)

    # ── Dias ──────────────────────────────────────────────────────────────────
    saldo_corrente = saldo_inicial

    for date_str, txns in by_date.items():
        y = check_break(y, DAY_H + min(len(txns), 3) * ROW_H + 6)

        dia_entrada = sum(t["valor"] for t in txns if t["is_entrada"])
        dia_saida   = sum(t["valor"] for t in txns if not t["is_entrada"])
        saldo_corrente = saldo_corrente + dia_entrada - dia_saida

        # Linha-resumo do dia
        pdf.setFillColor(COLOR_DAY_BG)
        pdf.rect(margin - 2, y - 4, width - 2 * margin + 4, DAY_H,
                 fill=True, stroke=False)
        pdf.setFont("Helvetica-Bold", 9)
        pdf.setFillColor(COLOR_DAY_FG)
        pdf.drawString(col_data, y, date_str)
        pdf.setFillColor(COLOR_GREEN)
        pdf.drawRightString(col_entrada, y,
                            format_currency(dia_entrada) if dia_entrada else "—")
        pdf.setFillColor(COLOR_RED)
        pdf.drawRightString(col_saida, y,
                            format_currency(dia_saida) if dia_saida else "—")
        pdf.setFillColor(COLOR_GREEN if saldo_corrente >= 0 else COLOR_RED)
        pdf.drawRightString(col_saldo, y, format_currency(saldo_corrente))
        pdf.setFillColor(colors.black)
        y -= DAY_H + 2

        # Linhas de detalhe
        for i, txn in enumerate(txns):
            y = check_break(y)
            if i % 2 == 0:
                pdf.setFillColor(COLOR_ZEBRA)
                pdf.rect(margin - 2, y - 3, width - 2 * margin + 4, ROW_H,
                         fill=True, stroke=False)
            pdf.setFont("Helvetica", 8)
            pdf.setFillColor(COLOR_SUBTLE)
            pdf.drawString(col_conta, y, txn["conta"])
            pdf.setFillColor(colors.black)
            pdf.drawString(col_desc,  y, txn["descricao"])
            pdf.setFillColor(COLOR_GREEN if txn["is_entrada"] else COLOR_RED)
            pdf.drawString(col_tipo, y, txn["tipo"])
            if txn["is_entrada"]:
                pdf.drawRightString(col_entrada, y, format_currency(txn["valor"]))
            else:
                pdf.drawRightString(col_saida, y, format_currency(txn["valor"]))
            pdf.setFillColor(colors.black)
            y -= ROW_H

        # Separador de dia
        pdf.setStrokeColor(COLOR_SEP)
        pdf.setLineWidth(0.4)
        pdf.line(margin, y, width - margin, y)
        y -= 4

    # ── Saldo final ───────────────────────────────────────────────────────────
    y = check_break(y, DAY_H + 8)
    y = draw_saldo_row(y, "Saldo Final do Período", saldo_final)

    # ── Resumo ────────────────────────────────────────────────────────────────
    y = check_break(y, 55)
    y -= 6
    pdf.setStrokeColor(COLOR_SEP)
    pdf.setLineWidth(0.8)
    pdf.line(margin, y, width - margin, y)
    y -= 14

    def summary_line(y_pos, label, valor, bold=False, cor=colors.black):
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", 9)
        pdf.setFillColor(COLOR_SUBTLE)
        pdf.drawString(col_tipo, y_pos, label)
        pdf.setFillColor(cor)
        pdf.drawRightString(col_saldo, y_pos, format_currency(valor))
        pdf.setFillColor(colors.black)
        return y_pos - 13

    y = summary_line(y, "Total de Entradas:", total_entrada, cor=COLOR_GREEN)
    y = summary_line(y, "Total de Saídas:",   total_saida,   cor=COLOR_RED)
    y -= 4
    pdf.setStrokeColor(COLOR_SEP)
    pdf.setLineWidth(0.4)
    pdf.line(col_tipo, y, width - margin, y)
    y -= 10
    saldo_periodo = total_entrada - total_saida
    summary_line(
        y, "Saldo do Período:", saldo_periodo, bold=True,
        cor=COLOR_GREEN if saldo_periodo >= 0 else COLOR_RED
    )

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response



@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_funcionario_especifico(request):
    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    funcionario_id = request.query_params.get("funcionario_id")
    if not funcionario_id:
        return Response({"error": "funcionario_id é obrigatório"}, status=400)

    funcionario = Funcionario.objects.filter(company=company, id=funcionario_id).first()
    if not funcionario:
        return Response({"error": "Funcionário não encontrado"}, status=404)

    # Parâmetros de filtro
    incluir_custodias = request.query_params.get("incluir_custodias", "true").lower() == "true"
    visualizacao = request.query_params.get("visualizacao", "ambas")  # ambas, pagas, a_pagar

    rows = []

    # ===================== DESPESAS A PAGAR
    # Só mostra despesas a pagar se visualizacao for 'ambas' ou 'a_pagar'
    if visualizacao in ["ambas", "a_pagar"]:
        despesas_abertas = Despesa.objects.filter(
            company=company,
            responsavel=funcionario,
            situacao__in=["A", "V"]
        ).prefetch_related(
            "allocations"
        ).order_by("data_vencimento")

        total_aberto = Decimal("0.00")
        rows.append({"is_section": True, "section_title": "Despesas a Pagar"})

        for d in despesas_abertas:
            total_pago = sum(
                (alloc.valor for alloc in d.allocations.all()),
                Decimal("0.00")
            )

            valor_aberto = d.valor - total_pago

            # ❌ Não mostrar despesas quitadas
            if valor_aberto <= 0:
                continue

            rows.append({
                "data": format_date_br(d.data_vencimento),
                "descricao": truncate_text(d.nome, 40),
                "valor": valor_aberto,
            })

            total_aberto += valor_aberto

        rows.append({
            "is_subtotal": True,
            "label": "Total a Pagar",
            "valor": total_aberto,
        })

    # ===================== DESPESAS PAGAS
    # Só mostra despesas pagas se visualizacao for 'ambas' ou 'pagas'
    if visualizacao in ["ambas", "pagas"]:
        # Buscar alocações de despesas deste funcionário
        allocations = Allocation.objects.filter(
            company=company,
            despesa__responsavel=funcionario
        ).select_related(
            "payment",
            "payment__conta_bancaria",
            "despesa"
        ).order_by("payment__data_pagamento")

        total_pago = Decimal("0.00")
        rows.append({"is_section": True, "section_title": "Despesas Pagas"})

        for allocation in allocations:
            rows.append({
                "data": format_date_br(allocation.payment.data_pagamento),
                "descricao": truncate_text(allocation.despesa.nome, 40),
                "valor": allocation.valor,
            })
            total_pago += allocation.valor

        rows.append({
            "is_subtotal": True,
            "label": "Total Pago",
            "valor": total_pago,
        })

    # ===================== MOVIMENTAÇÕES DE CUSTÓDIA (se habilitado)
    if incluir_custodias:
        total_custodia_recebida = Decimal("0.00")
        total_custodia_repassada = Decimal("0.00")

        # Buscar alocações de payments para custódias deste funcionário
        allocations_custodia = Allocation.objects.filter(
            company=company,
            custodia__funcionario=funcionario
        ).select_related(
            "payment",
            "payment__conta_bancaria",
            "custodia"
        ).order_by("payment__data_pagamento")

        if allocations_custodia.exists():
            rows.append({"is_section": True, "section_title": "Movimentações de Custódia"})

            for allocation in allocations_custodia:
                payment = allocation.payment
                custodia = allocation.custodia

                if payment.tipo == 'E':  # Recebimento
                    tipo_mov = "Recebida"
                    total_custodia_recebida += allocation.valor
                else:  # Repasse/Saída
                    tipo_mov = "Repassada"
                    total_custodia_repassada += allocation.valor

                rows.append({
                    "data": format_date_br(payment.data_pagamento),
                    "descricao": truncate_text(f"{custodia.nome} ({tipo_mov})", 40),
                    "valor": allocation.valor,
                })

            rows.append({
                "is_subtotal": True,
                "label": "Total Custódia Recebida",
                "valor": total_custodia_recebida,
            })

            rows.append({
                "is_subtotal": True,
                "label": "Total Custódia Repassada",
                "valor": total_custodia_repassada,
            })

        # ===================== CUSTÓDIAS EM ABERTO
        total_custodia_passivo = Decimal("0.00")
        total_custodia_ativo = Decimal("0.00")

        # Buscar custódias do funcionário
        custodias = Custodia.objects.filter(
            company=company,
            funcionario=funcionario
        ).order_by('criado_em')

        custodias_abertas = []
        for custodia in custodias:
            valor_aberto = custodia.valor_total - custodia.valor_liquidado
            if valor_aberto > 0:
                custodias_abertas.append((custodia, valor_aberto))

        if custodias_abertas:
            rows.append({"is_section": True, "section_title": "Custódias em Aberto"})

            for custodia, valor_aberto in custodias_abertas:
                tipo_custodia = "A Repassar" if custodia.tipo == 'P' else "A Receber"
                rows.append({
                    "data": format_date_br(custodia.criado_em.date()),
                    "descricao": truncate_text(f"{custodia.nome} ({tipo_custodia})", 40),
                    "valor": valor_aberto,
                })

                if custodia.tipo == 'P':
                    total_custodia_passivo += valor_aberto
                else:
                    total_custodia_ativo += valor_aberto

            if total_custodia_passivo > 0:
                rows.append({
                    "is_subtotal": True,
                    "label": "Total a Repassar",
                    "valor": total_custodia_passivo,
                })

            if total_custodia_ativo > 0:
                rows.append({
                    "is_subtotal": True,
                    "label": "Total a Receber",
                    "valor": total_custodia_ativo,
                })

    # ===================== PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=relatorio_funcionario_{funcionario_id}.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Funcionário / Fornecedor", company.name, company.logo)
    y = report.draw_header(pdf, width, height, funcionario.nome)

    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": "Descrição", "key": "descricao", "x": margin + 120},
        {"label": "Valor", "key": "valor", "x": width - 100, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)

        if row.get("is_section"):
            pdf.setFont("Helvetica-Bold", 10)
            pdf.drawString(margin, y, row["section_title"])
            y -= 15
        elif row.get("is_subtotal"):
            pdf.setFont("Helvetica-Bold", 9)
            pdf.drawString(margin, y, row["label"])
            pdf.drawString(width - 100, y, format_currency(row["valor"]))
            y -= 15
        else:
            y = report.draw_row(pdf, y, row, columns)

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response

"""
View para geração de relatório DRE em PDF
Usa ReportLab para criar um PDF profissional e bem formatado
"""

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from decimal import Decimal
from datetime import datetime, timedelta, date


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_dre_consolidado(request):
    """
    Gera relatório de DRE consolidado em PDF

    Query Parameters:
    - mes: Mês (1-12)
    - ano: Ano (YYYY)
    """

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    mes = request.query_params.get('mes')
    ano = request.query_params.get('ano')

    if not mes or not ano:
        hoje = datetime.now()
        mes = hoje.month
        ano = hoje.year
    else:
        mes = int(mes)
        ano = int(ano)

    data_inicio = f"{ano}-{str(mes).zfill(2)}-01"
    if mes == 12:
        data_fim = f"{ano + 1}-01-01"
    else:
        data_fim = f"{ano}-{str(mes + 1).zfill(2)}-01"
    data_fim = (datetime.strptime(data_fim, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

    receitas = Receita.objects.filter(
        company=company,
        data_vencimento__gte=data_inicio,
        data_vencimento__lte=data_fim
    )
    despesas = Despesa.objects.filter(
        company=company,
        data_vencimento__gte=data_inicio,
        data_vencimento__lte=data_fim
    )

    receitas_fixas    = receitas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    receitas_variaveis = receitas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    estornos          = receitas.filter(tipo='E').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    total_receitas    = float(receitas_fixas) + float(receitas_variaveis) + float(estornos)

    despesas_fixas    = despesas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    despesas_variaveis = despesas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    comissoes         = despesas.filter(tipo='C').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    total_despesas    = float(despesas_fixas) + float(despesas_variaveis) + float(comissoes)

    resultado = total_receitas - total_despesas

    # ── PDF ────────────────────────────────────────────────────────────────────
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=dre_{mes:02d}_{ano}.pdf"

    pdf = canvas.Canvas(response, pagesize=A4)
    width, height = A4
    margin = 60
    right_col = width - margin

    # Paleta monocromática — apenas preto/cinza + um acento no resultado
    C_BLACK    = colors.HexColor("#111827")
    C_DARK     = colors.HexColor("#374151")
    C_MUTED    = colors.HexColor("#6B7280")
    C_LINE     = colors.HexColor("#D1D5DB")
    C_BG       = colors.HexColor("#F3F4F6")
    C_RES_POS  = colors.HexColor("#14532D")   # verde escuro
    C_RES_NEG  = colors.HexColor("#7F1D1D")   # vermelho escuro

    y = height - margin

    # ── Logo / Nome da empresa ─────────────────────────────────────────────────
    if company.logo:
        try:
            logo_w, logo_h = 140, 60
            pdf.drawImage(
                company.logo.path,
                (width - logo_w) / 2, y - 55,
                width=logo_w, height=logo_h,
                preserveAspectRatio=True, mask='auto'
            )
            y -= 72
        except Exception:
            pdf.setFont("Helvetica-Bold", 15)
            pdf.setFillColor(C_BLACK)
            pdf.drawCentredString(width / 2, y - 10, company.name)
            y -= 28
    else:
        pdf.setFont("Helvetica-Bold", 15)
        pdf.setFillColor(C_BLACK)
        pdf.drawCentredString(width / 2, y - 10, company.name)
        y -= 28

    # ── Título ─────────────────────────────────────────────────────────────────
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(C_BLACK)
    pdf.drawCentredString(width / 2, y, "DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO")
    y -= 16

    meses_nomes = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(C_MUTED)
    pdf.drawCentredString(width / 2, y, f"{meses_nomes[mes - 1]} de {ano}")
    y -= 10

    pdf.setStrokeColor(C_LINE)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, right_col, y)
    y -= 28

    # ── Helpers de desenho ────────────────────────────────────────────────────
    def section_header(label, y_pos):
        pdf.setFillColor(C_BG)
        pdf.rect(margin, y_pos - 3, width - 2 * margin, 20, fill=True, stroke=False)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.setFillColor(C_DARK)
        pdf.drawString(margin + 8, y_pos + 4, label)
        return y_pos - 24

    def item_row(label, value, y_pos):
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(C_BLACK)
        pdf.drawString(margin + 20, y_pos, label)
        pdf.drawRightString(right_col, y_pos, format_currency(float(value)))
        return y_pos - 17

    def subtotal_row(label, value, y_pos):
        y_pos += 4
        pdf.setStrokeColor(C_LINE)
        pdf.setLineWidth(0.5)
        pdf.line(margin, y_pos, right_col, y_pos)
        y_pos -= 14
        pdf.setFont("Helvetica-Bold", 10)
        pdf.setFillColor(C_DARK)
        pdf.drawString(margin + 8, y_pos, label)
        pdf.drawRightString(right_col, y_pos, format_currency(float(value)))
        return y_pos - 22

    # ── RECEITAS ──────────────────────────────────────────────────────────────
    y = section_header("RECEITAS", y)
    y = item_row("Receitas Fixas",     receitas_fixas,     y)
    y = item_row("Receitas Variáveis", receitas_variaveis, y)
    y = item_row("Estornos",           estornos,           y)
    y = subtotal_row("Total de Receitas", total_receitas,  y)

    y -= 10

    # ── DESPESAS ──────────────────────────────────────────────────────────────
    y = section_header("DESPESAS", y)
    y = item_row("Despesas Fixas",    despesas_fixas,    y)
    y = item_row("Despesas Variáveis", despesas_variaveis, y)
    y = item_row("Comissões",         comissoes,         y)
    y = subtotal_row("Total de Despesas", total_despesas, y)

    y -= 18

    # ── RESULTADO ─────────────────────────────────────────────────────────────
    pdf.setStrokeColor(C_DARK)
    pdf.setLineWidth(1.5)
    pdf.line(margin, y + 2, right_col, y + 2)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y - 2, right_col, y - 2)
    y -= 20

    pdf.setFont("Helvetica-Bold", 13)
    pdf.setFillColor(C_RES_POS if resultado >= 0 else C_RES_NEG)
    pdf.drawString(margin + 8, y, "RESULTADO DO PERÍODO")
    pdf.drawRightString(right_col, y, format_currency(resultado))

    # ── Rodapé ────────────────────────────────────────────────────────────────
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(C_MUTED)
    pdf.drawString(margin, margin, f"Gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M')}")
    pdf.drawRightString(right_col, margin, "Página 1")

    pdf.showPage()
    pdf.save()

    return response

"""
View para geração de Recibo de Pagamento em PDF
Usa ReportLab para criar um recibo profissional e bem formatado
Com estrutura separada para Receitas e Despesas
"""

from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, portrait
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.units import inch
from decimal import Decimal
from datetime import datetime
import io

from .models import Payment, Company


def format_currency(value):
    """Formata valor como moeda brasileira."""
    if isinstance(value, Decimal):
        value = float(value)
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")




@api_view(["GET"])
@permission_classes([IsAuthenticated])
def recibo_pagamento(request):
    """
    Gera recibo de honorários advocatícios em PDF (formato FRS)
    Baseado no modelo de recibo profissional de prestação de serviços

    Query Parameters:
    - payment_id: ID do pagamento (obrigatório)
    """

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    payment_id = request.query_params.get('payment_id')
    if not payment_id:
        return Response({"error": "payment_id é obrigatório"}, status=400)

    try:
        payment = Payment.objects.select_related(
            'company',
            'conta_bancaria'
        ).prefetch_related(
            Prefetch(
                'allocations',
                queryset=Allocation.objects.select_related(
                    'receita__cliente',
                    'despesa__responsavel'
                )
            )
        ).get(id=payment_id, company=company)
    except Payment.DoesNotExist:
        return Response({"error": "Pagamento não encontrado"}, status=404)

    # Pegar a primeira alocação de receita (se existir)
    receita_allocation = payment.allocations.filter(receita__isnull=False).first()

    # Validação: Apenas receitas por enquanto
    if not receita_allocation:
        return Response({"error": "Recibo disponível apenas para receitas"}, status=400)

    # 🔹 Criar PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=recibo_honorarios_{payment_id}.pdf"

    pdf = canvas.Canvas(response, pagesize=portrait(A4))
    width, height = portrait(A4)

    # 🔹 Cores (baseado no modelo FRS)
    color_navy = colors.HexColor("#1E3A8A")       # Azul navy (logo)
    color_gray_bg = colors.HexColor("#D1D5DB")    # Cinza para fundo do título
    color_text = colors.black                      # Texto preto

    # 🔹 Margens
    margin = 50
    y = height - margin

    # ========== CABEÇALHO COM LOGO CENTRALIZADA ==========
    # Logo FRS centralizada (se existir)
    if company.logo:
        try:
            from reportlab.lib.utils import ImageReader
            logo_path = company.logo.path
            # Logo centralizada no topo com tamanho aumentado
            logo_width = 180
            logo_height = 90
            logo_x = (width - logo_width) / 2
            pdf.drawImage(logo_path, logo_x, y - 70, width=logo_width, height=logo_height, preserveAspectRatio=True, mask='auto')
        except Exception as e:
            # Se falhar, apenas desenha o nome da empresa centralizado
            pdf.setFont("Helvetica-Bold", 18)
            pdf.setFillColor(color_navy)
            pdf.drawCentredString(width / 2, y - 40, company.name)
    else:
        # Se não tiver logo, desenha o nome da empresa centralizado
        pdf.setFont("Helvetica-Bold", 18)
        pdf.setFillColor(color_navy)
        pdf.drawCentredString(width / 2, y - 40, company.name)

    y -= 90

    # ========== TÍTULO COM FUNDO CINZA ==========
    # Retângulo de fundo cinza
    pdf.setFillColor(color_gray_bg)
    pdf.rect(margin - 10, y - 20, width - 2 * margin + 20, 30, fill=True, stroke=False)

    # Título
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(color_text)
    titulo = "RECIBO"
    pdf.drawCentredString(width / 2, y - 10, titulo)

    y -= 50

    # ========== MARCA D'ÁGUA (opcional) ==========
    # Desenhar marca d'água FRS no quadrante inferior direito (270-360 graus)
    if company.logo:
        try:
            from reportlab.lib.utils import ImageReader
            # Salvar estado atual
            pdf.saveState()
            # Configurar transparência para marca d'água
            pdf.setFillAlpha(0.05)  # 5% de opacidade
            # Desenhar logo grande no canto inferior direito (quadrante 270-360 graus)
            watermark_size = 300
            watermark_x = width - watermark_size - margin
            watermark_y = margin
            pdf.drawImage(
                company.logo.path,
                watermark_x,
                watermark_y,
                width=watermark_size,
                height=watermark_size,
                preserveAspectRatio=True,
                mask='auto'
            )
            # Restaurar estado
            pdf.restoreState()
        except Exception:
            pass  # Se falhar, continua sem marca d'água

    # ========== CORPO DO RECIBO ==========
    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(color_text)

    # Data por extenso
    meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
             'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
    data_pagamento = payment.data_pagamento
    mes_extenso = meses[data_pagamento.month - 1]
    cidade = company.cidade if company.cidade else "Belém"
    data_extenso = f"{cidade}, {data_pagamento.day} de {mes_extenso} de {data_pagamento.year}."

    pdf.drawString(margin, y, data_extenso)
    y -= 40  # Mais espaço após data

    # Destinatário
    cliente = receita_allocation.receita.cliente
    pdf.drawString(margin, y, "À/Ao")
    y -= 20
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(margin, y, f"{cliente.nome.upper()},")
    y -= 20

    pdf.setFont("Helvetica", 11)
    pdf.drawString(margin, y, "Nesta,")
    y -= 40  # Mais espaço após "Nesta,"

    # Determinar forma de pagamento
    forma_pagamento = payment.observacao if payment.observacao else "transferência bancária"

    # Texto formal com parágrafo justificado
    texto_formal = (
        f"Honrado em cumprimentá-lo/a, informamos que recebemos nesta data os seguintes "
        f"valores, por meio de {forma_pagamento}, referentes ao contrato de prestação "
        f"dos seguintes serviços:"
    )

    # Criar estilo de parágrafo justificado
    styles = getSampleStyleSheet()
    style_justify = ParagraphStyle(
        'Justify',
        parent=styles['Normal'],
        alignment=TA_JUSTIFY,
        fontSize=10,
        leading=18,  # Espaçamento entre linhas
        fontName='Helvetica'
    )

    # Criar parágrafo e calcular altura
    paragrafo = Paragraph(texto_formal, style_justify)
    paragrafo_width = width - 2 * margin
    paragrafo_height = paragrafo.wrap(paragrafo_width, height)[1]

    # Desenhar parágrafo
    paragrafo.drawOn(pdf, margin, y - paragrafo_height)
    y -= (paragrafo_height + 30)  # Espaço após o parágrafo

    # ========== TABELA DE VALORES ==========
    # Desenhar tabela com bordas completas (mesma largura do título)
    table_x = margin
    table_width = width - 2 * margin
    table_col_split = table_width * 0.7  # 70% para descrição, 30% para valor

    # Configurar estilo da tabela
    pdf.setStrokeColor(color_text)
    pdf.setLineWidth(0.5)

    # Altura das linhas (aumentar para mais padding)
    row_height = 25
    y_table_top = y

    # Linha superior
    pdf.line(table_x, y, table_x + table_width, y)

    y -= row_height

    # Primeira linha: Nome da receita
    pdf.setFont("Helvetica", 10)
    receita_nome = receita_allocation.receita.nome or "Honorários advocatícios"
    pdf.drawString(table_x + 10, y + 8, receita_nome)
    pdf.drawRightString(table_x + table_width - 10, y + 8, format_currency(receita_allocation.valor))

    # Linha divisória horizontal
    pdf.line(table_x, y, table_x + table_width, y)

    y -= row_height

    # Segunda linha: Total
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(table_x + 10, y + 8, "TOTAL")
    pdf.drawRightString(table_x + table_width - 10, y + 8, format_currency(receita_allocation.valor))

    # Linha inferior
    pdf.line(table_x, y, table_x + table_width, y)

    # Bordas verticais
    pdf.line(table_x, y_table_top, table_x, y)  # Borda esquerda
    pdf.line(table_x + table_width, y_table_top, table_x + table_width, y)  # Borda direita
    pdf.line(table_x + table_col_split, y_table_top, table_x + table_col_split, y)  # Divisória central

    y -= 100  # Ainda mais espaço após a tabela para a assinatura

    # ========== ASSINATURA ==========
    # Nome e OAB
    pdf.setFont("Helvetica-Bold", 11)
    pdf.setFillColor(color_text)

    # Nome do responsável (usar nome da empresa ou usuário)
    responsavel_nome = "DANIEL PETROLA SABOYA"  # Fixo por enquanto
    oab = "OAB/PA 27.333"  # Fixo por enquanto

    pdf.drawCentredString(width / 2, y, responsavel_nome)
    y -= 15
    pdf.setFont("Helvetica", 10)
    pdf.drawCentredString(width / 2, y, oab)

    y -= 80

    # ========== RODAPÉ COM INFORMAÇÕES DE CONTATO ==========
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(colors.HexColor("#6B7280"))

    # Endereço
    if company.endereco:
        endereco_linha = company.endereco
        if company.cidade and company.estado:
            endereco_linha += f" - {company.cidade} | {company.estado}"
        pdf.drawString(margin, margin + 40, endereco_linha)

    # Telefone e email
    if company.telefone or company.email:
        contato = []
        if company.telefone:
            contato.append(company.telefone)
        if company.email:
            contato.append(company.email)
        pdf.drawString(margin, margin + 25, " | ".join(contato))

    pdf.showPage()
    pdf.save()

    return response




@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_comissionamento_pdf(request):
    """
    Relatório PDF de comissionamento com detalhes dos pagamentos por comissionado.

    Query params:
    - mes (int, required): Mês (1-12)
    - ano (int, required): Ano (YYYY)
    - funcionario_id (int, optional): ID do funcionário para filtrar

    Retorna PDF com:
    - Lista de pagamentos por comissionado
    - Percentual de comissão por cliente
    - Valor da comissão de cada pagamento
    - Totais por comissionado e geral
    """
    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    # Validar parâmetros
    mes = request.query_params.get('mes')
    ano = request.query_params.get('ano')
    funcionario_id = request.query_params.get('funcionario_id')

    if not mes or not ano:
        return Response(
            {"error": "Parâmetros 'mes' e 'ano' são obrigatórios"},
            status=400
        )

    try:
        mes = int(mes)
        ano = int(ano)
        if not (1 <= mes <= 12):
            raise ValueError()
    except ValueError:
        return Response(
            {"error": "Mês deve ser um número entre 1 e 12"},
            status=400
        )

    # Buscar alocações de receitas do mês/ano
    allocations = Allocation.objects.filter(
        company=company,
        receita__isnull=False,
        payment__data_pagamento__month=mes,
        payment__data_pagamento__year=ano
    ).prefetch_related(
        'receita__comissoes__funcionario',
        'receita__cliente__comissoes__funcionario'
    ).select_related('payment', 'receita__cliente')

    # Filtrar apenas alocações com pelo menos uma regra de comissão
    from django.db.models import Q
    allocations = allocations.filter(
        Q(receita__comissoes__isnull=False) |
        Q(receita__comissoes__isnull=True, receita__cliente__comissoes__isnull=False)
    ).distinct()

    # Filtrar por funcionário se especificado (no nível Python, após prefetch)
    filter_func_id = int(funcionario_id) if funcionario_id else None

    # Agrupar por comissionado, expandindo as regras de cada alocação
    comissionados_data = {}
    for allocation in allocations:
        regras = list(allocation.receita.comissoes.all())
        if not regras:
            regras = list(allocation.receita.cliente.comissoes.all())

        for regra in regras:
            comissionado = regra.funcionario
            if filter_func_id and comissionado.id != filter_func_id:
                continue

            if comissionado.id not in comissionados_data:
                comissionados_data[comissionado.id] = {
                    'comissionado': comissionado,
                    'pagamentos': []
                }

            percentual_efetivo = regra.percentual
            comissionados_data[comissionado.id]['pagamentos'].append({
                'data': allocation.payment.data_pagamento,
                'cliente': allocation.receita.cliente.nome,
                'valor_pagamento': allocation.valor,
                'percentual': percentual_efetivo,
                'valor_comissao': allocation.valor * (percentual_efetivo / Decimal('100.00'))
            })

    if not comissionados_data:
        return Response(
            {"error": f"Nenhum pagamento com comissionado encontrado para {mes}/{ano}"},
            status=400
        )

    # Criar PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="comissionamento_{mes}_{ano}.pdf"'

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 50

    # Helper para formatação
    def format_currency_br(valor):
        return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    # Criar instância única do report para manter o contador de páginas consistente
    report = PDFReportBase("Relatório de Comissionamento", company.name, company.logo)

    # Helper para desenhar header consistente
    def draw_page_header():
        """Desenha header padrão em todas as páginas."""
        y_pos = report.draw_header(pdf, width, height, f"Período: {mes:02d}/{ano}")
        return y_pos - 10

    # Helper para desenhar cabeçalho da tabela
    def draw_table_header(y_pos, comissionado_nome):
        """Desenha o nome do comissionado e cabeçalho da tabela."""
        # Nome do comissionado
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(margin, y_pos, f"Comissionado: {comissionado_nome}")
        y_pos -= 25

        # Cabeçalho da tabela
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(col_data, y_pos, "Data")
        pdf.drawString(col_cliente, y_pos, "Cliente")
        pdf.drawRightString(col_valor_pag + 80, y_pos, "Valor Pago")
        pdf.drawRightString(col_percentual + 60, y_pos, "% Comissão")
        pdf.drawRightString(col_comissao + 80, y_pos, "Valor Comissão")

        y_pos -= 2
        pdf.line(margin, y_pos, width - margin, y_pos)
        y_pos -= 15
        return y_pos

    # Definir colunas (uma vez)
    col_data = margin
    col_cliente = col_data + 80
    col_valor_pag = col_cliente + 200
    col_percentual = col_valor_pag + 100
    col_comissao = col_percentual + 80

    # Iterar por comissionado
    total_geral = Decimal('0.00')
    primeira_pagina = True

    for data in comissionados_data.values():
        comissionado = data['comissionado']
        pagamentos = data['pagamentos']

        # Iniciar nova página para cada comissionado (exceto o primeiro)
        if not primeira_pagina:
            report.draw_footer(pdf, width)
            pdf.showPage()

        primeira_pagina = False

        # Desenhar header da página
        y = draw_page_header()

        # Desenhar cabeçalho da tabela
        y = draw_table_header(y, comissionado.nome)

        # Dados da tabela
        pdf.setFont("Helvetica", 9)
        total_comissionado = Decimal('0.00')

        for pag in sorted(pagamentos, key=lambda x: x['data']):
            # Verificar se precisa de nova página
            if y < 80:
                report.draw_footer(pdf, width)
                pdf.showPage()
                y = draw_page_header()
                y = draw_table_header(y, comissionado.nome)
                pdf.setFont("Helvetica", 9)

            pdf.drawString(col_data, y, format_date_br(pag['data']))

            # Truncar nome do cliente se necessário
            cliente_nome = pag['cliente']
            if len(cliente_nome) > 35:
                cliente_nome = cliente_nome[:32] + "..."
            pdf.drawString(col_cliente, y, cliente_nome)

            pdf.drawRightString(col_valor_pag + 80, y, format_currency_br(pag['valor_pagamento']))
            pdf.drawRightString(col_percentual + 60, y, f"{pag['percentual']:.2f}%")
            pdf.drawRightString(col_comissao + 80, y, format_currency_br(pag['valor_comissao']))

            total_comissionado += pag['valor_comissao']
            y -= 15

        # Total do comissionado
        y -= 5
        pdf.line(margin, y, width - margin, y)
        y -= 15
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(margin, y, f"Total {comissionado.nome}:")
        pdf.drawRightString(col_comissao + 80, y, format_currency_br(total_comissionado))

        total_geral += total_comissionado

    # Adicionar footer na última página do último comissionado
    report.draw_footer(pdf, width)

    # Resumo consolidado por comissionado
    pdf.showPage()
    y = draw_page_header()
    y -= 10

    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(margin, y, "RESUMO CONSOLIDADO")
    y -= 20

    pdf.setLineWidth(1)
    pdf.line(margin, y, width - margin, y)
    y -= 15

    # Cabeçalho da tabela de resumo
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(margin, y, "Advogado / Comissionado")
    pdf.drawRightString(col_comissao + 80, y, "Total a Receber")
    y -= 5
    pdf.line(margin, y, width - margin, y)
    y -= 15

    # Uma linha por comissionado
    pdf.setFont("Helvetica", 10)
    for data in comissionados_data.values():
        comissionado = data['comissionado']
        total_comissionado = sum(p['valor_comissao'] for p in data['pagamentos'])
        pdf.drawString(margin, y, comissionado.nome)
        pdf.drawRightString(col_comissao + 80, y, format_currency_br(total_comissionado))
        y -= 15

    # Linha separadora antes do total geral
    y -= 5
    pdf.setLineWidth(1.5)
    pdf.line(margin, y, width - margin, y)
    y -= 15

    # Total geral
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(margin, y, "TOTAL GERAL")
    pdf.drawRightString(col_comissao + 80, y, format_currency_br(total_geral))

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_balanco_pdf(request):
    """
    Relatório PDF do Fluxo de Caixa Realizado (estilo balanço).
    Espelha a página relatórios/balanço: seções Entradas / Saídas / Resultado,
    agrupadas por banco ou por tipo.

    Query params:
    - mes (int)
    - ano (int)
    - agrupamento: 'banco' | 'tipo'  (padrão: 'banco')
    - incluir_custodias: 'true' | 'false'  (padrão: 'true')
    """
    from reportlab.lib import colors

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    mes_param = request.query_params.get('mes')
    ano_param = request.query_params.get('ano')
    agrupamento = request.query_params.get('agrupamento', 'banco')
    incluir_custodias = request.query_params.get('incluir_custodias', 'true').lower() == 'true'

    if not mes_param or not ano_param:
        hoje = datetime.now()
        mes, ano = hoje.month, hoje.year
    else:
        mes, ano = int(mes_param), int(ano_param)

    data_inicio = f"{ano}-{str(mes).zfill(2)}-01"
    if mes == 12:
        data_fim_raw = f"{ano + 1}-01-01"
    else:
        data_fim_raw = f"{ano}-{str(mes + 1).zfill(2)}-01"
    data_fim = (datetime.strptime(data_fim_raw, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

    # ── Buscar dados (mesma lógica do balanco_patrimonial) ────────────────────
    payment_ids_transferencia = Allocation.objects.filter(
        payment__company=company,
        payment__data_pagamento__gte=data_inicio,
        payment__data_pagamento__lte=data_fim,
        transfer__isnull=False
    ).values_list('payment_id', flat=True)

    pagamentos = Payment.objects.filter(
        company=company,
        data_pagamento__gte=data_inicio,
        data_pagamento__lte=data_fim
    ).exclude(
        id__in=payment_ids_transferencia
    ).select_related('conta_bancaria').prefetch_related(
        'allocations__receita', 'allocations__despesa', 'allocations__custodia'
    )

    allocations = Allocation.objects.filter(
        payment__company=company,
        payment__data_pagamento__gte=data_inicio,
        payment__data_pagamento__lte=data_fim,
        transfer__isnull=True
    ).select_related('payment', 'payment__conta_bancaria', 'receita', 'despesa', 'custodia')

    entradas_por_banco = {}
    saidas_por_banco   = {}
    entradas_por_tipo  = {}
    saidas_por_tipo    = {}

    TIPO_RECEITA_MAP = {'F': 'Receita Fixa', 'V': 'Receita Variável', 'E': 'Estorno'}
    TIPO_DESPESA_MAP = {'F': 'Despesa Fixa', 'V': 'Despesa Variável',
                        'C': 'Comissionamento', 'R': 'Reembolso'}

    for pag in pagamentos:
        banco = pag.conta_bancaria.nome
        valor = float(pag.valor)
        if pag.tipo == 'E':
            entradas_por_banco[banco] = entradas_por_banco.get(banco, 0) + valor
        elif pag.tipo == 'S':
            saidas_por_banco[banco] = saidas_por_banco.get(banco, 0) + valor

    pagamentos_alocados = set()
    for alloc in allocations:
        valor = float(alloc.valor)
        tipo_pag = alloc.payment.tipo
        pagamentos_alocados.add(alloc.payment.id)

        if alloc.receita:
            tipo_nome = TIPO_RECEITA_MAP.get(alloc.receita.tipo, 'Outro')
        elif alloc.despesa:
            tipo_nome = TIPO_DESPESA_MAP.get(alloc.despesa.tipo, 'Outro')
        elif alloc.custodia:
            tipo_nome = 'Valores Reembolsados' if tipo_pag == 'E' else 'Valores Reembolsáveis'
        else:
            tipo_nome = 'Não Alocado'

        if tipo_pag == 'E':
            entradas_por_tipo[tipo_nome] = entradas_por_tipo.get(tipo_nome, 0) + valor
        elif tipo_pag == 'S':
            saidas_por_tipo[tipo_nome] = saidas_por_tipo.get(tipo_nome, 0) + valor

    for pag in pagamentos:
        if pag.id not in pagamentos_alocados:
            valor = float(pag.valor)
            if pag.tipo == 'E':
                entradas_por_tipo['Não Alocado'] = entradas_por_tipo.get('Não Alocado', 0) + valor
            elif pag.tipo == 'S':
                saidas_por_tipo['Não Alocado'] = saidas_por_tipo.get('Não Alocado', 0) + valor

    ORDEM_ENTRADAS = ['Receita Fixa', 'Receita Variável', 'Valores Reembolsados', 'Estorno', 'Não Alocado']
    ORDEM_SAIDAS   = ['Despesa Fixa', 'Despesa Variável', 'Valores Reembolsáveis',
                      'Comissionamento', 'Reembolso', 'Não Alocado']

    def ordered_list(d, ordem):
        result = [(k, d[k]) for k in ordem if k in d]
        result += [(k, v) for k, v in d.items() if k not in ordem]
        return result

    if agrupamento == 'banco':
        entradas_items = list(entradas_por_banco.items())
        saidas_items   = list(saidas_por_banco.items())
    else:
        entradas_items = ordered_list(entradas_por_tipo, ORDEM_ENTRADAS)
        saidas_items   = ordered_list(saidas_por_tipo,   ORDEM_SAIDAS)
        if not incluir_custodias:
            entradas_items = [(k, v) for k, v in entradas_items if k != 'Valores Reembolsados']
            saidas_items   = [(k, v) for k, v in saidas_items   if k != 'Valores Reembolsáveis']

    total_entradas = sum(v for _, v in entradas_items)
    total_saidas   = sum(v for _, v in saidas_items)
    resultado      = total_entradas - total_saidas

    # ── PDF ───────────────────────────────────────────────────────────────────
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=balanco_{mes:02d}_{ano}.pdf"

    pdf = canvas.Canvas(response, pagesize=A4)
    width, height = A4
    margin    = 60
    right_col = width - margin

    C_BLACK  = colors.HexColor("#111827")
    C_DARK   = colors.HexColor("#374151")
    C_MUTED  = colors.HexColor("#6B7280")
    C_LINE   = colors.HexColor("#D1D5DB")
    C_BG     = colors.HexColor("#F3F4F6")
    C_GREEN  = colors.HexColor("#14532D")
    C_RED    = colors.HexColor("#7F1D1D")

    y = height - margin

    # Logo / nome
    if company.logo:
        try:
            logo_w, logo_h = 140, 60
            pdf.drawImage(
                company.logo.path,
                (width - logo_w) / 2, y - 55,
                width=logo_w, height=logo_h,
                preserveAspectRatio=True, mask='auto'
            )
            y -= 72
        except Exception:
            pdf.setFont("Helvetica-Bold", 15)
            pdf.setFillColor(C_BLACK)
            pdf.drawCentredString(width / 2, y - 10, company.name)
            y -= 28
    else:
        pdf.setFont("Helvetica-Bold", 15)
        pdf.setFillColor(C_BLACK)
        pdf.drawCentredString(width / 2, y - 10, company.name)
        y -= 28

    # Títulos
    MESES_NOMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                   "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    agrup_label = "por Banco" if agrupamento == 'banco' else "por Tipo"

    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(C_BLACK)
    pdf.drawCentredString(width / 2, y, "FLUXO DE CAIXA REALIZADO")
    y -= 16

    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(C_MUTED)
    pdf.drawCentredString(width / 2, y, f"{MESES_NOMES[mes - 1]} de {ano}  ·  Agrupado {agrup_label}")
    y -= 10

    pdf.setStrokeColor(C_LINE)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y, right_col, y)
    y -= 24

    # Helpers de desenho
    def section_header(label, y_pos, bg=C_BG):
        pdf.setFillColor(bg)
        pdf.rect(margin, y_pos - 3, width - 2 * margin, 20, fill=True, stroke=False)
        pdf.setFont("Helvetica-Bold", 10)
        pdf.setFillColor(C_DARK)
        pdf.drawString(margin + 8, y_pos + 4, label)
        return y_pos - 26

    def item_row(label, value, y_pos):
        pdf.setFont("Helvetica", 10)
        pdf.setFillColor(C_BLACK)
        pdf.drawString(margin + 20, y_pos, label)
        pdf.drawRightString(right_col, y_pos, format_currency(value))
        return y_pos - 17

    def subtotal_row(label, value, y_pos, color=C_DARK):
        y_pos += 4
        pdf.setStrokeColor(C_LINE)
        pdf.setLineWidth(0.5)
        pdf.line(margin, y_pos, right_col, y_pos)
        y_pos -= 14
        pdf.setFont("Helvetica-Bold", 10)
        pdf.setFillColor(color)
        pdf.drawString(margin + 8, y_pos, label)
        pdf.drawRightString(right_col, y_pos, format_currency(value))
        return y_pos - 22

    # ENTRADAS
    y = section_header("ENTRADAS  (Recebimentos)", y)
    if entradas_items:
        for label, valor in entradas_items:
            y = item_row(label, valor, y)
        y = subtotal_row("Total de Entradas", total_entradas, y)
    else:
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(C_MUTED)
        pdf.drawString(margin + 20, y, "Nenhuma entrada registrada neste período")
        y -= 22

    y -= 10

    # SAÍDAS
    y = section_header("SAÍDAS  (Pagamentos)", y)
    if saidas_items:
        for label, valor in saidas_items:
            y = item_row(label, valor, y)
        y = subtotal_row("Total de Saídas", total_saidas, y)
    else:
        pdf.setFont("Helvetica", 9)
        pdf.setFillColor(C_MUTED)
        pdf.drawString(margin + 20, y, "Nenhuma saída registrada neste período")
        y -= 22

    y -= 18

    # RESULTADO
    pdf.setStrokeColor(C_DARK)
    pdf.setLineWidth(1.5)
    pdf.line(margin, y + 2, right_col, y + 2)
    pdf.setLineWidth(0.5)
    pdf.line(margin, y - 2, right_col, y - 2)
    y -= 20

    pdf.setFont("Helvetica-Bold", 13)
    pdf.setFillColor(C_GREEN if resultado >= 0 else C_RED)
    pdf.drawString(margin + 8, y, "RESULTADO DO PERÍODO")
    pdf.drawRightString(right_col, y, format_currency(resultado))

    # Rodapé
    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(C_MUTED)
    pdf.drawString(margin, margin, f"Gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M')}")
    pdf.drawRightString(right_col, margin, "Página 1")

    pdf.showPage()
    pdf.save()

    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def relatorio_dre_detalhe(request):
    """
    Gera um relatório PDF detalhado com todos os lançamentos de um tipo específico da DRE.

    Query Parameters:
    - mes: Mês (1-12)
    - ano: Ano (YYYY)
    - tipo_relatorio: 'receita' ou 'despesa'
    - tipo: código do tipo ('F', 'V', 'E' para receitas; 'F', 'V', 'C', 'R' para despesas)
    """

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    mes = request.query_params.get('mes')
    ano = request.query_params.get('ano')
    tipo_relatorio = request.query_params.get('tipo_relatorio', '').lower()
    tipo = request.query_params.get('tipo', '')

    if tipo_relatorio not in ('receita', 'despesa'):
        return Response({"error": "Parâmetro 'tipo_relatorio' deve ser 'receita' ou 'despesa'."}, status=400)

    if not tipo:
        return Response({"error": "Parâmetro 'tipo' é obrigatório."}, status=400)

    if not mes or not ano:
        hoje = datetime.now()
        mes = hoje.month
        ano = hoje.year
    else:
        mes = int(mes)
        ano = int(ano)

    data_inicio = f"{ano}-{str(mes).zfill(2)}-01"
    if mes == 12:
        data_fim_raw = f"{ano + 1}-01-01"
    else:
        data_fim_raw = f"{ano}-{str(mes + 1).zfill(2)}-01"
    data_fim = (datetime.strptime(data_fim_raw, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")

    meses_nomes = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ]
    periodo_str = f"{meses_nomes[mes - 1]} de {ano}"

    SITUACAO_MAP = {'P': 'Pago', 'A': 'Em Aberto', 'V': 'Vencido'}

    rows = []
    total = Decimal('0.00')

    if tipo_relatorio == 'receita':
        TIPO_LABEL_MAP = {'F': 'Receitas Fixas', 'V': 'Receitas Variáveis', 'E': 'Estornos'}
        titulo_tipo = TIPO_LABEL_MAP.get(tipo, f'Receitas (Tipo {tipo})')
        titulo = f"Relatório DRE — {titulo_tipo}"

        qs = Receita.objects.filter(
            company=company,
            tipo=tipo,
            data_vencimento__gte=data_inicio,
            data_vencimento__lte=data_fim,
        ).select_related('cliente').order_by('data_vencimento')

        for receita in qs:
            rows.append({
                'data': format_date_br(receita.data_vencimento),
                'pessoa': truncate_text(receita.cliente.nome, 28),
                'descricao': truncate_text(receita.nome, 38),
                'situacao': SITUACAO_MAP.get(receita.situacao, receita.situacao),
                'valor': receita.valor,
            })
            total += receita.valor

        col_pessoa_label = "Cliente"
        filename = f"dre_receitas_{tipo.lower()}_{mes:02d}_{ano}.pdf"

    else:  # despesa
        TIPO_LABEL_MAP = {'F': 'Despesas Fixas', 'V': 'Despesas Variáveis', 'C': 'Comissões', 'R': 'Reembolsos'}
        titulo_tipo = TIPO_LABEL_MAP.get(tipo, f'Despesas (Tipo {tipo})')
        titulo = f"Relatório DRE — {titulo_tipo}"

        qs = Despesa.objects.filter(
            company=company,
            tipo=tipo,
            data_vencimento__gte=data_inicio,
            data_vencimento__lte=data_fim,
        ).select_related('responsavel').order_by('data_vencimento')

        for despesa in qs:
            rows.append({
                'data': format_date_br(despesa.data_vencimento),
                'pessoa': truncate_text(despesa.responsavel.nome, 28),
                'descricao': truncate_text(despesa.nome, 38),
                'situacao': SITUACAO_MAP.get(despesa.situacao, despesa.situacao),
                'valor': despesa.valor,
            })
            total += despesa.valor

        col_pessoa_label = "Favorecido"
        filename = f"dre_despesas_{tipo.lower()}_{mes:02d}_{ano}.pdf"

    # ── PDF ────────────────────────────────────────────────────────────────────
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename={filename}"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase(titulo, company.name, company.logo)
    y = report.draw_header(pdf, width, height, "", periodo_str)

    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": col_pessoa_label, "key": "pessoa", "x": margin + 90},
        {"label": "Descrição", "key": "descricao", "x": margin + 240},
        {"label": "Situação", "key": "situacao", "x": width - 200},
        {"label": "Valor", "key": "valor", "x": width - 100, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)
        y = report.draw_row(pdf, y, row, columns)

    if rows:
        y -= 5
        report.draw_total_row(
            pdf,
            y,
            "TOTAL",
            total,
            columns[-2]["x"],
            columns[-1]["x"],
        )

    report.draw_footer(pdf, width)
    pdf.showPage()
    pdf.save()

    return response
