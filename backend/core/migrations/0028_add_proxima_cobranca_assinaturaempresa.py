from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0027_add_pending_plano_ciclo_assinatura'),
    ]

    operations = [
        migrations.AddField(
            model_name='assinaturaempresa',
            name='proxima_cobranca',
            field=models.DateField(blank=True, null=True),
        ),
    ]
