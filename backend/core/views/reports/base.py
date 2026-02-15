from rest_framework import permissions
from rest_framework.views import APIView


class BaseReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_company_queryset(self, model):
        user = self.request.user
        if user.is_superuser:
            return model.objects.all()
        if hasattr(user, 'company') and user.company:
            return model.objects.filter(company=user.company)
        return model.objects.none()

    def get_common_filters(self):
        params = self.request.query_params
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        filters = {}
        if start_date:
            filters['data_vencimento__gte'] = start_date
        if end_date:
            filters['data_vencimento__lte'] = end_date
        return filters
