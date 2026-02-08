# 🚂 Railway - Quick Start

## ⚡ Forma Mais Rápida

```bash
cd backend
./scripts/railway_import.sh
```

Siga as instruções do script! ✨

---

## 📋 Ou Manual (Passo a Passo)

### 1️⃣ Exportar dados

```bash
cd backend
source venv/bin/activate
python manage.py export_data --output dados_dev.json
```

### 2️⃣ Importar no Railway

**⚠️ IMPORTANTE**: `railway run` executa comandos **DENTRO** do Railway, não localmente.

**Método Recomendado: Via upload temporário**

```bash
# Upload
curl --upload-file dados_dev.json https://transfer.sh/dados.json

# Copie a URL retornada, depois importar no Railway:
railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  bash -c "cd /app && \
           wget -q -O dados.json 'COLE_URL_AQUI' && \
           python manage.py import_data --input dados.json --dry-run --skip-existing && \
           python manage.py import_data --input dados.json --skip-existing && \
           rm dados.json"
```

**Por que não via stdin?**
- `railway run` executa no Railway, mas o banco `postgres.railway.internal` não é acessível localmente
- Por isso precisamos fazer upload primeiro

### 3️⃣ Limpar

```bash
rm dados_dev.json
```

---

## 🎯 Criar Atalhos (Opcional mas Útil)

Adicione ao seu `~/.bashrc` ou `~/.zshrc`:

```bash
# Atalho Railway SSH
alias railway-ssh='railway ssh \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a'

# Atalho Railway Run
alias railway-run='railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a'
```

Depois: `source ~/.bashrc` (ou `~/.zshrc`)

Agora você pode usar:
```bash
railway-ssh              # Conecta ao Railway
railway-run python manage.py migrate   # Executa comandos
```

---

## 🔍 Verificar Importação

```bash
railway run \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a \
  python scripts/validate_import.py
```

Ou conecte ao shell:

```bash
railway ssh \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a

# Dentro do container:
python manage.py shell

# No shell Python:
from core.models import *
print(f"Clientes: {Cliente.objects.count()}")
```

---

## 🆘 Problemas?

### Railway CLI não encontrado?

```bash
# Instalar
npm install -g @railway/cli

# Ou no macOS
brew install railway

# Login
railway login
```

### Ver documentação completa

Veja [RAILWAY_MIGRATION_GUIDE.md](RAILWAY_MIGRATION_GUIDE.md)

---

## ⚠️ Lembrete

- **Sempre teste com --dry-run primeiro!**
- **Railway tem backups automáticos** do PostgreSQL
- **Delete o JSON local** após importar (dados sensíveis!)
