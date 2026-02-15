from rest_framework import viewsets, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from .mixins import CompanyScopedViewSetMixin
from ..models import Company, CustomUser
from ..serializers import CompanySerializer, CustomUserSerializer


# --- ViewSets ---

class CompanyViewSet(viewsets.ModelViewSet):
    """API endpoint for Companies. Accessible only by superusers for management."""
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    # Typically, only superusers should manage companies
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """
        GET /api/companies/me/ - Returns the authenticated user's company
        PATCH /api/companies/me/ - Updates the authenticated user's company
        """
        user = request.user

        if not hasattr(user, 'company') or not user.company:
            return Response(
                {"detail": "User does not belong to a company."},
                status=status.HTTP_404_NOT_FOUND
            )

        if request.method == 'GET':
            serializer = self.get_serializer(user.company)
            return Response(serializer.data)

        elif request.method == 'PATCH':
            serializer = self.get_serializer(
                user.company,
                data=request.data,
                partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

class CustomUserViewSet(viewsets.ModelViewSet):
    """API endpoint for Users. Allows creation and management within a company context."""
    queryset = CustomUser.objects.all()
    serializer_class = CustomUserSerializer
    permission_classes = [permissions.IsAuthenticated] # Start with authenticated, refine later if needed

    def get_queryset(self):
        """Users can see other users in their own company. Superusers see all."""
        user = self.request.user
        if user.is_superuser:
            return CustomUser.objects.all()
        if hasattr(user, 'company') and user.company:
            # Users can see/manage others in the same company
            return CustomUser.objects.filter(company=user.company)
        # Users without a company or not superuser might only see themselves
        # return CustomUser.objects.filter(pk=user.pk) # Or return none()
        return CustomUser.objects.none()

    def perform_create(self, serializer):
        """Assign company based on creating user, allow superuser override."""
        user = self.request.user
        company_id = self.request.data.get('company_id')

        target_company = None
        if user.is_superuser and company_id:
            try:
                target_company = Company.objects.get(pk=company_id)
            except Company.DoesNotExist:
                 raise serializers.ValidationError({"company_id": "Invalid company specified."})
        elif hasattr(user, 'company') and user.company:
            target_company = user.company

        # We must set the company before validating the serializer if it relies on it
        # Or pass it in context. Here, we save with the determined company.
        if target_company:
             serializer.save(company=target_company)
        else:
             # Non-superuser without a company cannot create users for other companies
             # Or maybe allow creating users without company? Depends on rules.
             # For now, assume users must belong to a company if created by non-superuser
             if not user.is_superuser:
                 from rest_framework.exceptions import PermissionDenied
                 raise PermissionDenied("You must belong to a company to create users.")
             else:
                 # Superuser creating user without company
                 serializer.save(company=None)
