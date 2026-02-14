from django.db import migrations


def set_tem_trial(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    PlanoAssinatura.objects.filter(slug='essencial').update(tem_trial=True)


def revert_tem_trial(apps, schema_editor):
    PlanoAssinatura = apps.get_model('core', 'PlanoAssinatura')
    PlanoAssinatura.objects.filter(slug='essencial').update(tem_trial=False)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_add_tem_trial_to_plano'),
    ]

    operations = [
        migrations.RunPython(set_tem_trial, revert_tem_trial),
    ]
