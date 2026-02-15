from datetime import date

from core.models import Despesa
from core.tests.base import APITestBase
from core.tests.factories import (
    make_allocation,
    make_cliente,
    make_cliente_comissao,
    make_conta,
    make_funcionario,
    make_payment,
    make_receita,
    make_receita_comissao,
)


class PeopleViewTests(APITestBase):
    def test_cliente_crud_with_nested_formas_and_comissoes(self):
        funcionario = make_funcionario(self.company, tipo="F")
        payload = {
            "nome": "Cliente Novo",
            "tipo": "F",
            "formas_cobranca": [{"formato": "M", "valor_mensal": "1200.00"}],
            "comissoes": [{"funcionario_id": funcionario.id, "percentual": "20.00"}],
        }

        create = self.client.post("/api/clientes/", payload, format="json")
        self.assertEqual(create.status_code, 201, create.data)

        cliente_id = create.data["id"]
        detail = self.client.get(f"/api/clientes/{cliente_id}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["nome"], "Cliente Novo")
        self.assertEqual(len(detail.data["formas_cobranca"]), 1)
        self.assertEqual(len(detail.data["comissoes"]), 1)

    def test_funcionario_fornecedor_favorecido_filters(self):
        make_funcionario(self.company, tipo="F", nome="Funcionario X")
        make_funcionario(self.company, tipo="P", nome="Parceiro X")
        make_funcionario(self.company, tipo="O", nome="Fornecedor X")

        funcionarios = self.client.get("/api/funcionarios/")
        fornecedores = self.client.get("/api/fornecedores/")
        favorecidos = self.client.get("/api/favorecidos/")

        self.assertEqual(funcionarios.status_code, 200)
        self.assertEqual(fornecedores.status_code, 200)
        self.assertEqual(favorecidos.status_code, 200)

        tipos_func = {item["tipo"] for item in self.results(funcionarios)}
        tipos_forn = {item["tipo"] for item in self.results(fornecedores)}
        tipos_fav = {item["tipo"] for item in self.results(favorecidos)}

        self.assertEqual(tipos_forn, {"O"})
        self.assertTrue(tipos_func.issubset({"F", "P"}))
        self.assertTrue(tipos_fav.issubset({"F", "P", "O"}))


class CommissionGenerationTests(APITestBase):
    def test_gerar_comissoes_uses_receita_rule_over_cliente_rule(self):
        cliente = make_cliente(self.company, nome="Cli Comissao")
        func_cliente = make_funcionario(self.company, tipo="F", nome="Func Cliente")
        func_receita = make_funcionario(self.company, tipo="F", nome="Func Receita")

        make_cliente_comissao(cliente, func_cliente, percentual="30.00")

        receita = make_receita(
            self.company,
            cliente,
            valor="1000.00",
            vencimento=date.today(),
            situacao="A",
            nome="Receita Comissionada",
        )
        make_receita_comissao(receita, func_receita, percentual="10.00")

        conta = make_conta(self.company, saldo="0.00")
        payment = make_payment(self.company, conta, tipo="E", valor="1000.00", data_pagamento=date.today())
        make_allocation(self.company, payment, valor="1000.00", receita=receita)

        resp = self.client.post(
            "/api/clientes/gerar-comissoes/",
            {"mes": date.today().month, "ano": date.today().year},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)

        despesa = Despesa.objects.get(company=self.company, tipo="C")
        self.assertIn("Func Receita", despesa.nome)
        self.assertEqual(str(despesa.valor), "100.00")
