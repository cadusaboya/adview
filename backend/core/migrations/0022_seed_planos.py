from django.db import migrations


def seed_planos(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    plans = [
        {
            'nome': 'Essencial',
            'slug': 'essencial',
            'subtitulo': 'Ideal para advogado solo que quer controle financeiro organizado',
            'preco_mensal': '99.00',
            'preco_anual': '990.00',
            'max_usuarios': 1,
            'ativo': True,
            'ordem': 1,
            'features': [
                'Dashboard financeiro completo',
                'Controle de receitas e despesas',
                'Relatórios financeiros consolidados (DRE, Fluxo de Caixa e Balanço)',
                'Acesso via Web e Mobile',
                'Suporte básico',
            ],
        },
        {
            'nome': 'Profissional',
            'slug': 'profissional',
            'subtitulo': 'Ideal para escritórios em crescimento que querem gestão estratégica',
            'preco_mensal': '197.00',
            'preco_anual': '1970.00',
            'max_usuarios': 3,
            'ativo': True,
            'ordem': 2,
            'features': [
                'Tudo do Plano Essencial',
                'Até 3 usuários',
                'Exporte Relatórios em PDF',
                'Relatório de Honorários e Correção Monetária automática de valores',
                'Dashboard customizável',
                'Suporte prioritário',
            ],
        },
        {
            'nome': 'Evolution',
            'slug': 'evolution',
            'subtitulo': 'Para escritórios estruturados que querem evolução contínua',
            'preco_mensal': '397.00',
            'preco_anual': '3970.00',
            'max_usuarios': 999,
            'ativo': True,
            'ordem': 3,
            'features': [
                'Tudo do Plano Profissional',
                'Onboarding estratégico personalizado',
                'Implantação assistida',
                'Treinamento da equipe',
                'Influência direta na evolução do sistema',
            ],
        },
    ]
    for p in plans:
        PlanoAssinatura.objects.get_or_create(slug=p['slug'], defaults=p)


def remove_planos(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    PlanoAssinatura.objects.filter(slug__in=['essencial', 'profissional', 'evolution']).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0021_planoassinatura_webhooklog_assinaturaempresa'),
    ]
    operations = [
        migrations.RunPython(seed_planos, remove_planos),
    ]
