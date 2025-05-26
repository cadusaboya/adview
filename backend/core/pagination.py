from rest_framework.pagination import PageNumberPagination


class DynamicPageSizePagination(PageNumberPagination):
    page_size = 12  # valor padrão
    page_size_query_param = 'page_size'  # permite que o frontend controle isso
    max_page_size = 100  # limite máximo de segurança