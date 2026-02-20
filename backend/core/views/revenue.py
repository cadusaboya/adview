import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q, Exists, OuterRef
from django.utils import timezone
from .mixins import CompanyScopedViewSetMixin
from ..models import Receita, ReceitaRecorrente, ReceitaComissao, ClienteComissao
from ..serializers import ReceitaSerializer, ReceitaAbertaSerializer, ReceitaRecorrenteSerializer
from ..pagination import DynamicPageSizePagination

logger = logging.getLogger(__name__)


class ReceitaViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Receita.objects.all()
    serializer_class = ReceitaSerializer
    pagination_class = DynamicPageSizePagination

    def get_serializer_class(self):
        situacoes = self.request.query_params.getlist("situacao")

        # Receitas em aberto → serializer com saldo
        if situacoes and set(situacoes).issubset({"A", "V"}):
            return ReceitaAbertaSerializer

        return ReceitaSerializer

    def _atualizar_vencidas(self):
        """Atualiza automaticamente receitas vencidas (on-the-fly)."""
        hoje = timezone.now().date()
        Receita.objects.filter(
            company=self.request.user.company,
            situacao='A',
            data_vencimento__lt=hoje
        ).update(situacao='V')

    def get_queryset(self):
        # Atualiza vencidas antes de retornar o queryset
        self._atualizar_vencidas()

        queryset = super().get_queryset().select_related(
            "cliente", "company"
        ).prefetch_related(
            "allocations", "comissoes__funcionario"
        )

        params = self.request.query_params

        # FILTRO GLOBAL
        search = params.get("search")
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(descricao__icontains=search) |
                Q(cliente__nome__icontains=search) |
                Q(valor__icontains=search) |
                Q(data_vencimento__icontains=search)
            )

        # filtros
        situacoes = params.getlist("situacao")
        if situacoes:
            queryset = queryset.filter(situacao__in=situacoes)

        cliente_id = params.get("cliente_id")
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)

        funcionario_id = params.get("funcionario_id")
        if funcionario_id:
            # Receitas que têm comissão específica para este funcionário
            tem_comissao_receita = Exists(
                ReceitaComissao.objects.filter(
                    receita=OuterRef('pk'),
                    funcionario_id=funcionario_id
                )
            )
            # Receitas sem comissão própria (herdam do cliente) cujo cliente
            # tem comissão para este funcionário
            sem_comissao_receita = ~Exists(
                ReceitaComissao.objects.filter(receita=OuterRef('pk'))
            )
            tem_comissao_cliente = Exists(
                ClienteComissao.objects.filter(
                    cliente=OuterRef('cliente'),
                    funcionario_id=funcionario_id
                )
            )
            queryset = queryset.filter(
                tem_comissao_receita | (sem_comissao_receita & tem_comissao_cliente)
            )

        start_date = params.get("start_date")
        end_date = params.get("end_date")

        if start_date:
            queryset = queryset.filter(data_vencimento__gte=start_date)
        if end_date:
            queryset = queryset.filter(data_vencimento__lte=end_date)

        # ORDENAÇÃO
        ORDERING_FIELDS = {'data_vencimento', '-data_vencimento', 'data_pagamento', '-data_pagamento',
                           'valor', '-valor', 'nome', '-nome', 'cliente__nome', '-cliente__nome'}
        ordering = params.get('ordering')
        if ordering and ordering in ORDERING_FIELDS:
            queryset = queryset.order_by(ordering, 'id')
        elif situacoes and set(situacoes).issubset({"P", "V"}):
            queryset = queryset.order_by("-data_pagamento", "-data_vencimento", "id")
        else:
            queryset = queryset.order_by("data_vencimento", "id")

        return queryset

    def create(self, request, *args, **kwargs):
        import calendar
        from datetime import date
        from decimal import Decimal

        try:
            num_parcelas = max(1, int(request.data.get('num_parcelas', 1)))
        except (ValueError, TypeError):
            num_parcelas = 1

        if num_parcelas == 1:
            return super().create(request, *args, **kwargs)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vdata = serializer.validated_data

        nome_base = vdata['nome']
        valor_total = vdata['valor']
        data_base = vdata['data_vencimento']
        comissoes_data = vdata.get('comissoes', [])

        def add_months(d, months):
            month = d.month - 1 + months
            year = d.year + month // 12
            month = month % 12 + 1
            day = min(d.day, calendar.monthrange(year, month)[1])
            return date(year, month, day)

        valor_parcela = round(Decimal(str(valor_total)) / num_parcelas, 2)
        common = {k: v for k, v in vdata.items() if k not in ('nome', 'valor', 'data_vencimento', 'comissoes')}

        from ..models import ReceitaComissao
        for i in range(num_parcelas):
            nome_i = f"{nome_base} ({i + 1}/{num_parcelas})"
            valor_i = valor_parcela if i < num_parcelas - 1 else (valor_total - valor_parcela * (num_parcelas - 1))
            receita = Receita.objects.create(
                company=request.user.company,
                nome=nome_i,
                valor=valor_i,
                data_vencimento=add_months(data_base, i),
                **common
            )
            for c in comissoes_data:
                ReceitaComissao.objects.create(receita=receita, **c)

        return Response({'parcelas_criadas': num_parcelas}, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        receita = serializer.save(company=self.request.user.company)

        # Handle payment creation if marked as paid
        marcar_como_pago = self.request.data.get('marcar_como_pago', False)
        if marcar_como_pago:
            data_pagamento = self.request.data.get('data_pagamento')
            conta_bancaria_id = self.request.data.get('conta_bancaria_id')
            observacao_pagamento = self.request.data.get('observacao_pagamento', '')

            if data_pagamento and conta_bancaria_id:
                from ..models import Payment, ContaBancaria, Allocation

                try:
                    conta_bancaria = ContaBancaria.objects.get(
                        id=conta_bancaria_id,
                        company=self.request.user.company
                    )

                    # Cria o payment neutro (entrada)
                    payment = Payment.objects.create(
                        company=self.request.user.company,
                        tipo='E',  # Entrada
                        conta_bancaria=conta_bancaria,
                        valor=receita.valor,
                        data_pagamento=data_pagamento,
                        observacao=observacao_pagamento
                    )

                    # Cria a alocação para a receita
                    Allocation.objects.create(
                        company=self.request.user.company,
                        payment=payment,
                        receita=receita,
                        valor=receita.valor
                    )

                    # Atualiza saldo da conta bancária (entrada de dinheiro)
                    conta_bancaria.saldo_atual += payment.valor
                    conta_bancaria.save()

                    # Atualiza status da receita
                    receita.atualizar_status()
                except ContaBancaria.DoesNotExist:
                    logger.warning(
                        f"Conta bancária {conta_bancaria_id} não encontrada ao processar receita {receita.id}. "
                        "Pagamento não criado."
                    )


class ReceitaRecorrenteViewSet(CompanyScopedViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet para gerenciar receitas recorrentes.

    Endpoints:
    - GET/POST /api/receitas-recorrentes/
    - GET/PUT/PATCH/DELETE /api/receitas-recorrentes/{id}/
    - POST /api/receitas-recorrentes/gerar-mes/
    """

    queryset = ReceitaRecorrente.objects.all()
    serializer_class = ReceitaRecorrenteSerializer
    pagination_class = DynamicPageSizePagination

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'cliente', 'company'
        )

        params = self.request.query_params

        # Busca
        search = params.get('search')
        if search:
            queryset = queryset.filter(
                Q(nome__icontains=search) |
                Q(descricao__icontains=search) |
                Q(cliente__nome__icontains=search)
            )

        # Filtros
        status_filter = params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        cliente_id = params.get('cliente_id')
        if cliente_id:
            queryset = queryset.filter(cliente_id=cliente_id)

        tipo = params.get('tipo')
        if tipo:
            queryset = queryset.filter(tipo=tipo)

        ORDERING_FIELDS = {'nome', '-nome', 'valor', '-valor', 'cliente__nome', '-cliente__nome'}
        ordering = params.get('ordering')
        if ordering and ordering in ORDERING_FIELDS:
            return queryset.order_by(ordering, 'id')
        return queryset.order_by('nome', 'id')

    @action(detail=False, methods=['post'], url_path='gerar-mes')
    def gerar_mes(self, request):
        """
        Gera receitas individuais para o mês atual baseado nas recorrentes ativas.

        POST /api/receitas-recorrentes/gerar-mes/
        Body: {
            "mes": "2024-01" (opcional, default: mês atual)
        }

        Retorna:
        {
            "criadas": 5,
            "ignoradas": 2,
            "detalhes": [...]
        }
        """
        from datetime import date
        import calendar
        from django.db.models import Q

        # Pega mês da requisição ou usa mês atual
        mes_str = request.data.get('mes')
        if mes_str:
            try:
                ano, mes = map(int, mes_str.split('-'))
                mes_referencia = date(ano, mes, 1)
            except (ValueError, IndexError) as e:
                return Response(
                    {'erro': f'Formato de mês inválido. Use YYYY-MM. Detalhe: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            hoje = timezone.now().date()
            mes_referencia = date(hoje.year, hoje.month, 1)

        # Busca todas as receitas recorrentes ativas
        # Quando o mês é especificado manualmente, não filtra por data_inicio nem data_fim
        recorrentes = ReceitaRecorrente.objects.filter(
            company=request.user.company,
            status='A'
        )

        criadas = 0
        ignoradas = 0
        detalhes = []

        for recorrente in recorrentes:
            # Verifica se já existe receita para este mês
            nome_esperado = f"{recorrente.nome} - {mes_referencia.strftime('%m/%Y')}"

            receita_existente = Receita.objects.filter(
                company=request.user.company,
                nome=nome_esperado,
                cliente=recorrente.cliente
            ).exists()

            if receita_existente:
                ignoradas += 1
                detalhes.append({
                    'nome': recorrente.nome,
                    'status': 'ignorada',
                    'motivo': 'Já gerada para este mês'
                })
                continue

            # Calcula data de vencimento
            ultimo_dia_mes = calendar.monthrange(
                mes_referencia.year,
                mes_referencia.month
            )[1]
            dia_vencimento = min(recorrente.dia_vencimento, ultimo_dia_mes)
            data_vencimento = date(
                mes_referencia.year,
                mes_referencia.month,
                dia_vencimento
            )

            # Cria receita individual
            try:
                receita = Receita.objects.create(
                    company=request.user.company,
                    cliente=recorrente.cliente,
                    nome=f"{recorrente.nome} - {mes_referencia.strftime('%m/%Y')}",
                    descricao=recorrente.descricao or '',
                    valor=recorrente.valor,
                    tipo=recorrente.tipo,
                    data_vencimento=data_vencimento,
                    situacao='A',
                    forma_pagamento=recorrente.forma_pagamento
                )

                # Copia regras de comissão da recorrente para a receita gerada
                from ..models import ReceitaComissao
                for regra in recorrente.comissoes.all():
                    ReceitaComissao.objects.create(
                        receita=receita,
                        funcionario=regra.funcionario,
                        percentual=regra.percentual
                    )

                criadas += 1
                detalhes.append({
                    'nome': recorrente.nome,
                    'status': 'criada',
                    'data_vencimento': str(data_vencimento)
                })

            except Exception as e:
                detalhes.append({
                    'nome': recorrente.nome,
                    'status': 'erro',
                    'motivo': str(e)
                })

        return Response({
            'criadas': criadas,
            'ignoradas': ignoradas,
            'mes': mes_referencia.strftime('%Y-%m'),
            'detalhes': detalhes
        })

    @action(detail=True, methods=['post'], url_path='gerar-proximos-meses')
    def gerar_proximos_meses(self, request, pk=None):
        """
        Gera receitas para os próximos X meses de uma receita recorrente específica.

        POST /api/receitas-recorrentes/{id}/gerar-proximos-meses/
        Body: {
            "quantidade_meses": 10
        }

        Retorna:
        {
            "criadas": 10,
            "ignoradas": 0,
            "detalhes": [...]
        }
        """
        from datetime import date
        import calendar

        recorrente = self.get_object()
        quantidade_meses = request.data.get('quantidade_meses', 1)

        if not isinstance(quantidade_meses, int) or quantidade_meses < 1 or quantidade_meses > 60:
            return Response(
                {'erro': 'Quantidade de meses deve ser um número entre 1 e 60'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Helper function to add months
        def add_months(source_date, months):
            month = source_date.month - 1 + months
            year = source_date.year + month // 12
            month = month % 12 + 1
            day = min(source_date.day, calendar.monthrange(year, month)[1])
            return date(year, month, day)

        # Começar sempre do mês atual
        hoje = timezone.now().date()
        mes_inicial = date(hoje.year, hoje.month, 1)

        criadas = 0
        ignoradas = 0
        detalhes = []

        for i in range(quantidade_meses):
            mes_referencia = add_months(mes_inicial, i)

            # Verifica se está dentro do período de validade (compara apenas ano/mês)
            if (recorrente.data_inicio.year > mes_referencia.year or
                (recorrente.data_inicio.year == mes_referencia.year and
                 recorrente.data_inicio.month > mes_referencia.month)):
                ignoradas += 1
                detalhes.append({
                    'mes': mes_referencia.strftime('%Y-%m'),
                    'status': 'ignorada',
                    'motivo': 'Antes da data de início'
                })
                continue

            if recorrente.data_fim:
                if (recorrente.data_fim.year < mes_referencia.year or
                    (recorrente.data_fim.year == mes_referencia.year and
                     recorrente.data_fim.month < mes_referencia.month)):
                    ignoradas += 1
                    detalhes.append({
                        'mes': mes_referencia.strftime('%Y-%m'),
                        'status': 'ignorada',
                        'motivo': 'Depois da data de fim'
                    })
                    continue

            # Verifica se já existe
            nome_esperado = f"{recorrente.nome} - {mes_referencia.strftime('%m/%Y')}"
            receita_existente = Receita.objects.filter(
                company=request.user.company,
                nome=nome_esperado,
                cliente=recorrente.cliente
            ).exists()

            if receita_existente:
                ignoradas += 1
                detalhes.append({
                    'mes': mes_referencia.strftime('%Y-%m'),
                    'status': 'ignorada',
                    'motivo': 'Já existe'
                })
                continue

            # Calcula data de vencimento
            ultimo_dia_mes = calendar.monthrange(
                mes_referencia.year,
                mes_referencia.month
            )[1]
            dia_vencimento = min(recorrente.dia_vencimento, ultimo_dia_mes)
            data_vencimento = date(
                mes_referencia.year,
                mes_referencia.month,
                dia_vencimento
            )

            # Cria receita individual
            try:
                receita = Receita.objects.create(
                    company=request.user.company,
                    cliente=recorrente.cliente,
                    nome=nome_esperado,
                    descricao=recorrente.descricao or '',
                    valor=recorrente.valor,
                    tipo=recorrente.tipo,
                    data_vencimento=data_vencimento,
                    situacao='A',
                    forma_pagamento=recorrente.forma_pagamento
                )

                criadas += 1
                detalhes.append({
                    'mes': mes_referencia.strftime('%Y-%m'),
                    'status': 'criada',
                    'data_vencimento': str(data_vencimento)
                })

            except Exception as e:
                detalhes.append({
                    'mes': mes_referencia.strftime('%Y-%m'),
                    'status': 'erro',
                    'motivo': str(e)
                })

        return Response({
            'criadas': criadas,
            'ignoradas': ignoradas,
            'detalhes': detalhes
        })

    def perform_update(self, serializer):
        serializer.save()
