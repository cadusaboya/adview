import requests
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _base_url() -> str:
    return getattr(settings, 'ASAAS_BASE_URL', 'https://sandbox.asaas.com/api/v3')


def _headers() -> dict:
    return {
        'access_token': settings.ASAAS_API_KEY,
        'Content-Type': 'application/json',
    }


def criar_cliente_asaas(company) -> str:
    """
    Creates a customer in Asaas for the given Company.
    Returns the Asaas customer ID string.
    """
    cpf_cnpj = (company.cnpj or company.cpf or '').replace('.', '').replace('-', '').replace('/', '')
    payload = {
        'name': company.name,
        'email': company.email or '',
        'phone': company.telefone or '',
        'externalReference': str(company.id),
    }
    if cpf_cnpj:
        payload['cpfCnpj'] = cpf_cnpj

    resp = requests.post(
        f'{_base_url()}/customers',
        json=payload,
        headers=_headers(),
        timeout=15,
    )
    if not resp.ok:
        logger.error(f'Asaas customer creation error: HTTP {resp.status_code}')
        logger.debug(f'Asaas customer creation response body: {resp.text}')
        resp.raise_for_status()
    data = resp.json()
    logger.info(f'Asaas customer created: {data["id"]} for company {company.id}')
    return data['id']


def atualizar_cliente_asaas(asaas_customer_id: str, company) -> None:
    """Updates an existing Asaas customer with the latest company data (e.g. CPF/CNPJ)."""
    cpf_cnpj = (company.cnpj or company.cpf or '').replace('.', '').replace('-', '').replace('/', '')
    payload = {
        'name': company.name,
        'email': company.email or '',
        'phone': company.telefone or '',
        'externalReference': str(company.id),
    }
    if cpf_cnpj:
        payload['cpfCnpj'] = cpf_cnpj

    resp = requests.put(
        f'{_base_url()}/customers/{asaas_customer_id}',
        json=payload,
        headers=_headers(),
        timeout=15,
    )
    if not resp.ok:
        logger.error(f'Asaas customer update error: HTTP {resp.status_code}')
        logger.debug(f'Asaas customer update response body: {resp.text}')
        resp.raise_for_status()
    logger.info(f'Asaas customer updated: {asaas_customer_id}')



def obter_url_pagamento_assinatura(asaas_subscription_id: str) -> str:
    """
    Fetches the first pending payment of a subscription and returns its invoiceUrl.
    This is the hosted Asaas page where the customer can pay via boleto, PIX or credit card.
    """
    resp = requests.get(
        f'{_base_url()}/payments',
        params={'subscription': asaas_subscription_id},
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    payments = resp.json().get('data', [])
    if payments:
        invoice_url = payments[0].get('invoiceUrl', '')
        logger.info(f'Invoice URL for {asaas_subscription_id}: {invoice_url}')
        return invoice_url
    return ''


def listar_pagamentos_assinatura(asaas_subscription_id: str, limit: int = 10) -> list:
    """
    Returns the most recent payments for a subscription, newest first.
    Each dict contains: id, value, dueDate, paymentDate, status, invoiceUrl.
    """
    resp = requests.get(
        f'{_base_url()}/payments',
        params={'subscription': asaas_subscription_id, 'limit': limit},
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    payments = resp.json().get('data', [])
    result = []
    for p in payments:
        result.append({
            'id': p.get('id'),
            'value': p.get('value'),
            'dueDate': p.get('dueDate'),
            'paymentDate': p.get('paymentDate') or p.get('confirmedDate'),
            'status': p.get('status'),
            'invoiceUrl': p.get('invoiceUrl', ''),
        })
    return result


def criar_assinatura_cartao_asaas(
    asaas_customer_id: str,
    plano,
    ciclo: str,
    credit_card: dict,
    holder_info: dict,
) -> dict:
    """
    Creates a recurring subscription in Asaas charged immediately via credit card.
    credit_card: { holder_name, number, expiry_month, expiry_year, ccv }
    holder_info: { name, email, cpf_cnpj, phone, postal_code, address_number }
    Returns the subscription dict. Raises on card decline or API error.
    """
    from django.utils import timezone

    today = timezone.localdate()  # respects TIME_ZONE = 'America/Sao_Paulo'
    if ciclo == 'YEARLY':
        value = float(plano.preco_anual)
        asaas_cycle = 'YEARLY'
    else:
        value = float(plano.preco_mensal)
        asaas_cycle = 'MONTHLY'

    # nextDueDate = today → Asaas charges the card immediately
    next_due = today.strftime('%Y-%m-%d')

    payload = {
        'customer': asaas_customer_id,
        'billingType': 'CREDIT_CARD',
        'value': value,
        'nextDueDate': next_due,
        'cycle': asaas_cycle,
        'description': f'Assinatura Vincor — Plano {plano.nome}',
        'externalReference': f'{plano.slug}-{ciclo.lower()}',
        'creditCard': {
            'holderName': credit_card['holder_name'],
            'number': credit_card['number'].replace(' ', ''),
            'expiryMonth': credit_card['expiry_month'],
            'expiryYear': credit_card['expiry_year'],
            'ccv': credit_card['ccv'],
        },
        'creditCardHolderInfo': {
            'name': holder_info['name'],
            'cpfCnpj': holder_info['cpf_cnpj'].replace('.', '').replace('-', '').replace('/', ''),
            **({'email': holder_info['email']} if holder_info.get('email') else {}),
            **({'phone': holder_info['phone']} if holder_info.get('phone') else {}),
            **({'postalCode': holder_info['postal_code'].replace('-', '')} if holder_info.get('postal_code') else {}),
            **({'addressNumber': holder_info['address_number']} if holder_info.get('address_number') else {}),
        },
    }

    resp = requests.post(
        f'{_base_url()}/subscriptions',
        json=payload,
        headers=_headers(),
        timeout=15,
    )
    if not resp.ok:
        logger.error(f'Asaas credit card subscription error: HTTP {resp.status_code}')
        logger.debug(f'Asaas credit card subscription response body: {resp.text}')
        resp.raise_for_status()
    data = resp.json()
    logger.info(f'Asaas credit card subscription created: {data["id"]}')
    return data


def criar_assinatura_cartao_token_asaas(
    asaas_customer_id: str,
    plano,
    ciclo: str,
    credit_card_token: str,
) -> dict:
    """
    Creates a recurring subscription in Asaas using a card token generated client-side.
    credit_card_token: token generated in the browser via Asaas SDK.
    Returns the subscription dict.
    """
    from django.utils import timezone

    today = timezone.localdate()  # respects TIME_ZONE = 'America/Sao_Paulo'
    value = float(plano.preco_anual) if ciclo == 'YEARLY' else float(plano.preco_mensal)
    asaas_cycle = 'YEARLY' if ciclo == 'YEARLY' else 'MONTHLY'
    next_due = today.strftime('%Y-%m-%d')

    payload = {
        'customer': asaas_customer_id,
        'billingType': 'CREDIT_CARD',
        'value': value,
        'nextDueDate': next_due,
        'cycle': asaas_cycle,
        'description': f'Assinatura Vincor — Plano {plano.nome}',
        'externalReference': f'{plano.slug}-{ciclo.lower()}',
        'creditCardToken': credit_card_token,
    }

    resp = requests.post(
        f'{_base_url()}/subscriptions',
        json=payload,
        headers=_headers(),
        timeout=15,
    )
    if not resp.ok:
        logger.error(f'Asaas credit card token subscription error: HTTP {resp.status_code}')
        logger.debug(f'Asaas credit card token subscription response body: {resp.text}')
        resp.raise_for_status()
    data = resp.json()
    logger.info(f'Asaas credit card token subscription created: {data["id"]}')
    return data


def reativar_assinatura_asaas(asaas_customer_id: str, plano, ciclo: str, next_due_date: str) -> dict:
    """
    Re-creates a subscription in Asaas starting from next_due_date (no immediate charge).
    next_due_date: 'YYYY-MM-DD' string — typically proxima_cobranca from the cancelled subscription.
    Returns the subscription dict.
    """
    if ciclo == 'YEARLY':
        value = float(plano.preco_anual)
        asaas_cycle = 'YEARLY'
    else:
        value = float(plano.preco_mensal)
        asaas_cycle = 'MONTHLY'

    payload = {
        'customer': asaas_customer_id,
        'billingType': 'UNDEFINED',
        'value': value,
        'nextDueDate': next_due_date,
        'cycle': asaas_cycle,
        'description': f'Assinatura Vincor — Plano {plano.nome} (reativada)',
        'externalReference': f'{plano.slug}-{ciclo.lower()}',
    }

    resp = requests.post(
        f'{_base_url()}/subscriptions',
        json=payload,
        headers=_headers(),
        timeout=15,
    )
    if not resp.ok:
        logger.error(f'Asaas reactivation error: HTTP {resp.status_code}')
        logger.debug(f'Asaas reactivation response body: {resp.text}')
        resp.raise_for_status()
    data = resp.json()
    logger.info(f'Asaas subscription reactivated: {data["id"]}')
    return data


def atualizar_cartao_assinatura(
    asaas_subscription_id: str,
    credit_card: dict,
    holder_info: dict,
) -> dict:
    """
    Updates the credit card used for an existing Asaas subscription.
    POST /subscriptions/{id}/creditCard
    credit_card: { holder_name, number, expiry_month, expiry_year, ccv }
    holder_info: { name, cpf_cnpj, email, phone, postal_code, address_number }
    Returns the updated creditCard info dict.
    """
    payload = {
        'creditCard': {
            'holderName': credit_card['holder_name'],
            'number': credit_card['number'].replace(' ', ''),
            'expiryMonth': credit_card['expiry_month'],
            'expiryYear': credit_card['expiry_year'],
            'ccv': credit_card['ccv'],
        },
        'creditCardHolderInfo': {
            'name': holder_info['name'],
            'cpfCnpj': holder_info['cpf_cnpj'].replace('.', '').replace('-', '').replace('/', ''),
            **({'email': holder_info['email']} if holder_info.get('email') else {}),
            **({'phone': holder_info['phone']} if holder_info.get('phone') else {}),
            **({'postalCode': holder_info['postal_code'].replace('-', '')} if holder_info.get('postal_code') else {}),
            **({'addressNumber': holder_info['address_number']} if holder_info.get('address_number') else {}),
        },
        'updatePendingPayments': True,
    }
    resp = requests.put(
        f'{_base_url()}/subscriptions/{asaas_subscription_id}/creditCard',
        json=payload,
        headers=_headers(),
        timeout=15,
    )
    if not resp.ok:
        logger.error(f'Asaas update card error: HTTP {resp.status_code}')
        logger.debug(f'Asaas update card response body: {resp.text}')
        resp.raise_for_status()
    data = resp.json()
    logger.info(f'Asaas card updated for subscription {asaas_subscription_id}')
    return data


def cancelar_assinatura_asaas(asaas_subscription_id: str) -> None:
    """Cancels a subscription in Asaas."""
    resp = requests.delete(
        f'{_base_url()}/subscriptions/{asaas_subscription_id}',
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    logger.info(f'Asaas subscription cancelled: {asaas_subscription_id}')
