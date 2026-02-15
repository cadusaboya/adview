import json
from datetime import date, timedelta
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook

from core.models import Allocation, Payment
from core.tests.base import APITestBase
from core.tests.factories import (
    make_allocation,
    make_cliente,
    make_conta,
    make_custodia,
    make_despesa,
    make_funcionario,
    make_payment,
    make_receita,
    make_transfer,
)


class PaymentLifecycleTests(APITestBase):
    def test_payment_create_update_destroy_updates_account_balance(self):
        conta_a = make_conta(self.company, saldo="100.00")
        conta_b = make_conta(self.company, saldo="50.00")

        create = self.client.post(
            "/api/pagamentos/",
            {
                "tipo": "E",
                "conta_bancaria": conta_a.id,
                "valor": "40.00",
                "data_pagamento": str(date.today()),
                "observacao": "entrada",
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.data)

        conta_a.refresh_from_db()
        self.assertEqual(str(conta_a.saldo_atual), "140.00")

        payment_id = create.data["id"]
        update = self.client.patch(
            f"/api/pagamentos/{payment_id}/",
            {"tipo": "S", "conta_bancaria": conta_b.id, "valor": "30.00"},
            format="json",
        )
        self.assertEqual(update.status_code, 200, update.data)

        conta_a.refresh_from_db()
        conta_b.refresh_from_db()
        self.assertEqual(str(conta_a.saldo_atual), "100.00")
        self.assertEqual(str(conta_b.saldo_atual), "20.00")

        delete = self.client.delete(f"/api/pagamentos/{payment_id}/")
        self.assertEqual(delete.status_code, 204)

        conta_b.refresh_from_db()
        self.assertEqual(str(conta_b.saldo_atual), "50.00")


class PaymentQueryFilterTests(APITestBase):
    def setUp(self):
        super().setUp()
        self.conta_a = make_conta(self.company, nome="Banco A", saldo="0.00")
        self.conta_b = make_conta(self.company, nome="Banco B", saldo="0.00")

        self.p1 = make_payment(
            self.company,
            self.conta_a,
            tipo="E",
            valor="120.00",
            data_pagamento=date.today() - timedelta(days=3),
            observacao="Recebimento cliente",
        )
        self.p2 = make_payment(
            self.company,
            self.conta_b,
            tipo="S",
            valor="80.00",
            data_pagamento=date.today() - timedelta(days=1),
            observacao="Pagamento fornecedor",
        )

        cliente = make_cliente(self.company, nome="Cliente filtro")
        funcionario = make_funcionario(self.company, tipo="F", nome="Fornecedor filtro")
        receita = make_receita(self.company, cliente, valor="120.00", situacao="A")
        despesa = make_despesa(self.company, funcionario, valor="80.00", situacao="V")

        make_allocation(self.company, self.p1, valor="120.00", receita=receita)
        make_allocation(self.company, self.p2, valor="80.00", despesa=despesa)

    def test_filter_by_tipo(self):
        resp = self.client.get("/api/pagamentos/?tipo=E")
        self.assertEqual(resp.status_code, 200)
        ids = {item["id"] for item in self.results(resp)}
        self.assertIn(self.p1.id, ids)
        self.assertNotIn(self.p2.id, ids)

    def test_filter_by_conta(self):
        resp = self.client.get(f"/api/pagamentos/?conta_bancaria_id={self.conta_b.id}")
        self.assertEqual(resp.status_code, 200)
        ids = {item["id"] for item in self.results(resp)}
        self.assertEqual(ids, {self.p2.id})

    def test_filter_by_situacao(self):
        resp = self.client.get("/api/pagamentos/?situacao=V")
        self.assertEqual(resp.status_code, 200)
        ids = {item["id"] for item in self.results(resp)}
        self.assertEqual(ids, {self.p2.id})

    def test_filter_by_date_range(self):
        start = str(date.today() - timedelta(days=2))
        resp = self.client.get(f"/api/pagamentos/?start_date={start}")
        self.assertEqual(resp.status_code, 200)
        ids = {item["id"] for item in self.results(resp)}
        self.assertIn(self.p2.id, ids)
        self.assertNotIn(self.p1.id, ids)

    def test_filter_by_search(self):
        resp = self.client.get("/api/pagamentos/?search=fornecedor")
        self.assertEqual(resp.status_code, 200)
        ids = {item["id"] for item in self.results(resp)}
        self.assertEqual(ids, {self.p2.id})


class PaymentImportExtratoTests(APITestBase):
    def _xlsx(self, header, rows):
        wb = Workbook()
        ws = wb.active
        ws.append(header)
        for r in rows:
            ws.append(r)

        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        bio.name = "extrato.xlsx"
        return bio

    def test_import_extrato_requires_file(self):
        conta = make_conta(self.company, saldo="0.00")
        resp = self.client.post("/api/pagamentos/import-extrato/", {"conta_bancaria_id": conta.id})
        self.assertEqual(resp.status_code, 400)

    def test_import_extrato_requires_conta(self):
        xlsx = self._xlsx(["Data", "Descrição", "Entradas / Saídas (R$)"], [])
        resp = self.client.post(
            "/api/pagamentos/import-extrato/",
            {"file": xlsx},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 400)

    def test_import_extrato_conta_not_found(self):
        xlsx = self._xlsx(["Data", "Descrição", "Entradas / Saídas (R$)"], [])
        resp = self.client.post(
            "/api/pagamentos/import-extrato/",
            {"conta_bancaria_id": 999999, "file": xlsx},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 404)

    def test_import_extrato_invalid_header_returns_400(self):
        conta = make_conta(self.company, saldo="0.00")
        xlsx = self._xlsx(["Sem data", "Outra"], [["x", "y"]])
        resp = self.client.post(
            "/api/pagamentos/import-extrato/",
            {"conta_bancaria_id": conta.id, "file": xlsx},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 400)

    def test_import_extrato_valid_file_creates_payment(self):
        conta = make_conta(self.company, saldo="0.00")
        xlsx = self._xlsx(
            ["Data", "Descrição do lançamento", "Entradas / Saídas (R$)"],
            [[date.today().strftime("%d/%m/%Y"), "PIX Cliente XPTO", "100,00"]],
        )

        resp = self.client.post(
            "/api/pagamentos/import-extrato/",
            {"conta_bancaria_id": conta.id, "file": xlsx},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["created_count"], 1)

    def test_import_extrato_duplicate_exact_skips(self):
        conta = make_conta(self.company, saldo="0.00")
        make_payment(
            self.company,
            conta,
            tipo="E",
            valor="100.00",
            data_pagamento=date.today(),
            observacao="PIX Cliente XPTO",
        )
        xlsx = self._xlsx(
            ["Data", "Descrição do lançamento", "Entradas / Saídas (R$)"],
            [[date.today().strftime("%d/%m/%Y"), "PIX Cliente XPTO", "100,00"]],
        )

        resp = self.client.post(
            "/api/pagamentos/import-extrato/",
            {"conta_bancaria_id": conta.id, "file": xlsx},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["created_count"], 0)
        self.assertGreaterEqual(resp.data["skipped_count"], 1)

    def test_import_extrato_potential_duplicate_requires_confirmation(self):
        conta = make_conta(self.company, saldo="0.00")
        make_payment(
            self.company,
            conta,
            tipo="E",
            valor="100.00",
            data_pagamento=date.today(),
            observacao="OBS ANTIGA",
        )
        xlsx = self._xlsx(
            ["Data", "Descrição do lançamento", "Entradas / Saídas (R$)"],
            [[date.today().strftime("%d/%m/%Y"), "OBS NOVA", "100,00"]],
        )

        resp = self.client.post(
            "/api/pagamentos/import-extrato/",
            {"conta_bancaria_id": conta.id, "file": xlsx},
            format="multipart",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["requires_confirmation"])

    def test_import_extrato_confirmed_with_force_import_lines(self):
        conta = make_conta(self.company, saldo="0.00")
        make_payment(
            self.company,
            conta,
            tipo="E",
            valor="100.00",
            data_pagamento=date.today(),
            observacao="OBS ANTIGA",
        )
        xlsx = self._xlsx(
            ["Data", "Descrição do lançamento", "Entradas / Saídas (R$)"],
            [[date.today().strftime("%d/%m/%Y"), "OBS NOVA", "100,00"]],
        )

        resp = self.client.post(
            "/api/pagamentos/import-extrato/",
            {
                "conta_bancaria_id": conta.id,
                "file": xlsx,
                "confirmed": "true",
                "force_import_lines": json.dumps([2]),
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(resp.data["created_count"], 1)


class PaymentConciliationAndSuggestionTests(APITestBase):
    def test_conciliar_bancario_validates_params(self):
        resp_missing = self.client.post("/api/pagamentos/conciliar-bancario/", {}, format="json")
        self.assertEqual(resp_missing.status_code, 400)

        resp_invalid = self.client.post(
            "/api/pagamentos/conciliar-bancario/",
            {"mes": "abc", "ano": "2026"},
            format="json",
        )
        self.assertEqual(resp_invalid.status_code, 400)

        resp_range = self.client.post(
            "/api/pagamentos/conciliar-bancario/",
            {"mes": 13, "ano": 2026},
            format="json",
        )
        self.assertEqual(resp_range.status_code, 400)

    def test_conciliar_automatic_matches_receita_and_despesa(self):
        cliente = make_cliente(self.company, nome="Cliente Match")
        funcionario = make_funcionario(self.company, tipo="F", nome="Fornecedor Match")
        receita = make_receita(self.company, cliente, valor="150.00", nome="Receita Match")
        despesa = make_despesa(self.company, funcionario, valor="90.00", nome="Despesa Match")

        conta = make_conta(self.company, saldo="0.00")
        p_entrada = make_payment(
            self.company,
            conta,
            tipo="E",
            valor="150.00",
            data_pagamento=date.today(),
            observacao=f"recebido {cliente.nome}",
        )
        p_saida = make_payment(
            self.company,
            conta,
            tipo="S",
            valor="90.00",
            data_pagamento=date.today(),
            observacao=f"pago {funcionario.nome}",
        )

        resp = self.client.post(
            "/api/pagamentos/conciliar-bancario/",
            {"mes": date.today().month, "ano": date.today().year},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(Allocation.objects.filter(payment=p_entrada, receita=receita).exists())
        self.assertTrue(Allocation.objects.filter(payment=p_saida, despesa=despesa).exists())

    def test_conciliar_returns_suggestions_when_no_name_match(self):
        cliente = make_cliente(self.company, nome="Cliente Sem Match")
        make_receita(self.company, cliente, valor="200.00", nome="Receita Sugerida")

        conta = make_conta(self.company, saldo="0.00")
        make_payment(
            self.company,
            conta,
            tipo="E",
            valor="200.00",
            data_pagamento=date.today(),
            observacao="texto sem nome",
        )

        resp = self.client.post(
            "/api/pagamentos/conciliar-bancario/",
            {"mes": date.today().month, "ano": date.today().year},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertGreaterEqual(resp.data["total_sugestoes"], 1)

    def test_confirmar_sugestao_validations_and_success(self):
        cliente = make_cliente(self.company)
        receita = make_receita(self.company, cliente, valor="120.00", nome="Rec Confirm")
        conta = make_conta(self.company)
        payment = make_payment(self.company, conta, tipo="E", valor="120.00", data_pagamento=date.today())

        missing = self.client.post("/api/pagamentos/confirmar-sugestao/", {}, format="json")
        self.assertEqual(missing.status_code, 400)

        not_found = self.client.post(
            "/api/pagamentos/confirmar-sugestao/",
            {"payment_id": 999999, "tipo": "receita", "entidade_id": receita.id},
            format="json",
        )
        self.assertEqual(not_found.status_code, 404)

        invalid_type = self.client.post(
            "/api/pagamentos/confirmar-sugestao/",
            {"payment_id": payment.id, "tipo": "foo", "entidade_id": receita.id},
            format="json",
        )
        self.assertEqual(invalid_type.status_code, 400)

        mismatch = self.client.post(
            "/api/pagamentos/confirmar-sugestao/",
            {"payment_id": payment.id, "tipo": "despesa", "entidade_id": 999999},
            format="json",
        )
        self.assertEqual(mismatch.status_code, 404)

        ok = self.client.post(
            "/api/pagamentos/confirmar-sugestao/",
            {"payment_id": payment.id, "tipo": "receita", "entidade_id": receita.id},
            format="json",
        )
        self.assertEqual(ok.status_code, 200, ok.data)

        already = self.client.post(
            "/api/pagamentos/confirmar-sugestao/",
            {"payment_id": payment.id, "tipo": "receita", "entidade_id": receita.id},
            format="json",
        )
        self.assertEqual(already.status_code, 400)


class CustodiaAndTransferViewSetTests(APITestBase):
    def setUp(self):
        super().setUp()
        self.cliente = make_cliente(self.company, nome="Cli Custodia")
        self.funcionario = make_funcionario(self.company, tipo="F", nome="Func Custodia")

    def test_custodia_filters(self):
        c1 = make_custodia(self.company, cliente=self.cliente, tipo="A", valor_total="100.00")
        c2 = make_custodia(self.company, funcionario=self.funcionario, tipo="P", valor_total="200.00")

        c1.status = "A"
        c1.save(update_fields=["status"])
        c2.status = "P"
        c2.save(update_fields=["status"])

        by_tipo = self.client.get("/api/custodias/?tipo=A")
        self.assertEqual(by_tipo.status_code, 200)
        ids = {item["id"] for item in self.results(by_tipo)}
        self.assertIn(c1.id, ids)
        self.assertNotIn(c2.id, ids)

        by_status_multi = self.client.get("/api/custodias/?status=A&status=P")
        self.assertEqual(by_status_multi.status_code, 200)
        ids = {item["id"] for item in self.results(by_status_multi)}
        self.assertTrue({c1.id, c2.id}.issubset(ids))

        by_search = self.client.get("/api/custodias/?search=Func Custodia")
        self.assertEqual(by_search.status_code, 200)
        ids = {item["id"] for item in self.results(by_search)}
        self.assertIn(c2.id, ids)

    def test_transfer_filters_and_status(self):
        b1 = make_conta(self.company, nome="Origem")
        b2 = make_conta(self.company, nome="Destino")
        b3 = make_conta(self.company, nome="Outro")

        t1 = make_transfer(self.company, b1, b2, valor="100.00")
        t2 = make_transfer(self.company, b3, b2, valor="50.00")

        # completa t1 para status C
        p_saida = make_payment(self.company, b1, tipo="S", valor="100.00")
        p_entrada = make_payment(self.company, b2, tipo="E", valor="100.00")
        make_allocation(self.company, p_saida, valor="100.00", transfer=t1)
        make_allocation(self.company, p_entrada, valor="100.00", transfer=t1)
        t1.atualizar_status()

        by_from = self.client.get(f"/api/transferencias/?from_bank_id={b1.id}")
        self.assertEqual(by_from.status_code, 200)
        ids = {item["id"] for item in self.results(by_from)}
        self.assertEqual(ids, {t1.id})

        by_status = self.client.get("/api/transferencias/?status=C")
        self.assertEqual(by_status.status_code, 200)
        ids = {item["id"] for item in self.results(by_status)}
        self.assertIn(t1.id, ids)
        self.assertNotIn(t2.id, ids)

        by_search = self.client.get("/api/transferencias/?search=Origem")
        self.assertEqual(by_search.status_code, 200)
        ids = {item["id"] for item in self.results(by_search)}
        self.assertIn(t1.id, ids)


class BankingCrossTenantTests(APITestBase):
    def test_user_cannot_access_other_company_payment(self):
        conta_b = make_conta(self.company_b, saldo="0.00")
        payment_b = make_payment(self.company_b, conta_b, tipo="E", valor="99.00")

        resp = self.client.get(f"/api/pagamentos/{payment_b.id}/")
        self.assertEqual(resp.status_code, 404)

    def test_confirmar_sugestao_cannot_use_other_company_payment(self):
        conta_b = make_conta(self.company_b, saldo="0.00")
        payment_b = make_payment(self.company_b, conta_b, tipo="E", valor="99.00")

        cliente = make_cliente(self.company)
        receita = make_receita(self.company, cliente, valor="99.00")

        resp = self.client.post(
            "/api/pagamentos/confirmar-sugestao/",
            {"payment_id": payment_b.id, "tipo": "receita", "entidade_id": receita.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)
