"""
Management command para exportar dados do banco de desenvolvimento.

Uso:
    python manage.py export_data --output dados_dev.json
"""
import json
from django.core.management.base import BaseCommand
from django.core.serializers import serialize
from core.models import (
    Company, CustomUser, Cliente, FormaCobranca, Funcionario,
    Receita, ReceitaRecorrente, Despesa, DespesaRecorrente,
    Payment, ContaBancaria, Custodia, Transfer, Allocation
)


class Command(BaseCommand):
    help = 'Exporta todos os dados do banco de desenvolvimento para um arquivo JSON'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='dados_dev.json',
            help='Nome do arquivo de saída (padrão: dados_dev.json)'
        )
        parser.add_argument(
            '--company-id',
            type=int,
            help='ID da empresa específica para exportar (opcional, exporta todas se não especificado)'
        )

    def handle(self, *args, **options):
        output_file = options['output']
        company_id = options.get('company_id')

        self.stdout.write('Iniciando exportação dos dados...\n')

        # Dicionário para armazenar os dados exportados
        exported_data = {
            'metadata': {
                'version': '1.0',
                'exported_at': None  # Será preenchido pelo serialize
            },
            'data': {}
        }

        # Ordem de exportação (respeitando dependências)
        models_to_export = [
            ('companies', Company),
            ('users', CustomUser),
            ('funcionarios', Funcionario),
            ('clientes', Cliente),
            ('formas_cobranca', FormaCobranca),
            ('contas_bancarias', ContaBancaria),
            ('receitas', Receita),
            ('receitas_recorrentes', ReceitaRecorrente),
            ('despesas', Despesa),
            ('despesas_recorrentes', DespesaRecorrente),
            ('payments', Payment),
            ('custodias', Custodia),
            ('transfers', Transfer),
            ('allocations', Allocation),
        ]

        for model_name, model_class in models_to_export:
            # Filtrar por company se especificado (exceto para Company e CustomUser)
            if company_id and hasattr(model_class, 'company'):
                queryset = model_class.objects.filter(company_id=company_id)
            elif company_id and model_class == Company:
                queryset = model_class.objects.filter(id=company_id)
            elif company_id and model_class == CustomUser:
                queryset = model_class.objects.filter(company_id=company_id)
            else:
                queryset = model_class.objects.all()

            count = queryset.count()

            if count > 0:
                # Serializa os dados
                serialized = serialize('json', queryset)
                exported_data['data'][model_name] = json.loads(serialized)

                self.stdout.write(
                    self.style.SUCCESS(f'✓ {model_name}: {count} registro(s) exportado(s)')
                )
            else:
                exported_data['data'][model_name] = []
                self.stdout.write(
                    self.style.WARNING(f'⚠ {model_name}: nenhum registro encontrado')
                )

        # Salvar arquivo JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(exported_data, f, ensure_ascii=False, indent=2)

        self.stdout.write(
            self.style.SUCCESS(f'\n✓ Exportação concluída! Arquivo salvo em: {output_file}')
        )

        # Estatísticas
        total_records = sum(len(data) for data in exported_data['data'].values())
        self.stdout.write(f'\nTotal de registros exportados: {total_records}')
