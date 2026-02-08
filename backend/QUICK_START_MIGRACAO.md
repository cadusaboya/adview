# 🚀 Quick Start - Migração de Dados

## Forma Mais Rápida (Script Automático)

```bash
cd backend
./scripts/migrate_to_production.sh
```

O script irá guiá-lo por todo o processo interativamente! ✨

## Forma Manual (Passo a Passo)

### 1️⃣ No seu computador (Dev)

```bash
cd backend
source venv/bin/activate

# Exportar dados
python manage.py export_data --output dados_dev.json
```

### 2️⃣ Transferir para servidor

```bash
scp dados_dev.json usuario@servidor:/caminho/backend/
```

### 3️⃣ No servidor (via SSH)

```bash
ssh usuario@servidor
cd /caminho/backend
source venv/bin/activate

# ⚠️ FAZER BACKUP DO BANCO PRIMEIRO!
pg_dump $DATABASE_URL > backup.sql

# Testar importação (não salva nada)
python manage.py import_data --input dados_dev.json --dry-run --skip-existing

# Se passou, importar de verdade
python manage.py import_data --input dados_dev.json --skip-existing

# Limpar arquivo
rm dados_dev.json
```

## ✅ Pronto!

Seus dados foram migrados com sucesso!

## 📚 Quer mais detalhes?

Veja [MIGRACAO_DADOS.md](MIGRACAO_DADOS.md) para documentação completa.

## ⚡ Comandos Úteis

```bash
# Exportar apenas uma empresa específica
python manage.py export_data --output dados.json --company-id 1

# Ver ajuda
python manage.py help export_data
python manage.py help import_data

# Usar script de exportação simples
./scripts/export_only.sh
```

## 🆘 Problemas?

1. **Erro de permissão nos scripts?**
   ```bash
   chmod +x scripts/*.sh
   ```

2. **Erro ao importar?**
   - Use `--dry-run` primeiro para ver o erro
   - Use `--skip-existing` para pular duplicatas

3. **Precisa de ajuda?**
   - Veja a documentação completa em [MIGRACAO_DADOS.md](MIGRACAO_DADOS.md)
