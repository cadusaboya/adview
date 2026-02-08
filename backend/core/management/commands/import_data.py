"""
Management command para importar dados para o banco de produção.

Uso:
    python manage.py import_data --input dados_dev.json [--dry-run]
"""
import json
from decimal import Decimal
from datetime import datetime, date
from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.hashers import make_password
from core.models import (
    Company, CustomUser, Cliente, FormaCobranca, Funcionario,
    Receita, ReceitaRecorrente, Despesa, DespesaRecorrente,
    Payment, ContaBancaria, Custodia, Transfer, Allocation
)


class Command(BaseCommand):
    help = 'Importa dados de um arquivo JSON para o banco de produção'

    def __init__(self):
        super().__init__()
        # Mapeia IDs antigos para novos IDs
        self.id_mapping = {
            'companies': {},
            'users': {},
            'funcionarios': {},
            'clientes': {},
            'formas_cobranca': {},
            'contas_bancarias': {},
            'receitas': {},
            'receitas_recorrentes': {},
            'despesas': {},
            'despesas_recorrentes': {},
            'payments': {},
            'custodias': {},
            'transfers': {},
            'allocations': {},
        }

    def add_arguments(self, parser):
        parser.add_argument(
            '--input',
            type=str,
            required=True,
            help='Arquivo JSON com os dados para importar'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Executa sem salvar (simula a importação)'
        )
        parser.add_argument(
            '--skip-existing',
            action='store_true',
            help='Pula registros duplicados ao invés de falhar'
        )

    def parse_date(self, date_string):
        """Converte string de data para objeto date"""
        if not date_string:
            return None
        try:
            return datetime.fromisoformat(date_string.replace('Z', '+00:00')).date()
        except:
            return None

    def parse_datetime(self, datetime_string):
        """Converte string de datetime para objeto datetime"""
        if not datetime_string:
            return None
        try:
            return datetime.fromisoformat(datetime_string.replace('Z', '+00:00'))
        except:
            return None

    def import_companies(self, companies_data, skip_existing):
        """Importa empresas"""
        self.stdout.write('\n📦 Importando Companies...')

        for item in companies_data:
            fields = item['fields']
            old_id = item['pk']

            # Verificar se já existe pelo CNPJ/CPF
            existing = None
            if fields.get('cnpj'):
                existing = Company.objects.filter(cnpj=fields['cnpj']).first()
            elif fields.get('cpf'):
                existing = Company.objects.filter(cpf=fields['cpf']).first()

            if existing:
                if skip_existing:
                    self.id_mapping['companies'][old_id] = existing.id
                    self.stdout.write(f'  ⊙ Empresa "{fields["name"]}" já existe (ID: {existing.id})')
                    continue
                else:
                    raise Exception(f'Empresa "{fields["name"]}" já existe! Use --skip-existing')

            # Criar nova empresa
            company = Company.objects.create(
                name=fields['name'],
                cnpj=fields.get('cnpj'),
                cpf=fields.get('cpf'),
                endereco=fields.get('endereco'),
                cidade=fields.get('cidade'),
                estado=fields.get('estado'),
                telefone=fields.get('telefone'),
                email=fields.get('email'),
                percentual_comissao=Decimal(str(fields.get('percentual_comissao', '20.00'))),
            )

            self.id_mapping['companies'][old_id] = company.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["name"]} (ID: {old_id} → {company.id})'))

    def import_users(self, users_data, skip_existing):
        """Importa usuários"""
        self.stdout.write('\n👤 Importando Users...')

        for item in users_data:
            fields = item['fields']
            old_id = item['pk']

            # Verificar se já existe
            existing = CustomUser.objects.filter(username=fields['username']).first()

            if existing:
                if skip_existing:
                    self.id_mapping['users'][old_id] = existing.id
                    self.stdout.write(f'  ⊙ User "{fields["username"]}" já existe')
                    continue
                else:
                    raise Exception(f'User "{fields["username"]}" já existe! Use --skip-existing')

            # Mapear company_id
            company_id = None
            if fields.get('company'):
                company_id = self.id_mapping['companies'].get(fields['company'])

            # Criar novo usuário
            user = CustomUser.objects.create(
                username=fields['username'],
                email=fields.get('email', ''),
                first_name=fields.get('first_name', ''),
                last_name=fields.get('last_name', ''),
                is_staff=fields.get('is_staff', False),
                is_active=fields.get('is_active', True),
                is_superuser=fields.get('is_superuser', False),
                password=fields['password'],  # Já vem hasheado do serialize
                company_id=company_id,
                date_joined=self.parse_datetime(fields.get('date_joined')),
            )

            self.id_mapping['users'][old_id] = user.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["username"]} (ID: {old_id} → {user.id})'))

    def import_funcionarios(self, funcionarios_data, skip_existing):
        """Importa funcionários"""
        self.stdout.write('\n👔 Importando Funcionários...')

        for item in funcionarios_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])

            # Verificar duplicata por nome dentro da mesma empresa
            existing = Funcionario.objects.filter(
                nome=fields['nome'],
                company_id=company_id
            ).first()

            if existing:
                if skip_existing:
                    self.id_mapping['funcionarios'][old_id] = existing.id
                    self.stdout.write(f'  ⊙ Funcionário "{fields["nome"]}" já existe')
                    continue
                else:
                    # Como nome é unique, vamos adicionar sufixo
                    fields['nome'] = f"{fields['nome']} (importado)"

            funcionario = Funcionario.objects.create(
                company_id=company_id,
                nome=fields['nome'],
                cpf=fields.get('cpf'),
                email=fields.get('email'),
                telefone=fields.get('telefone'),
                aniversario=self.parse_date(fields.get('aniversario')),
                tipo=fields['tipo'],
                salario_mensal=fields.get('salario_mensal'),
            )

            self.id_mapping['funcionarios'][old_id] = funcionario.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {funcionario.id})'))

    def import_clientes(self, clientes_data, skip_existing):
        """Importa clientes"""
        self.stdout.write('\n🏢 Importando Clientes...')

        for item in clientes_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            comissionado_id = self.id_mapping['funcionarios'].get(fields.get('comissionado')) if fields.get('comissionado') else None

            # Verificar duplicata
            existing = Cliente.objects.filter(
                nome=fields['nome'],
                company_id=company_id
            ).first()

            if existing:
                if skip_existing:
                    self.id_mapping['clientes'][old_id] = existing.id
                    self.stdout.write(f'  ⊙ Cliente "{fields["nome"]}" já existe')
                    continue
                else:
                    fields['nome'] = f"{fields['nome']} (importado)"

            cliente = Cliente.objects.create(
                company_id=company_id,
                nome=fields['nome'],
                cpf=fields.get('cpf'),
                email=fields.get('email'),
                telefone=fields.get('telefone'),
                aniversario=self.parse_date(fields.get('aniversario')),
                tipo=fields['tipo'],
                comissionado_id=comissionado_id,
            )

            self.id_mapping['clientes'][old_id] = cliente.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {cliente.id})'))

    def import_formas_cobranca(self, formas_data, skip_existing):
        """Importa formas de cobrança"""
        self.stdout.write('\n💰 Importando Formas de Cobrança...')

        for item in formas_data:
            fields = item['fields']
            old_id = item['pk']

            cliente_id = self.id_mapping['clientes'].get(fields['cliente'])

            forma = FormaCobranca.objects.create(
                cliente_id=cliente_id,
                formato=fields['formato'],
                descricao=fields.get('descricao'),
                valor_mensal=fields.get('valor_mensal'),
                percentual_exito=fields.get('percentual_exito'),
            )

            self.id_mapping['formas_cobranca'][old_id] = forma.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ Forma de cobrança criada (ID: {old_id} → {forma.id})'))

    def import_contas_bancarias(self, contas_data, skip_existing):
        """Importa contas bancárias"""
        self.stdout.write('\n🏦 Importando Contas Bancárias...')

        for item in contas_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])

            # Verificar duplicata
            existing = ContaBancaria.objects.filter(
                nome=fields['nome'],
                company_id=company_id
            ).first()

            if existing:
                if skip_existing:
                    self.id_mapping['contas_bancarias'][old_id] = existing.id
                    self.stdout.write(f'  ⊙ Conta "{fields["nome"]}" já existe')
                    continue

            conta = ContaBancaria.objects.create(
                company_id=company_id,
                nome=fields['nome'],
                descricao=fields.get('descricao'),
                saldo_atual=Decimal(str(fields.get('saldo_atual', '0.00'))),
            )

            self.id_mapping['contas_bancarias'][old_id] = conta.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {conta.id})'))

    def import_receitas(self, receitas_data, skip_existing):
        """Importa receitas"""
        self.stdout.write('\n💵 Importando Receitas...')

        for item in receitas_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            cliente_id = self.id_mapping['clientes'].get(fields['cliente'])

            receita = Receita.objects.create(
                company_id=company_id,
                cliente_id=cliente_id,
                nome=fields['nome'],
                descricao=fields.get('descricao'),
                data_vencimento=self.parse_date(fields['data_vencimento']),
                data_pagamento=self.parse_date(fields.get('data_pagamento')),
                valor=Decimal(str(fields['valor'])),
                valor_pago=Decimal(str(fields.get('valor_pago', '0.00'))) if fields.get('valor_pago') else None,
                forma_pagamento=fields.get('forma_pagamento'),
                tipo=fields['tipo'],
                situacao=fields.get('situacao', 'A'),
            )

            self.id_mapping['receitas'][old_id] = receita.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {receita.id})'))

    def import_receitas_recorrentes(self, receitas_rec_data, skip_existing):
        """Importa receitas recorrentes"""
        self.stdout.write('\n🔄 Importando Receitas Recorrentes...')

        for item in receitas_rec_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            cliente_id = self.id_mapping['clientes'].get(fields['cliente'])

            receita_rec = ReceitaRecorrente.objects.create(
                company_id=company_id,
                cliente_id=cliente_id,
                nome=fields['nome'],
                descricao=fields.get('descricao'),
                valor=Decimal(str(fields['valor'])),
                tipo=fields.get('tipo', 'F'),
                forma_pagamento=fields.get('forma_pagamento'),
                data_inicio=self.parse_date(fields['data_inicio']),
                data_fim=self.parse_date(fields.get('data_fim')),
                dia_vencimento=fields.get('dia_vencimento', 1),
                status=fields.get('status', 'A'),
            )

            self.id_mapping['receitas_recorrentes'][old_id] = receita_rec.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {receita_rec.id})'))

    def import_despesas(self, despesas_data, skip_existing):
        """Importa despesas"""
        self.stdout.write('\n💸 Importando Despesas...')

        for item in despesas_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            responsavel_id = self.id_mapping['funcionarios'].get(fields['responsavel'])
            receita_origem_id = self.id_mapping['receitas'].get(fields.get('receita_origem')) if fields.get('receita_origem') else None

            despesa = Despesa.objects.create(
                company_id=company_id,
                responsavel_id=responsavel_id,
                nome=fields['nome'],
                descricao=fields.get('descricao'),
                data_vencimento=self.parse_date(fields['data_vencimento']),
                data_pagamento=self.parse_date(fields.get('data_pagamento')),
                valor=Decimal(str(fields['valor'])),
                valor_pago=Decimal(str(fields.get('valor_pago', '0.00'))) if fields.get('valor_pago') else None,
                tipo=fields['tipo'],
                situacao=fields.get('situacao', 'A'),
                receita_origem_id=receita_origem_id,
            )

            self.id_mapping['despesas'][old_id] = despesa.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {despesa.id})'))

    def import_despesas_recorrentes(self, despesas_rec_data, skip_existing):
        """Importa despesas recorrentes"""
        self.stdout.write('\n🔄 Importando Despesas Recorrentes...')

        for item in despesas_rec_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            responsavel_id = self.id_mapping['funcionarios'].get(fields['responsavel'])

            despesa_rec = DespesaRecorrente.objects.create(
                company_id=company_id,
                responsavel_id=responsavel_id,
                nome=fields['nome'],
                descricao=fields.get('descricao'),
                valor=Decimal(str(fields['valor'])),
                tipo=fields.get('tipo', 'F'),
                forma_pagamento=fields.get('forma_pagamento'),
                data_inicio=self.parse_date(fields['data_inicio']),
                data_fim=self.parse_date(fields.get('data_fim')),
                dia_vencimento=fields.get('dia_vencimento', 1),
                status=fields.get('status', 'A'),
            )

            self.id_mapping['despesas_recorrentes'][old_id] = despesa_rec.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {despesa_rec.id})'))

    def import_payments(self, payments_data, skip_existing):
        """Importa pagamentos"""
        self.stdout.write('\n💳 Importando Payments...')

        for item in payments_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            conta_bancaria_id = self.id_mapping['contas_bancarias'].get(fields['conta_bancaria'])

            payment = Payment.objects.create(
                company_id=company_id,
                conta_bancaria_id=conta_bancaria_id,
                tipo=fields['tipo'],
                valor=Decimal(str(fields['valor'])),
                data_pagamento=self.parse_date(fields['data_pagamento']),
                observacao=fields.get('observacao'),
            )

            self.id_mapping['payments'][old_id] = payment.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ Payment criado (ID: {old_id} → {payment.id})'))

    def import_custodias(self, custodias_data, skip_existing):
        """Importa custódias"""
        self.stdout.write('\n🔐 Importando Custódias...')

        for item in custodias_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            cliente_id = self.id_mapping['clientes'].get(fields.get('cliente')) if fields.get('cliente') else None
            funcionario_id = self.id_mapping['funcionarios'].get(fields.get('funcionario')) if fields.get('funcionario') else None

            custodia = Custodia.objects.create(
                company_id=company_id,
                tipo=fields['tipo'],
                cliente_id=cliente_id,
                funcionario_id=funcionario_id,
                nome=fields['nome'],
                descricao=fields.get('descricao'),
                valor_total=Decimal(str(fields['valor_total'])),
                valor_liquidado=Decimal(str(fields.get('valor_liquidado', '0.00'))),
                status=fields.get('status', 'A'),
            )

            self.id_mapping['custodias'][old_id] = custodia.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ {fields["nome"]} (ID: {old_id} → {custodia.id})'))

    def import_transfers(self, transfers_data, skip_existing):
        """Importa transferências"""
        self.stdout.write('\n↔️  Importando Transferências...')

        for item in transfers_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            from_bank_id = self.id_mapping['contas_bancarias'].get(fields['from_bank'])
            to_bank_id = self.id_mapping['contas_bancarias'].get(fields['to_bank'])

            transfer = Transfer.objects.create(
                company_id=company_id,
                from_bank_id=from_bank_id,
                to_bank_id=to_bank_id,
                valor=Decimal(str(fields['valor'])),
                data_transferencia=self.parse_date(fields['data_transferencia']),
                descricao=fields.get('descricao'),
                status=fields.get('status', 'P'),
            )

            self.id_mapping['transfers'][old_id] = transfer.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ Transfer criado (ID: {old_id} → {transfer.id})'))

    def import_allocations(self, allocations_data, skip_existing):
        """Importa alocações"""
        self.stdout.write('\n📊 Importando Allocations...')

        for item in allocations_data:
            fields = item['fields']
            old_id = item['pk']

            company_id = self.id_mapping['companies'].get(fields['company'])
            payment_id = self.id_mapping['payments'].get(fields['payment'])

            receita_id = self.id_mapping['receitas'].get(fields.get('receita')) if fields.get('receita') else None
            despesa_id = self.id_mapping['despesas'].get(fields.get('despesa')) if fields.get('despesa') else None
            custodia_id = self.id_mapping['custodias'].get(fields.get('custodia')) if fields.get('custodia') else None
            transfer_id = self.id_mapping['transfers'].get(fields.get('transfer')) if fields.get('transfer') else None

            allocation = Allocation.objects.create(
                company_id=company_id,
                payment_id=payment_id,
                receita_id=receita_id,
                despesa_id=despesa_id,
                custodia_id=custodia_id,
                transfer_id=transfer_id,
                valor=Decimal(str(fields['valor'])),
                observacao=fields.get('observacao'),
            )

            self.id_mapping['allocations'][old_id] = allocation.id
            self.stdout.write(self.style.SUCCESS(f'  ✓ Allocation criado (ID: {old_id} → {allocation.id})'))

    @transaction.atomic
    def handle(self, *args, **options):
        input_file = options['input']
        dry_run = options['dry_run']
        skip_existing = options['skip_existing']

        if dry_run:
            self.stdout.write(self.style.WARNING('\n⚠️  MODO DRY-RUN - Nenhuma alteração será salva!\n'))

        # Ler arquivo JSON
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(f'Arquivo não encontrado: {input_file}'))
            return
        except json.JSONDecodeError as e:
            self.stdout.write(self.style.ERROR(f'Erro ao ler JSON: {e}'))
            return

        self.stdout.write(self.style.SUCCESS(f'\n📁 Arquivo carregado: {input_file}'))
        self.stdout.write('Iniciando importação...\n')

        try:
            # Importar na ordem correta (respeitando dependências)
            imported_data = data.get('data', {})

            if imported_data.get('companies'):
                self.import_companies(imported_data['companies'], skip_existing)

            if imported_data.get('users'):
                self.import_users(imported_data['users'], skip_existing)

            if imported_data.get('funcionarios'):
                self.import_funcionarios(imported_data['funcionarios'], skip_existing)

            if imported_data.get('clientes'):
                self.import_clientes(imported_data['clientes'], skip_existing)

            if imported_data.get('formas_cobranca'):
                self.import_formas_cobranca(imported_data['formas_cobranca'], skip_existing)

            if imported_data.get('contas_bancarias'):
                self.import_contas_bancarias(imported_data['contas_bancarias'], skip_existing)

            if imported_data.get('receitas'):
                self.import_receitas(imported_data['receitas'], skip_existing)

            if imported_data.get('receitas_recorrentes'):
                self.import_receitas_recorrentes(imported_data['receitas_recorrentes'], skip_existing)

            if imported_data.get('despesas'):
                self.import_despesas(imported_data['despesas'], skip_existing)

            if imported_data.get('despesas_recorrentes'):
                self.import_despesas_recorrentes(imported_data['despesas_recorrentes'], skip_existing)

            if imported_data.get('payments'):
                self.import_payments(imported_data['payments'], skip_existing)

            if imported_data.get('custodias'):
                self.import_custodias(imported_data['custodias'], skip_existing)

            if imported_data.get('transfers'):
                self.import_transfers(imported_data['transfers'], skip_existing)

            if imported_data.get('allocations'):
                self.import_allocations(imported_data['allocations'], skip_existing)

            if dry_run:
                self.stdout.write(self.style.WARNING('\n⚠️  DRY-RUN: Revertendo todas as alterações...'))
                transaction.set_rollback(True)
            else:
                self.stdout.write(self.style.SUCCESS('\n✅ Importação concluída com sucesso!'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n❌ Erro durante importação: {str(e)}'))
            raise
