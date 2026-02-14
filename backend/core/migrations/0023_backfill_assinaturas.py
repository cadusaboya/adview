from django.db import migrations, transaction
from django.utils import timezone


def backfill_assinaturas(apps, schema_editor):
    """
    Empresas existentes antes da feature de assinatura ganham status 'active'
    (já são clientes pagantes, não precisam de trial).
    """
    Company = apps.get_model('core', 'Company')
    AssinaturaEmpresa = apps.get_model('core', 'AssinaturaEmpresa')
    now = timezone.now()
    db_alias = schema_editor.connection.alias
    with transaction.atomic(using=db_alias):
        for company in Company.objects.using(db_alias).select_for_update().all():
            AssinaturaEmpresa.objects.using(db_alias).get_or_create(
                company=company,
                defaults={
                    'trial_fim': now,
                    'status': 'active',
                },
            )


def reverse_backfill(apps, schema_editor):
    raise migrations.IrreversibleError(
        "Migration 0023_backfill_assinaturas is irreversible because it creates "
        "subscription rows for pre-existing companies."
    )


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0022_seed_planos'),
    ]
    operations = [
        migrations.RunPython(backfill_assinaturas, reverse_backfill),
    ]
