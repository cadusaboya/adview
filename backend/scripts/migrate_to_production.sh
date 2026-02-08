#!/bin/bash

# Script para facilitar a migração de dados Dev → Prod
# Uso: ./scripts/migrate_to_production.sh

set -e  # Para ao primeiro erro

echo "======================================"
echo "  MIGRAÇÃO DE DADOS DEV → PROD"
echo "======================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar se está no diretório backend
if [ ! -f "manage.py" ]; then
    echo -e "${RED}❌ Erro: Execute este script do diretório backend!${NC}"
    echo "cd backend && ./scripts/migrate_to_production.sh"
    exit 1
fi

# Verificar se virtual environment está ativado
if [ -z "$VIRTUAL_ENV" ]; then
    echo -e "${YELLOW}⚠️  Virtual environment não está ativo. Ativando...${NC}"
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    else
        echo -e "${RED}❌ venv não encontrado! Crie com: python -m venv venv${NC}"
        exit 1
    fi
fi

# Arquivo de saída
OUTPUT_FILE="dados_dev_$(date +%Y%m%d_%H%M%S).json"

echo -e "${GREEN}📦 Passo 1: Exportando dados do ambiente de desenvolvimento${NC}"
echo "Arquivo: $OUTPUT_FILE"
echo ""

# Perguntar se quer exportar empresa específica
read -p "Exportar empresa específica? (deixe vazio para exportar todas): " COMPANY_ID

if [ -z "$COMPANY_ID" ]; then
    python manage.py export_data --output "$OUTPUT_FILE"
else
    python manage.py export_data --output "$OUTPUT_FILE" --company-id "$COMPANY_ID"
fi

echo ""
echo -e "${GREEN}✅ Exportação concluída!${NC}"
echo ""

# Mostrar tamanho do arquivo
FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
echo "Tamanho do arquivo: $FILE_SIZE"
echo ""

# Perguntar se quer transferir para servidor
read -p "Deseja transferir para o servidor agora? (s/N): " TRANSFER

if [ "$TRANSFER" = "s" ] || [ "$TRANSFER" = "S" ]; then
    echo ""
    read -p "Usuário SSH: " SSH_USER
    read -p "Servidor: " SSH_HOST
    read -p "Caminho no servidor (ex: /home/ubuntu/app/backend/): " SSH_PATH

    echo ""
    echo -e "${GREEN}📤 Transferindo arquivo...${NC}"
    scp "$OUTPUT_FILE" "$SSH_USER@$SSH_HOST:$SSH_PATH"

    echo ""
    echo -e "${GREEN}✅ Arquivo transferido!${NC}"
    echo ""

    # Perguntar se quer executar importação via SSH
    read -p "Deseja executar a importação no servidor agora? (s/N): " RUN_IMPORT

    if [ "$RUN_IMPORT" = "s" ] || [ "$RUN_IMPORT" = "S" ]; then
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANTE: Certifique-se de ter feito backup do banco de produção!${NC}"
        read -p "Confirma que fez backup? (s/N): " BACKUP_CONFIRM

        if [ "$BACKUP_CONFIRM" != "s" ] && [ "$BACKUP_CONFIRM" != "S" ]; then
            echo -e "${RED}❌ Operação cancelada. Faça backup primeiro!${NC}"
            exit 1
        fi

        echo ""
        echo -e "${GREEN}🔄 Executando DRY-RUN no servidor (teste)...${NC}"
        ssh "$SSH_USER@$SSH_HOST" "cd $SSH_PATH && source venv/bin/activate && python manage.py import_data --input $OUTPUT_FILE --dry-run --skip-existing"

        echo ""
        read -p "Dry-run passou. Continuar com importação real? (s/N): " IMPORT_CONFIRM

        if [ "$IMPORT_CONFIRM" = "s" ] || [ "$IMPORT_CONFIRM" = "S" ]; then
            echo ""
            echo -e "${GREEN}📥 Importando dados no servidor...${NC}"
            ssh "$SSH_USER@$SSH_HOST" "cd $SSH_PATH && source venv/bin/activate && python manage.py import_data --input $OUTPUT_FILE --skip-existing"

            echo ""
            echo -e "${GREEN}✅ IMPORTAÇÃO CONCLUÍDA COM SUCESSO!${NC}"

            # Limpar arquivo do servidor
            read -p "Deseja remover o arquivo JSON do servidor? (S/n): " CLEAN_SERVER
            if [ "$CLEAN_SERVER" != "n" ] && [ "$CLEAN_SERVER" != "N" ]; then
                ssh "$SSH_USER@$SSH_HOST" "rm $SSH_PATH/$OUTPUT_FILE"
                echo -e "${GREEN}✅ Arquivo removido do servidor${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Importação cancelada${NC}"
        fi
    fi
fi

echo ""
echo -e "${GREEN}======================================"
echo "  PROCESSO CONCLUÍDO"
echo "======================================${NC}"
echo ""
echo "Arquivo local: $OUTPUT_FILE"
echo ""
read -p "Deseja remover o arquivo local? (s/N): " CLEAN_LOCAL
if [ "$CLEAN_LOCAL" = "s" ] || [ "$CLEAN_LOCAL" = "S" ]; then
    rm "$OUTPUT_FILE"
    echo -e "${GREEN}✅ Arquivo local removido${NC}"
else
    echo -e "${YELLOW}⚠️  Arquivo mantido: $OUTPUT_FILE${NC}"
    echo "   Lembre-se de removê-lo manualmente quando não precisar mais!"
fi

echo ""
echo -e "${GREEN}✨ Processo finalizado!${NC}"
