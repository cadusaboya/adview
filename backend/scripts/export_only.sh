#!/bin/bash

# Script simples para apenas exportar dados
# Uso: ./scripts/export_only.sh

set -e

echo "======================================"
echo "  EXPORTAÇÃO DE DADOS"
echo "======================================"
echo ""

# Verificar se está no diretório backend
if [ ! -f "manage.py" ]; then
    echo "❌ Erro: Execute este script do diretório backend!"
    echo "cd backend && ./scripts/export_only.sh"
    exit 1
fi

# Verificar/ativar virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    else
        echo "❌ venv não encontrado!"
        exit 1
    fi
fi

# Nome do arquivo com timestamp
OUTPUT_FILE="dados_dev_$(date +%Y%m%d_%H%M%S).json"

echo "📦 Exportando dados..."
echo "Arquivo: $OUTPUT_FILE"
echo ""

# Exportar
python manage.py export_data --output "$OUTPUT_FILE"

echo ""
echo "✅ Exportação concluída!"
echo ""
echo "Próximos passos:"
echo "1. Transferir para produção:"
echo "   scp $OUTPUT_FILE usuario@servidor:/caminho/destino/"
echo ""
echo "2. No servidor, importar:"
echo "   python manage.py import_data --input $OUTPUT_FILE --dry-run --skip-existing"
echo "   python manage.py import_data --input $OUTPUT_FILE --skip-existing"
echo ""
