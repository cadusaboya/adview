"""
Views para geração de relatórios em PDF do JurisFinance
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
from datetime import datetime, timedelta
from django.db.models import Sum, Q, F, DecimalField, Prefetch
from django.db.models.functions import Coalesce

from .models import Receita, Despesa, Payment, ContaBancaria, Cliente, Funcionario, Company
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

    pagamentos = Payment.objects.filter(
        company=company,
        receita__isnull=False
    ).select_related(
        "receita",
        "receita__cliente",
        "conta_bancaria"
    ).order_by("data_pagamento")

    if cliente_id:
        pagamentos = pagamentos.filter(receita__cliente_id=cliente_id)
    if data_inicio:
        pagamentos = pagamentos.filter(data_pagamento__gte=data_inicio)
    if data_fim:
        pagamentos = pagamentos.filter(data_pagamento__lte=data_fim)

    rows = []
    total = Decimal("0.00")

    for p in pagamentos:
        rows.append({
            "data": format_date_br(p.data_pagamento),
            "cliente": truncate_text(p.receita.cliente.nome, 25),
            "descricao": truncate_text(p.receita.nome, 35),
            "tipo": "Recebido",
            "valor": p.valor,
        })
        total += p.valor

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_receitas_pagas.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Receitas Recebidas", company.name)
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

    rows = []

    # ===================== CONTAS A RECEBER (CORRIGIDO)
    receitas_abertas = Receita.objects.filter(
        company=company,
        cliente=cliente,
        situacao__in=["A", "V"]
    ).prefetch_related(
        "payments"
    ).order_by("data_vencimento")

    total_aberto = Decimal("0.00")

    rows.append({"is_section": True, "section_title": "Contas a Receber"})

    for r in receitas_abertas:
        total_recebido = sum(
            (p.valor for p in r.payments.all()),
            Decimal("0.00")
        )

        valor_aberto = r.valor - total_recebido

        # ❌ Não mostrar receitas quitadas
        if valor_aberto <= 0:
            continue

        rows.append({
            "data": format_date_br(r.data_vencimento),
            "descricao": truncate_text(r.nome, 40),
            "valor": valor_aberto,
        })

        total_aberto += valor_aberto

    rows.append({
        "is_subtotal": True,
        "label": "Total a Receber",
        "valor": total_aberto,
    })

    # ===================== CONTAS RECEBIDAS (JÁ CORRETO)
    pagamentos = Payment.objects.filter(
        company=company,
        receita__cliente=cliente
    ).select_related(
        "receita",
        "conta_bancaria"
    ).order_by("data_pagamento")

    total_recebido = Decimal("0.00")

    rows.append({"is_section": True, "section_title": "Contas Recebidas"})

    for p in pagamentos:
        rows.append({
            "data": format_date_br(p.data_pagamento),
            "descricao": truncate_text(p.receita.nome, 40),
            "valor": p.valor,
        })
        total_recebido += p.valor

    rows.append({
        "is_subtotal": True,
        "label": "Total Recebido",
        "valor": total_recebido,
    })

    # ===================== PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=relatorio_cliente_{cliente_id}.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Cliente", company.name)
    y = report.draw_header(pdf, width, height, f"Cliente: {cliente.nome}")

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

    pagamentos = Payment.objects.filter(
        company=company,
        despesa__isnull=False
    ).select_related(
        "despesa",
        "despesa__responsavel",
        "conta_bancaria"
    ).order_by("data_pagamento")

    if responsavel_id:
        pagamentos = pagamentos.filter(despesa__responsavel_id=responsavel_id)
    if data_inicio:
        pagamentos = pagamentos.filter(data_pagamento__gte=data_inicio)
    if data_fim:
        pagamentos = pagamentos.filter(data_pagamento__lte=data_fim)

    rows = []
    total = Decimal("0.00")

    for p in pagamentos:
        rows.append({
            "data": format_date_br(p.data_pagamento),
            "responsavel": truncate_text(p.despesa.responsavel.nome, 25),
            "descricao": truncate_text(p.despesa.nome, 35),
            "tipo": "Pago",
            "valor": p.valor,
        })
        total += p.valor

    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_despesas_pagas.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Despesas Pagas", company.name)
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
        "payments"
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
            (p.valor for p in despesa.payments.all()),
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

    report = PDFReportBase("Relatório de Despesas a Pagar", company.name)

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
        "payments"
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
            (p.valor for p in receita.payments.all()),
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

    report = PDFReportBase("Relatório de Receitas a Receber", company.name)

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
    Relatório de Fluxo de Caixa
    Baseado exclusivamente em pagamentos que movimentam conta bancária.

    Filtros:
    - conta_bancaria_id
    - data_inicio
    - data_fim
    """

    try:
        company = get_company_from_request(request)
    except PermissionError as e:
        return Response({"error": str(e)}, status=403)

    conta_bancaria_id = request.query_params.get("conta_bancaria_id")
    data_inicio = request.query_params.get("data_inicio")
    data_fim = request.query_params.get("data_fim")

    # 🔹 SOMENTE pagamentos que movimentam conta bancária
    pagamentos = Payment.objects.filter(
        company=company,
        conta_bancaria__isnull=False
    ).select_related(
        "conta_bancaria",
        "receita",
        "despesa"
    ).order_by("data_pagamento")

    # 🔹 Filtros
    if conta_bancaria_id:
        pagamentos = pagamentos.filter(conta_bancaria_id=conta_bancaria_id)
    if data_inicio:
        pagamentos = pagamentos.filter(data_pagamento__gte=data_inicio)
    if data_fim:
        pagamentos = pagamentos.filter(data_pagamento__lte=data_fim)

    rows = []
    total_entrada = Decimal("0.00")
    total_saida = Decimal("0.00")

    for p in pagamentos:
        # 🔹 Determinar tipo de movimentação
        if p.receita_id:
            tipo = "Entrada"
            total_entrada += p.valor
            descricao = truncate_text(p.receita.nome, 40)
        elif p.despesa_id:
            tipo = "Saída"
            total_saida += p.valor
            descricao = truncate_text(p.despesa.nome, 40)
        else:
            # ❌ Pagamento que não representa caixa real
            continue

        rows.append({
            "data": format_date_br(p.data_pagamento),
            "conta": truncate_text(p.conta_bancaria.nome, 25),
            "descricao": descricao,
            "tipo": tipo,
            "valor": p.valor,
        })

    # 🔹 Preparar PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=relatorio_fluxo_caixa.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Fluxo de Caixa", company.name)

    date_range = ""
    if data_inicio and data_fim:
        date_range = f"{data_inicio} a {data_fim}"
    elif data_inicio:
        date_range = f"A partir de {data_inicio}"

    y = report.draw_header(pdf, width, height, "", date_range)

    # 🔹 Colunas
    columns = [
        {"label": "Data", "key": "data", "x": margin},
        {"label": "Conta Bancária", "key": "conta", "x": margin + 120},
        {"label": "Descrição", "key": "descricao", "x": margin + 300},
        {"label": "Tipo", "key": "tipo", "x": width - 220},
        {"label": "Valor", "key": "valor", "x": width - 100, "is_amount": True},
    ]

    y = report.draw_table_header(pdf, y, columns, width, height)

    # 🔹 Linhas
    for row in rows:
        y = report.check_page_break(pdf, y, width, height, columns)
        y = report.draw_row(pdf, y, row, columns)

    # 🔹 Totais finais
    y -= 10
    pdf.setFont("Helvetica-Bold", 9)

    pdf.drawString(columns[-2]["x"], y, "Total Entradas:")
    pdf.drawString(columns[-1]["x"], y, format_currency(total_entrada))
    y -= 15

    pdf.drawString(columns[-2]["x"], y, "Total Saídas:")
    pdf.drawString(columns[-1]["x"], y, format_currency(total_saida))
    y -= 15

    saldo = total_entrada - total_saida
    pdf.drawString(columns[-2]["x"], y, "Saldo do Período:")
    pdf.drawString(columns[-1]["x"], y, format_currency(saldo))

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

    rows = []

    # ===================== DESPESAS A PAGAR (CORRIGIDO)
    despesas_abertas = Despesa.objects.filter(
        company=company,
        responsavel=funcionario,
        situacao__in=["A", "V"]
    ).prefetch_related(
        "payments"
    ).order_by("data_vencimento")

    total_aberto = Decimal("0.00")
    rows.append({"is_section": True, "section_title": "Despesas a Pagar"})

    for d in despesas_abertas:
        total_pago = sum(
            (p.valor for p in d.payments.all()),
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

    # ===================== DESPESAS PAGAS (JÁ CORRETO)
    pagamentos = Payment.objects.filter(
        company=company,
        despesa__responsavel=funcionario
    ).select_related(
        "despesa",
        "conta_bancaria"
    ).order_by("data_pagamento")

    total_pago = Decimal("0.00")
    rows.append({"is_section": True, "section_title": "Despesas Pagas"})

    for p in pagamentos:
        rows.append({
            "data": format_date_br(p.data_pagamento),
            "descricao": truncate_text(p.despesa.nome, 40),
            "valor": p.valor,
        })
        total_pago += p.valor

    rows.append({
        "is_subtotal": True,
        "label": "Total Pago",
        "valor": total_pago,
    })

    # ===================== PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=relatorio_funcionario_{funcionario_id}.pdf"

    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40

    report = PDFReportBase("Relatório de Funcionário / Fornecedor", company.name)
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


