from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import timedelta
from core.models import AssinaturaEmpresa, CustomUser
from core.asaas_service import cancelar_assinatura_asaas


class Command(BaseCommand):
    help = 'Reseta a assinatura de um usuário para trial limpo de 7 dias, cancelando tudo no Asaas.'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username do usuário a resetar')
        parser.add_argument(
            '--days', type=int, default=7,
            help='Duração do trial em dias (padrão: 7)'
        )

    def handle(self, *args, **options):
        username = options['username']
        days = options['days']

        try:
            user = CustomUser.objects.get(username=username)
        except CustomUser.DoesNotExist:
            raise CommandError(f'Usuário "{username}" não encontrado.')

        try:
            assinatura = AssinaturaEmpresa.objects.get(company=user.company)
        except AssinaturaEmpresa.DoesNotExist:
            raise CommandError(f'AssinaturaEmpresa não encontrada para "{username}".')

        self.stdout.write(f'Status atual: {assinatura.status}')
        self.stdout.write(f'Subscription ID: {assinatura.asaas_subscription_id}')
        self.stdout.write(f'IDs anteriores: {assinatura.asaas_subscription_ids_anteriores}')

        # Cancela todas as subscriptions no Asaas
        ids_para_cancelar = []
        if assinatura.asaas_subscription_id:
            ids_para_cancelar.append(assinatura.asaas_subscription_id)
        for sid in (assinatura.asaas_subscription_ids_anteriores or []):
            if sid not in ids_para_cancelar:
                ids_para_cancelar.append(sid)

        for sid in ids_para_cancelar:
            try:
                cancelar_assinatura_asaas(sid)
                self.stdout.write(self.style.SUCCESS(f'  Cancelada no Asaas: {sid}'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'  Aviso ({sid}): {e}'))

        # Reseta para trial limpo
        assinatura.status = 'trial'
        assinatura.trial_fim = timezone.now() + timedelta(days=days)
        assinatura.plano = None
        assinatura.ciclo = 'MONTHLY'
        assinatura.asaas_subscription_id = None
        assinatura.asaas_subscription_ids_anteriores = []
        assinatura.pending_plano = None
        assinatura.pending_ciclo = None
        assinatura.proxima_cobranca = None
        assinatura.save()

        self.stdout.write(self.style.SUCCESS(
            f'Pronto! "{username}" resetado para trial de {days} dias.'
        ))
