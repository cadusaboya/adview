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
            "payments"
        ).order_by("data_vencimento")

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
        pagamentos = Payment.objects.filter(
            company=company,
            receita__cliente=cliente
        ).select_related(
            "receita",
            "conta_bancaria"
        ).order_by("data_pagamento")

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


def get_company_from_request(request):
    """Extrai a empresa do usuário autenticado."""
    if hasattr(request.user, 'company') and request.user.company:
        return request.user.company
    raise PermissionError("Usuário não possui empresa associada")


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
    
    # 🔹 Pegar parâmetros de mês e ano
    mes = request.query_params.get('mes')
    ano = request.query_params.get('ano')
    
    # 🔹 Se não tiver mês/ano, usar mês atual
    if not mes or not ano:
        hoje = datetime.now()
        mes = hoje.month
        ano = hoje.year
    else:
        mes = int(mes)
        ano = int(ano)
    
    # 🔹 Calcular data de início e fim do mês
    data_inicio = f"{ano}-{str(mes).zfill(2)}-01"
    # Último dia do mês
    if mes == 12:
        data_fim = f"{ano + 1}-01-01"
    else:
        data_fim = f"{ano}-{str(mes + 1).zfill(2)}-01"
    data_fim = (datetime.strptime(data_fim, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # 🔹 Filtrar receitas por período do mês
    receitas = Receita.objects.filter(
        company=company,
        data_vencimento__gte=data_inicio,
        data_vencimento__lte=data_fim
    )
    
    # 🔹 Filtrar despesas por período do mês
    despesas = Despesa.objects.filter(
        company=company,
        data_vencimento__gte=data_inicio,
        data_vencimento__lte=data_fim
    )
    
    # 🔹 Agrupar receitas por tipo
    receitas_fixas = receitas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    receitas_variaveis = receitas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    estornos = receitas.filter(tipo='E').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    
    total_receitas = float(receitas_fixas) + float(receitas_variaveis) + float(estornos)
    
    # 🔹 Agrupar despesas por tipo
    despesas_fixas = despesas.filter(tipo='F').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    despesas_variaveis = despesas.filter(tipo='V').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    comissoes = despesas.filter(tipo='C').aggregate(Sum('valor'))['valor__sum'] or Decimal('0.00')
    
    total_despesas = float(despesas_fixas) + float(despesas_variaveis) + float(comissoes)
    
    # 🔹 Calcular resultado
    resultado = total_receitas - total_despesas
    
    # 🔹 Criar PDF
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = f"inline; filename=dre_{mes:02d}_{ano}.pdf"
    
    pdf = canvas.Canvas(response, pagesize=landscape(A4))
    width, height = landscape(A4)
    margin = 40
    
    # 🔹 Header
    report = PDFReportBase("Demonstração do Resultado (DRE)", company.name)
    y = report.draw_header(pdf, width, height, f"Período: {str(mes).zfill(2)}/{ano}")
    
    # 🔹 Dados da DRE
    y -= 20
    
    # ========== RECEITAS ==========
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(colors.HexColor("#1E40AF"))  # Azul escuro
    pdf.drawString(margin, y, "RECEITAS")
    y -= 15
    
    # Receitas Fixas
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.black)
    pdf.drawString(margin + 20, y, "Receitas Fixas")
    pdf.drawRightString(width - margin, y, format_currency(float(receitas_fixas)))
    y -= 12
    
    # Receitas Variáveis
    pdf.drawString(margin + 20, y, "Receitas Variáveis")
    pdf.drawRightString(width - margin, y, format_currency(float(receitas_variaveis)))
    y -= 12
    
    # Estornos
    pdf.drawString(margin + 20, y, "Estornos")
    pdf.drawRightString(width - margin, y, format_currency(float(estornos)))
    y -= 15
    
    # Total Receitas
    pdf.setFont("Helvetica-Bold", 11)
    pdf.setFillColor(colors.HexColor("#065F46"))  # Verde escuro
    pdf.drawString(margin, y, "Total de Receitas")
    pdf.drawRightString(width - margin, y, format_currency(total_receitas))
    y -= 20
    
    # ========== DESPESAS ==========
    pdf.setFont("Helvetica-Bold", 12)
    pdf.setFillColor(colors.HexColor("#7F1D1D"))  # Vermelho escuro
    pdf.drawString(margin, y, "DESPESAS")
    y -= 15
    
    # Despesas Fixas
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.black)
    pdf.drawString(margin + 20, y, "Despesas Fixas")
    pdf.drawRightString(width - margin, y, format_currency(float(despesas_fixas)))
    y -= 12
    
    # Despesas Variáveis
    pdf.drawString(margin + 20, y, "Despesas Variáveis")
    pdf.drawRightString(width - margin, y, format_currency(float(despesas_variaveis)))
    y -= 12
    
    # Comissões
    pdf.drawString(margin + 20, y, "Comissões")
    pdf.drawRightString(width - margin, y, format_currency(float(comissoes)))
    y -= 15
    
    # Total Despesas
    pdf.setFont("Helvetica-Bold", 11)
    pdf.setFillColor(colors.HexColor("#7F1D1D"))  # Vermelho escuro
    pdf.drawString(margin, y, "Total de Despesas")
    pdf.drawRightString(width - margin, y, format_currency(total_despesas))
    y -= 20
    
    # ========== RESULTADO ==========
    # Desenhar linha separadora
    pdf.setStrokeColor(colors.grey)
    pdf.setLineWidth(1)
    pdf.line(margin, y, width - margin, y)
    y -= 15
    
    # Resultado
    pdf.setFont("Helvetica-Bold", 13)
    if resultado >= 0:
        pdf.setFillColor(colors.HexColor("#059669"))  # Verde
    else:
        pdf.setFillColor(colors.HexColor("#DC2626"))  # Vermelho
    
    pdf.drawString(margin, y, "RESULTADO")
    pdf.drawRightString(width - margin, y, format_currency(resultado))
    
    # 🔹 Footer
    report.draw_footer(pdf, width)
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


def get_company_from_request(request):
    """Extrai a empresa do usuário autenticado."""
    if hasattr(request.user, 'company') and request.user.company:
        return request.user.company
    raise PermissionError("Usuário não possui empresa associada")


def format_currency(value):
    """Formata valor como moeda brasileira."""
    if isinstance(value, Decimal):
        value = float(value)
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_currency_extenso(value):
    """Converte valor em extenso (simplificado)."""
    if isinstance(value, Decimal):
        value = float(value)
    
    # Função auxiliar para converter números em extenso
    def numero_extenso(n):
        unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
        dezenas = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
        tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
        
        if n == 0:
            return 'zero'
        
        if n < 10:
            return unidades[n]
        elif n < 20:
            return dezenas[n - 10]
        elif n < 100:
            return tens[n // 10] + (' e ' + unidades[n % 10] if n % 10 != 0 else '')
        elif n < 1000:
            return unidades[n // 100] + ' centos' + (' e ' + numero_extenso(n % 100) if n % 100 != 0 else '')
        elif n < 1000000:
            return numero_extenso(n // 1000) + ' mil' + (' e ' + numero_extenso(n % 1000) if n % 1000 != 0 else '')
        else:
            return numero_extenso(n // 1000000) + ' milhões' + (' e ' + numero_extenso(n % 1000000) if n % 1000000 != 0 else '')
    
    # Separar inteiros e centavos
    partes = str(value).split('.')
    inteiros = int(partes[0])
    centavos = int(partes[1]) if len(partes) > 1 else 0
    
    texto = numero_extenso(inteiros) + ' reais'
    if centavos > 0:
        texto += f' e {numero_extenso(centavos)} centavos'
    
    return texto.capitalize()


def format_date_br(date_obj) -> str:
    """Formata data no padrão DD/MM/YYYY."""
    if date_obj is None:
        return "-"
    return date_obj.strftime("%d/%m/%Y") if date_obj else "-"


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
            'conta_bancaria',
            'receita',
            'receita__cliente',
            'despesa',
            'despesa__responsavel'
        ).get(id=payment_id, company=company)
    except Payment.DoesNotExist:
        return Response({"error": "Pagamento não encontrado"}, status=404)

    # Validação: Apenas receitas por enquanto
    if not payment.receita:
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

    # ========== CABEÇALHO COM LOGO E WEBSITE ==========
    # Logo FRS (se existir)
    if company.logo:
        try:
            from reportlab.lib.utils import ImageReader
            logo_path = company.logo.path
            # Logo no canto superior esquerdo
            pdf.drawImage(logo_path, margin, y - 60, width=120, height=60, preserveAspectRatio=True, mask='auto')
        except Exception as e:
            # Se falhar, apenas desenha o nome da empresa
            pdf.setFont("Helvetica-Bold", 18)
            pdf.setFillColor(color_navy)
            pdf.drawString(margin, y - 40, company.name)
    else:
        # Se não tiver logo, desenha o nome da empresa
        pdf.setFont("Helvetica-Bold", 18)
        pdf.setFillColor(color_navy)
        pdf.drawString(margin, y - 40, company.name)

    # Website no canto superior direito (valor fixo por enquanto)
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(color_text)
    website = "frsadv.com.br"  # Fixo por enquanto
    pdf.drawRightString(width - margin, y - 20, website)

    # Slogan
    pdf.setFont("Helvetica-Oblique", 9)
    pdf.setFillColor(colors.HexColor("#6B7280"))
    pdf.drawString(margin, y - 75, "advocacia e consultoria")

    y -= 100

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
    # Desenhar marca d'água FRS grande no centro/fundo
    if company.logo:
        try:
            from reportlab.lib.utils import ImageReader
            # Salvar estado atual
            pdf.saveState()
            # Configurar transparência para marca d'água
            pdf.setFillAlpha(0.05)  # 5% de opacidade
            # Desenhar logo grande no centro do documento
            watermark_size = 300
            watermark_x = (width - watermark_size) / 2
            watermark_y = (height - watermark_size) / 2
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
    cliente = payment.receita.cliente
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
    receita_nome = payment.receita.nome or "Honorários advocatícios"
    pdf.drawString(table_x + 10, y + 8, receita_nome)
    pdf.drawRightString(table_x + table_width - 10, y + 8, format_currency(payment.valor))

    # Linha divisória horizontal
    pdf.line(table_x, y, table_x + table_width, y)

    y -= row_height

    # Segunda linha: Total
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(table_x + 10, y + 8, "TOTAL")
    pdf.drawRightString(table_x + table_width - 10, y + 8, format_currency(payment.valor))

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


