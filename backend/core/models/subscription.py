from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.db.models.signals import post_save
from django.dispatch import receiver
from .identity import Company


class PlanoAssinatura(models.Model):
    nome = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    subtitulo = models.CharField(max_length=200, blank=True)
    descricao = models.TextField(blank=True)
    preco_mensal = models.DecimalField(max_digits=8, decimal_places=2)
    preco_anual = models.DecimalField(max_digits=8, decimal_places=2)
    asaas_billing_type = models.CharField(max_length=20, default='CREDIT_CARD')
    max_usuarios = models.IntegerField(default=1)
    features = models.JSONField(default=list)
    tem_trial = models.BooleanField(default=False)
    ativo = models.BooleanField(default=True)
    ordem = models.IntegerField(default=0)

    class Meta:
        verbose_name = 'Plano de Assinatura'
        verbose_name_plural = 'Planos de Assinatura'
        ordering = ['ordem']

    def __str__(self):
        return f'{self.nome} — R$ {self.preco_mensal}/mês'


class AssinaturaEmpresa(models.Model):
    STATUS_CHOICES = (
        ('trial', 'Período de Teste'),
        ('active', 'Ativa'),
        ('overdue', 'Em Atraso'),
        ('payment_failed', 'Pagamento Recusado'),
        ('cancelled', 'Cancelada'),
        ('expired', 'Expirada'),
    )

    company = models.OneToOneField(
        Company, on_delete=models.CASCADE, related_name='assinatura'
    )
    plano = models.ForeignKey(
        PlanoAssinatura, on_delete=models.SET_NULL, null=True, blank=True
    )
    ciclo = models.CharField(
        max_length=10,
        choices=(('MONTHLY', 'Mensal'), ('YEARLY', 'Anual')),
        default='MONTHLY',
    )
    trial_inicio = models.DateTimeField(auto_now_add=True)
    trial_fim = models.DateTimeField()
    pending_plano = models.ForeignKey(
        PlanoAssinatura, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assinaturas_pendentes',
        help_text='Plano selecionado mas ainda não pago'
    )
    pending_ciclo = models.CharField(
        max_length=10,
        choices=(('MONTHLY', 'Mensal'), ('YEARLY', 'Anual')),
        blank=True, null=True,
    )
    asaas_customer_id = models.CharField(max_length=100, blank=True, null=True)
    asaas_subscription_id = models.CharField(max_length=100, blank=True, null=True)
    asaas_subscription_ids_anteriores = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='trial')
    proxima_cobranca = models.DateField(null=True, blank=True)
    card_last_four = models.CharField(max_length=4, blank=True, null=True)
    card_brand = models.CharField(max_length=30, blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Assinatura da Empresa'
        verbose_name_plural = 'Assinaturas das Empresas'

    def __str__(self):
        return f'{self.company.name} — {self.get_status_display()}'

    @property
    def trial_ativo(self):
        return self.status == 'trial' and timezone.now() < self.trial_fim

    @property
    def dias_trial_restantes(self):
        if self.status != 'trial':
            return 0
        delta = self.trial_fim - timezone.now()
        return max(0, delta.days)

    @property
    def acesso_permitido(self):
        if self.status == 'active':
            return True
        if self.status == 'trial':
            return self.trial_ativo
        if self.status == 'cancelled' and self.proxima_cobranca and self.proxima_cobranca >= timezone.now().date():
            return True
        if self.status == 'payment_failed':
            return False
        return False


class WebhookLog(models.Model):
    event_type = models.CharField(max_length=100)
    asaas_subscription_id = models.CharField(max_length=100, blank=True)
    asaas_payment_id = models.CharField(max_length=100, blank=True)
    payload = models.JSONField()
    processed = models.BooleanField(default=False)
    error = models.TextField(blank=True)
    recebido_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Log de Webhook'
        ordering = ['-recebido_em']

    def __str__(self):
        return f'{self.event_type} — {self.recebido_em}'


@receiver(post_save, sender=Company)
def criar_assinatura_trial(sender, instance, created, **kwargs):
    if created:
        plano_profissional = PlanoAssinatura.objects.filter(slug='profissional', ativo=True).first()
        AssinaturaEmpresa.objects.create(
            company=instance,
            plano=plano_profissional,
            trial_fim=timezone.now() + timedelta(days=7),
            status='trial',
        )
