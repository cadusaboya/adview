#!/bin/bash

# Script para migração de dados para Railway
# Uso: ./scripts/migrate_to_railway.sh

set -e

echo "======================================"
echo "  MIGRAÇÃO DE DADOS PARA RAILWAY"
echo "======================================"
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configurações do Railway (você pode editar aqui)
RAILWAY_PROJECT="cdc8d057-52c1-4d62-95e1-9d630e03b361"
RAILWAY_ENVIRONMENT="09095526-e4dc-4f0f-9104-1bdef75ce753"
RAILWAY_SERVICE="4a3a2180-96e7-4b31-a91f-ea21db2cab9a"

# Verificar se railway CLI está instalado
if ! command -v railway &> /dev/null; then
    echo -e "${RED}❌ Railway CLI não está instalado!${NC}"
    echo "Instale com: npm install -g @railway/cli"
    echo "Ou: brew install railway"
    exit 1
fi

# Verificar se está no diretório backend
if [ ! -f "manage.py" ]; then
    echo -e "${RED}❌ Execute este script do diretório backend!${NC}"
    exit 1
fi

# Ativar venv
if [ -z "$VIRTUAL_ENV" ]; then
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    fi
fi

# Nome do arquivo
OUTPUT_FILE="dados_dev_$(date +%Y%m%d_%H%M%S).json"

echo -e "${GREEN}📦 Passo 1: Exportando dados...${NC}"
python manage.py export_data --output "$OUTPUT_FILE"

echo ""
echo -e "${GREEN}✅ Dados exportados: $OUTPUT_FILE${NC}"
FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
echo "Tamanho: $FILE_SIZE"
echo ""

# Converter para base64 (para enviar via stdin)
echo -e "${YELLOW}📝 Passo 2: Preparando dados para transferência...${NC}"
BASE64_FILE="${OUTPUT_FILE}.b64"
base64 "$OUTPUT_FILE" > "$BASE64_FILE"

echo ""
echo -e "${GREEN}✅ Dados preparados${NC}"
echo ""

echo -e "${YELLOW}⚠️  IMPORTANTE: Vamos agora importar no Railway${NC}"
echo "Isso irá:"
echo "  1. Conectar ao Railway"
echo "  2. Transferir o arquivo"
echo "  3. Fazer dry-run (teste)"
echo "  4. Se passar, importar de verdade"
echo ""
read -p "Continuar? (s/N): " CONTINUE

if [ "$CONTINUE" != "s" ] && [ "$CONTINUE" != "S" ]; then
    echo "Operação cancelada."
    rm "$BASE64_FILE"
    exit 0
fi

echo ""
echo -e "${GREEN}🚂 Passo 3: Conectando ao Railway e importando...${NC}"
echo ""

# Criar script temporário que será executado no Railway
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'EOF'
#!/bin/bash
set -e

echo "===== Dentro do Railway ====="
cd /app

# Receber dados via stdin e decodificar
echo "Recebendo dados..."
cat > dados_import.json.b64
base64 -d dados_import.json.b64 > dados_import.json
rm dados_import.json.b64

echo ""
echo "✅ Arquivo recebido!"
ls -lh dados_import.json

echo ""
echo "🔍 Executando DRY-RUN (teste)..."
python manage.py import_data --input dados_import.json --dry-run --skip-existing

echo ""
read -p "Dry-run passou! Importar de verdade? (s/N): " CONFIRM

if [ "$CONFIRM" = "s" ] || [ "$CONFIRM" = "S" ]; then
    echo ""
    echo "📥 Importando dados..."
    python manage.py import_data --input dados_import.json --skip-existing
    echo ""
    echo "✅ IMPORTAÇÃO CONCLUÍDA!"

    # Limpar
    rm dados_import.json
    echo "🧹 Arquivo temporário removido"
else
    echo "Importação cancelada"
    rm dados_import.json
fi
EOF

chmod +x "$TEMP_SCRIPT"

# Executar no Railway
cat "$BASE64_FILE" | railway run \
    --project "$RAILWAY_PROJECT" \
    --environment "$RAILWAY_ENVIRONMENT" \
    --service "$RAILWAY_SERVICE" \
    bash -s < "$TEMP_SCRIPT"

# Limpar arquivos locais
rm "$TEMP_SCRIPT"
rm "$BASE64_FILE"

echo ""
read -p "Deseja remover o arquivo local $OUTPUT_FILE? (S/n): " CLEAN
if [ "$CLEAN" != "n" ] && [ "$CLEAN" != "N" ]; then
    rm "$OUTPUT_FILE"
    echo -e "${GREEN}✅ Arquivo local removido${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo mantido: $OUTPUT_FILE${NC}"
fi

echo ""
echo -e "${GREEN}✨ Processo finalizado!${NC}"
