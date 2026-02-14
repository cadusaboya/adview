from django.db import migrations
from django.utils import timezone


def backfill_assinaturas(apps, schema_editor):
    """
    Empresas existentes antes da feature de assinatura ganham status 'active'
    (já são clientes pagantes, não precisam de trial).
    """
    Company = apps.get_model('core', 'Company')
    AssinaturaEmpresa = apps.get_model('core', 'AssinaturaEmpresa')
    now = timezone.now()
    for company in Company.objects.all():
        AssinaturaEmpresa.objects.get_or_create(
            company=company,
            defaults={
                'trial_fim': now,
                'status': 'active',
            },
        )


def reverse_backfill(apps, schema_editor):
    pass  # Leave data in place on reverse


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0022_seed_planos'),
    ]
    operations = [
        migrations.RunPython(backfill_assinaturas, reverse_backfill),
    ]
