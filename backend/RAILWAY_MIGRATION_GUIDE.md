# 🚂 Guia de Migração para Railway

Como você está usando Railway (não um servidor SSH tradicional), o processo é um pouco diferente.

## 📝 Seus Dados de Acesso Railway

```bash
railway ssh \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a
```

## 🎯 Processo Recomendado para Railway

### Método 1: Via Railway CLI (Mais Simples) ⭐

```bash
# ========================================
# PASSO 1: Exportar dados localmente
# ========================================
cd backend
source venv/bin/activate
python manage.py export_data --output dados_dev.json

# ========================================
# PASSO 2: Importar diretamente via Railway CLI
# ========================================

# Opção A: Executar comando direto (sem precisar de SSH interativo)
cat dados_dev.json | railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  python manage.py import_data --input /dev/stdin --dry-run --skip-existing

# Se passou, importar de verdade:
cat dados_dev.json | railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  python manage.py import_data --input /dev/stdin --skip-existing

# ========================================
# PASSO 3: Limpar arquivo local
# ========================================
rm dados_dev.json
```

### Método 2: Via Upload Temporário (Para arquivos grandes)

Se o arquivo for muito grande, use um serviço temporário:

```bash
# 1. Exportar
python manage.py export_data --output dados_dev.json

# 2. Fazer upload para serviço temporário (escolha um):

# Opção A: transfer.sh (gratuito, 14 dias)
curl --upload-file dados_dev.json https://transfer.sh/dados_dev.json
# Copia a URL retornada

# Opção B: 0x0.st (gratuito)
curl -F'file=@dados_dev.json' https://0x0.st
# Copia a URL retornada

# 3. No Railway, baixar e importar:
railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  bash -c "wget -O dados.json 'URL_DO_UPLOAD' && \
           python manage.py import_data --input dados.json --dry-run --skip-existing && \
           python manage.py import_data --input dados.json --skip-existing && \
           rm dados.json"
```

### Método 3: Via Railway Shell Interativo

```bash
# 1. Exportar localmente
cd backend
source venv/bin/activate
python manage.py export_data --output dados_dev.json

# 2. Copiar o conteúdo do arquivo
cat dados_dev.json | pbcopy  # macOS
# ou
cat dados_dev.json | xclip -selection clipboard  # Linux
# ou abra o arquivo e copie manualmente

# 3. Conectar ao Railway
railway ssh \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a

# 4. Dentro do Railway, criar o arquivo:
cat > dados_import.json << 'EOF'
# Cole aqui o conteúdo do JSON (Ctrl+V / Cmd+V)
# Depois pressione Enter e digite EOF
EOF

# 5. Importar
python manage.py import_data --input dados_import.json --dry-run --skip-existing
python manage.py import_data --input dados_import.json --skip-existing

# 6. Limpar
rm dados_import.json
```

## 🚀 Script Automatizado para Railway

Criei um script que facilita tudo:

```bash
cd backend
./scripts/railway_import.sh
```

Ou use os atalhos criados abaixo.

## 📦 Atalhos Úteis

Crie aliases no seu `.bashrc` ou `.zshrc`:

```bash
# Adicione ao ~/.bashrc ou ~/.zshrc

# Atalho para conectar ao Railway
alias railway-ssh='railway ssh \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a'

# Atalho para executar comandos no Railway
alias railway-run='railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a'
```

Depois, recarregue:
```bash
source ~/.bashrc  # ou source ~/.zshrc
```

Agora você pode usar:
```bash
railway-ssh              # Conecta ao Railway
railway-run python manage.py migrate   # Executa comando
```

## 🎯 Exemplo Completo Passo a Passo

```bash
# Passo 1: Exportar dados localmente
cd ~/Desktop/coding/ERP-Adv/backend
source venv/bin/activate
python manage.py export_data --output dados_dev.json

# Passo 2: Ver tamanho do arquivo
ls -lh dados_dev.json

# Passo 3a: Se arquivo < 10MB, usar método direto
cat dados_dev.json | railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  python manage.py import_data --input /dev/stdin --skip-existing

# Passo 3b: Se arquivo > 10MB, fazer upload temporário
curl --upload-file dados_dev.json https://transfer.sh/dados_dev.json
# Copie a URL retornada, depois:

railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  bash -c "wget -O dados.json 'URL_AQUI' && \
           python manage.py import_data --input dados.json --skip-existing && \
           rm dados.json"

# Passo 4: Validar (opcional)
railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  python scripts/validate_import.py

# Passo 5: Limpar arquivo local
rm dados_dev.json
```

## ⚠️ Notas Importantes para Railway

1. **Railway não tem persistência de arquivos** no container - arquivos temporários são perdidos quando o container reinicia
2. **Use variáveis de ambiente** para configurações sensíveis (já configuradas via Railway dashboard)
3. **Banco de dados PostgreSQL** do Railway é persistente - os dados importados ficam salvos lá
4. **Não precisa fazer backup manual** - Railway tem backups automáticos do PostgreSQL

## 🔍 Verificar Dados no Railway

```bash
# Conectar ao banco diretamente
railway run --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  python manage.py dbshell

# Ou executar o Django shell
railway run --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  python manage.py shell

# Dentro do shell Python:
from core.models import *
print(f"Companies: {Company.objects.count()}")
print(f"Clientes: {Cliente.objects.count()}")
print(f"Receitas: {Receita.objects.count()}")
```

## 📊 Backup do Railway antes de Importar

Railway faz backups automáticos, mas você pode fazer um manual:

```bash
# Fazer backup do PostgreSQL
railway run --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  bash -c 'pg_dump $DATABASE_URL > /tmp/backup.sql && cat /tmp/backup.sql' \
  > backup_railway_$(date +%Y%m%d).sql
```

## 🆘 Troubleshooting

### Erro: "railway: command not found"

Instale o Railway CLI:
```bash
# npm
npm install -g @railway/cli

# Homebrew (macOS)
brew install railway

# Ou baixe direto
curl -fsSL https://railway.app/install.sh | sh
```

### Erro: "Not logged in"

Faça login no Railway:
```bash
railway login
```

### Arquivo muito grande para stdin

Use o método de upload temporário (Método 2 acima).

### Timeout no railway run

Para arquivos grandes, a importação pode demorar. Use:
```bash
railway run --timeout=600 ...  # 10 minutos
```

## 🎓 Entendendo as Flags

- `--project`: ID do seu projeto Railway
- `--environment`: ID do ambiente (production, staging, etc)
- `--service`: ID do serviço específico (backend)
- `--input /dev/stdin`: Lê dados da entrada padrão (stdin)

## 📚 Links Úteis

- [Railway CLI Docs](https://docs.railway.app/develop/cli)
- [Railway SSH](https://docs.railway.app/develop/cli#ssh)
- [Railway Run](https://docs.railway.app/develop/cli#run)
