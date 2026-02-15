from django.db import migrations


def update_evolution_preco(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    PlanoAssinatura.objects.filter(slug='evolution').update(
        preco_mensal='600.00',
        preco_anual='6000.00',
    )


def revert_evolution_preco(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    PlanoAssinatura.objects.filter(slug='evolution').update(
        preco_mensal='397.00',
        preco_anual='3970.00',
    )


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0034_add_payment_id_to_webhooklog'),
    ]
    operations = [
        migrations.RunPython(update_evolution_preco, revert_evolution_preco),
    ]
