"""
PDF Helper Functions para Relatórios do Vincor
Otimizado para eficiência e reutilização
"""

from decimal import Decimal
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from datetime import datetime
import locale

# Configurar locale para formatação de moeda
try:
    locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
except:
    locale.setlocale(locale.LC_ALL, '')


def format_currency(value: Decimal) -> str:
    """Formata valor decimal como moeda brasileira."""
    if value is None:
        return "R$ 0,00"
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_date(date_obj) -> str:
    """Formata data no padrão dd/mm/yyyy."""
    if date_obj is None:
        return "-"
    return date_obj.strftime("%d/%m/%Y")


def truncate_text(text: str, max_length: int) -> str:
    """Trunca texto com reticências se exceder comprimento máximo."""
    if text is None:
        return ""
    if len(text) > max_length:
        return text[:max_length - 3] + "..."
    return text


def shorten_text_by_width(text: str, max_width: float, pdf_canvas, 
                          font_name: str = "Helvetica", font_size: int = 9) -> str:
    """Encurta texto baseado na largura visual no PDF."""
    if text is None:
        return ""
    
    pdf_canvas.setFont(font_name, font_size)
    original_text = text
    
    while pdf_canvas.stringWidth(text) > max_width and len(text) > 0:
        text = text[:-1]
    
    if len(text) < len(original_text):
        return text.strip() + "..."
    return text


class PDFReportBase:
    """Classe base para geração de relatórios em PDF com padrão consistente."""
    
    def __init__(self, title: str, company_name: str = "Vincor"):
        self.title = title
        self.company_name = company_name
        self.margin = 40
        self.page_count = 1
        
    def draw_header(self, pdf: canvas.Canvas, width: float, height: float, 
                   subtitle: str = "", date_range: str = ""):
        """Desenha cabeçalho padrão do relatório."""
        # Título da empresa
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawCentredString(width / 2, height - 40, self.company_name)
        
        # Título do relatório
        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawCentredString(width / 2, height - 60, self.title)
        
        # Subtítulo (se houver)
        if subtitle:
            pdf.setFont("Helvetica", 10)
            pdf.drawCentredString(width / 2, height - 80, subtitle)
        
        # Data/período
        if date_range:
            pdf.setFont("Helvetica", 9)
            pdf.drawString(self.margin, height - 110, f"Período: {date_range}")
        
        # Data de geração
        pdf.setFont("Helvetica", 8)
        pdf.drawString(self.margin, height - 125, 
                      f"Gerado em: {datetime.now().strftime('%d/%m/%Y às %H:%M:%S')}")
        
        return height - 150
    
    def draw_table_header(self, pdf: canvas.Canvas, y: float, columns: list, 
                         width: float, height: float):
        """
        Desenha cabeçalho de tabela.
        
        Args:
            pdf: Canvas do reportlab
            y: Posição Y
            columns: Lista de dicts com 'label' e 'x' (posição X)
            width: Largura da página
            height: Altura da página
        """
        pdf.setFont("Helvetica-Bold", 9)
        
        for col in columns:
            pdf.drawString(col['x'], y, col['label'])
        
        # Linha separadora
        y -= 5
        pdf.line(self.margin, y, width - self.margin, y)
        
        return y - 15
    
    def check_page_break(self, pdf: canvas.Canvas, y: float, width: float, 
                        height: float, columns: list = None) -> float:
        """
        Verifica se precisa quebrar página e redesenha cabeçalho se necessário.
        
        Args:
            pdf: Canvas do reportlab
            y: Posição Y atual
            width: Largura da página
            height: Altura da página
            columns: Colunas da tabela (para redesenhar cabeçalho)
        
        Returns:
            Nova posição Y
        """
        if y < 60:
            pdf.showPage()
            self.page_count += 1
            y = height - 50
            
            if columns:
                y = self.draw_table_header(pdf, y, columns, width, height)
        
        return y
    
    def draw_row(self, pdf: canvas.Canvas, y: float, row_data: dict, 
                columns: list, font_size: int = 9):
        """
        Desenha uma linha de dados na tabela.
        
        Args:
            pdf: Canvas do reportlab
            y: Posição Y
            row_data: Dict com dados da linha
            columns: Lista de dicts com 'key' (chave no row_data) e 'x' (posição X)
            font_size: Tamanho da fonte
        
        Returns:
            Nova posição Y
        """
        pdf.setFont("Helvetica", font_size)
        
        for col in columns:
            value = row_data.get(col['key'], "")
            
            # Formatar valor se for decimal
            if isinstance(value, Decimal):
                value = format_currency(value)
            elif isinstance(value, datetime):
                value = format_date(value)
            elif value is None:
                value = "-"
            else:
                value = str(value)
            
            # Truncar se necessário
            if col.get('max_length'):
                value = truncate_text(value, col['max_length'])
            
            pdf.drawString(col['x'], y, value)
        
        return y - 15
    
    def draw_total_row(self, pdf: canvas.Canvas, y: float, label: str, 
                      value: Decimal, x_label: float, x_value: float):
        """Desenha linha de total."""
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(x_label, y, label)
        pdf.drawString(x_value, y, format_currency(value))
        return y - 20
    
    def draw_footer(self, pdf: canvas.Canvas, width: float):
        """Desenha rodapé com número de página."""
        pdf.setFont("Helvetica", 7)
        pdf.drawRightString(width - 40, 20, f"Página {self.page_count}")


class TableBuilder:
    """Builder para facilitar construção de tabelas com cálculos automáticos."""
    
    def __init__(self):
        self.rows = []
        self.total = Decimal("0.00")
    
    def add_row(self, row_data: dict, amount_key: str = None):
        """Adiciona linha e atualiza total se amount_key for fornecido."""
        self.rows.append(row_data)
        if amount_key and amount_key in row_data:
            self.total += Decimal(str(row_data[amount_key]))
    
    def add_rows(self, rows: list, amount_key: str = None):
        """Adiciona múltiplas linhas."""
        for row in rows:
            self.add_row(row, amount_key)
    
    def get_total(self) -> Decimal:
        """Retorna o total acumulado."""
        return self.total
    
    def get_rows(self) -> list:
        """Retorna todas as linhas."""
        return self.rows
    
    def clear(self):
        """Limpa o builder."""
        self.rows = []
        self.total = Decimal("0.00")


def create_simple_table(pdf: canvas.Canvas, width: float, height: float,
                       data: list, columns: list, title: str = "",
                       company_name: str = "Vincor"):
    """
    Cria um relatório simples com tabela.
    
    Args:
        pdf: Canvas do reportlab
        width: Largura da página
        height: Altura da página
        data: Lista de dicts com dados
        columns: Lista de dicts com 'label', 'key', 'x'
        title: Título do relatório
        company_name: Nome da empresa
    
    Returns:
        Total calculado (se houver coluna 'amount_key')
    """
    report = PDFReportBase(title, company_name)
    y = report.draw_header(pdf, width, height)
    y = report.draw_table_header(pdf, y, columns, width, height)
    
    total = Decimal("0.00")
    amount_key = None
    
    # Encontrar coluna de valor
    for col in columns:
        if col.get('is_amount'):
            amount_key = col['key']
            break
    
    # Desenhar linhas
    for row in data:
        y = report.check_page_break(pdf, y, width, height, columns)
        y = report.draw_row(pdf, y, row, columns)
        
        if amount_key and amount_key in row:
            total += Decimal(str(row[amount_key]))
    
    # Desenhar total
    if amount_key and data:
        y -= 5
        amount_col = next((c for c in columns if c.get('is_amount')), None)
        if amount_col:
            y = report.draw_total_row(pdf, y, "TOTAL", total, 
                                     columns[-2]['x'], amount_col['x'])
    
    report.draw_footer(pdf, width)
    pdf.showPage()
    
    return total
