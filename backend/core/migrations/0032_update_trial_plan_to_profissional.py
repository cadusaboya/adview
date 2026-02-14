from django.db import migrations


def update_trial_plan(apps, schema_editor):
    """
    Atualiza assinaturas em trial com plano Essencial para plano Profissional.
    O trial deve refletir o plano Profissional para dar acesso completo às features.
    """
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    AssinaturaEmpresa = apps.get_model('core', 'AssinaturaEmpresa')

    profissional = PlanoAssinatura.objects.filter(slug='profissional', ativo=True).first()
    if not profissional:
        return

    updated = AssinaturaEmpresa.objects.filter(
        status='trial',
        plano__slug='essencial',
    ).update(plano=profissional)

    print(f"  Atualizados {updated} trial(s) de Essencial → Profissional")


def revert_trial_plan(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    AssinaturaEmpresa = apps.get_model('core', 'AssinaturaEmpresa')

    essencial = PlanoAssinatura.objects.filter(slug='essencial', ativo=True).first()
    if not essencial:
        return

    AssinaturaEmpresa.objects.filter(
        status='trial',
        plano__slug='profissional',
    ).update(plano=essencial)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0031_add_card_token_assinaturaempresa'),
    ]

    operations = [
        migrations.RunPython(update_trial_plan, revert_trial_plan),
    ]
