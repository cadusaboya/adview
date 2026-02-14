from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_update_trial_plan_to_profissional'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='assinaturaempresa',
            name='card_token',
        ),
    ]
