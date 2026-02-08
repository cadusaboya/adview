#!/bin/bash

# Script simplificado para importar dados no Railway
# Uso: ./scripts/railway_import.sh

set -e

echo "======================================"
echo "  MIGRAÇÃO DE DADOS PARA RAILWAY"
echo "======================================"
echo ""

# Configurações do Railway
RAILWAY_PROJECT="cdc8d057-52c1-4d62-95e1-9d630e03b361"
RAILWAY_ENV="09095526-e4dc-4f0f-9104-1bdef75ce753"
RAILWAY_SERVICE="4a3a2180-96e7-4b31-a91f-ea21db2cab9a"

# Verificar railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI não encontrado!"
    echo ""
    echo "Instale com:"
    echo "  npm install -g @railway/cli"
    echo "  # ou"
    echo "  brew install railway"
    echo ""
    exit 1
fi

# Verificar se está logado
if ! railway whoami &> /dev/null; then
    echo "❌ Você não está logado no Railway!"
    echo "Execute: railway login"
    exit 1
fi

# Verificar diretório
if [ ! -f "manage.py" ]; then
    echo "❌ Execute este script do diretório backend!"
    exit 1
fi

# Ativar venv
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
fi

# Exportar dados
OUTPUT_FILE="dados_dev_$(date +%Y%m%d_%H%M%S).json"

echo "📦 Exportando dados..."
python manage.py export_data --output "$OUTPUT_FILE"

FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
echo "✅ Dados exportados: $OUTPUT_FILE ($FILE_SIZE)"
echo ""

# Perguntar qual método usar
echo "Escolha o método de importação:"
echo ""
echo "1) Stdin direto (rápido, arquivos até ~10MB)"
echo "2) Upload temporário (para arquivos grandes)"
echo "3) Cancelar"
echo ""
read -p "Escolha (1-3): " METHOD

case $METHOD in
    1)
        echo ""
        echo "🚂 Método 1: Upload temporário + Execução no Railway"
        echo ""
        echo "ℹ️  Nota: railway run executa comandos NO Railway, não localmente"
        echo ""
        echo "Fazendo upload temporário..."

        # Upload para serviço temporário
        UPLOAD_URL=$(curl --upload-file "$OUTPUT_FILE" https://transfer.sh/dados.json 2>/dev/null)

        if [ -z "$UPLOAD_URL" ]; then
            echo "❌ Erro ao fazer upload!"
            echo "Tente o método manual (veja RAILWAY_MIGRATION_GUIDE.md)"
            exit 1
        fi

        echo "✅ Upload concluído!"
        echo "URL: $UPLOAD_URL"
        echo ""

        # Dry-run no Railway
        echo "🔍 Executando DRY-RUN no Railway..."
        railway run \
            --project="$RAILWAY_PROJECT" \
            --environment="$RAILWAY_ENV" \
            --service="$RAILWAY_SERVICE" \
            bash -c "cd /app && wget -q -O dados.json '$UPLOAD_URL' && python manage.py import_data --input dados.json --dry-run --skip-existing && rm dados.json"

        echo ""
        read -p "✅ Dry-run passou! Importar de verdade? (s/N): " CONFIRM

        if [ "$CONFIRM" = "s" ] || [ "$CONFIRM" = "S" ]; then
            echo ""
            echo "📥 Importando dados no Railway..."
            railway run \
                --project="$RAILWAY_PROJECT" \
                --environment="$RAILWAY_ENV" \
                --service="$RAILWAY_SERVICE" \
                bash -c "cd /app && wget -q -O dados.json '$UPLOAD_URL' && python manage.py import_data --input dados.json --skip-existing && rm dados.json"

            echo ""
            echo "✅ IMPORTAÇÃO CONCLUÍDA!"
        else
            echo "Importação cancelada."
        fi

        echo ""
        echo "ℹ️  O arquivo ficará disponível em $UPLOAD_URL por 14 dias"
        ;;

    2)
        echo ""
        echo "🚂 Método 2: Upload temporário"
        echo ""
        echo "Fazendo upload para transfer.sh..."

        UPLOAD_URL=$(curl --upload-file "$OUTPUT_FILE" https://transfer.sh/dados.json 2>/dev/null)

        if [ -z "$UPLOAD_URL" ]; then
            echo "❌ Erro ao fazer upload!"
            exit 1
        fi

        echo "✅ Upload concluído!"
        echo "URL: $UPLOAD_URL"
        echo ""

        # Dry-run
        echo "🔍 Executando DRY-RUN no Railway..."
        railway run \
            --project="$RAILWAY_PROJECT" \
            --environment="$RAILWAY_ENV" \
            --service="$RAILWAY_SERVICE" \
            bash -c "wget -q -O dados.json '$UPLOAD_URL' && \
                     python manage.py import_data --input dados.json --dry-run --skip-existing && \
                     rm dados.json"

        echo ""
        read -p "✅ Dry-run passou! Importar de verdade? (s/N): " CONFIRM

        if [ "$CONFIRM" = "s" ] || [ "$CONFIRM" = "S" ]; then
            echo ""
            echo "📥 Importando dados no Railway..."
            railway run \
                --project="$RAILWAY_PROJECT" \
                --environment="$RAILWAY_ENV" \
                --service="$RAILWAY_SERVICE" \
                bash -c "wget -q -O dados.json '$UPLOAD_URL' && \
                         python manage.py import_data --input dados.json --skip-existing && \
                         rm dados.json"

            echo ""
            echo "✅ IMPORTAÇÃO CONCLUÍDA!"
        else
            echo "Importação cancelada."
        fi

        echo ""
        echo "ℹ️  Nota: O arquivo ficará disponível em $UPLOAD_URL por 14 dias"
        ;;

    3|*)
        echo "Operação cancelada."
        rm "$OUTPUT_FILE"
        exit 0
        ;;
esac

# Limpar arquivo local
echo ""
read -p "Remover arquivo local $OUTPUT_FILE? (S/n): " CLEAN
if [ "$CLEAN" != "n" ] && [ "$CLEAN" != "N" ]; then
    rm "$OUTPUT_FILE"
    echo "✅ Arquivo local removido"
else
    echo "⚠️  Arquivo mantido: $OUTPUT_FILE"
    echo "   Lembre-se de removê-lo depois!"
fi

echo ""
echo "✨ Processo finalizado!"
echo ""
echo "💡 Dica: Execute a validação com:"
echo "   railway run --project=$RAILWAY_PROJECT \\"
echo "               --environment=$RAILWAY_ENV \\"
echo "               --service=$RAILWAY_SERVICE \\"
echo "               python scripts/validate_import.py"
