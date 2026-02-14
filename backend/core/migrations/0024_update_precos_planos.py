from django.db import migrations


def update_precos(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    updates = {
        'essencial': {
            'preco_mensal': '99.00',
            'preco_anual': '990.00',
            'features': [
                'Dashboard financeiro completo',
                'Controle de receitas e despesas',
                'Relatórios financeiros consolidados no sistema',
                'Acesso via Web e Mobile',
                'Suporte básico',
            ],
        },
        'profissional': {
            'preco_mensal': '197.00',
            'preco_anual': '1970.00',
            'features': [
                'Tudo do Plano Essencial',
                'Até 3 usuários (ideal para equipe)',
                'Exportação de relatórios em PDF para clientes e sócios',
                'Controle de honorários por advogado',
                'Atualização monetária automática de valores vencidos',
                'Dashboard personalizável com visão estratégica',
                'Suporte prioritário',
            ],
        },
        'evolution': {
            'preco_mensal': '397.00',
            'preco_anual': '3970.00',
        },
    }
    for slug, data in updates.items():
        PlanoAssinatura.objects.filter(slug=slug).update(**data)


def revert_precos(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    updates = {
        'essencial':    {'preco_mensal': '120.00', 'preco_anual': '1190.00'},
        'profissional': {'preco_mensal': '250.00', 'preco_anual': '2490.00'},
        'evolution':    {'preco_mensal': '600.00', 'preco_anual': '5990.00'},
    }
    for slug, precos in updates.items():
        PlanoAssinatura.objects.filter(slug=slug).update(**precos)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0023_backfill_assinaturas'),
    ]
    operations = [
        migrations.RunPython(update_precos, revert_precos),
    ]
