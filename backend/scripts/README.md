# Scripts de Migração de Dados

Este diretório contém scripts auxiliares para migração de dados.

## 📝 Scripts Disponíveis

### 1. `railway_import.sh` - Importação para Railway ⭐
Script específico para Railway (plataforma de hosting).

```bash
cd backend
./scripts/railway_import.sh
```

Funcionalidades:
- Exporta dados automaticamente
- Escolhe método (stdin ou upload temporário)
- Executa dry-run antes de importar
- Limpa arquivos temporários

### 2. `export_only.sh` - Apenas Exportação
Script simples que apenas exporta os dados para JSON.

```bash
cd backend
./scripts/export_only.sh
```

Saída: `dados_dev_YYYYMMDD_HHMMSS.json`

### 3. `migrate_to_production.sh` - Migração SSH Tradicional
Script interativo para servidores SSH tradicionais:
- Exporta dados do dev
- Transfere via SCP para servidor
- Executa dry-run
- Importa dados em produção
- Limpa arquivos temporários

```bash
cd backend
./scripts/migrate_to_production.sh
```

### 4. `validate_import.py` - Validação Pós-Importação
Script Python que valida a integridade dos dados importados.

```bash
cd backend
python scripts/validate_import.py
```

## 🚀 Uso Rápido

### Para Railway 🚂
```bash
cd backend
./scripts/railway_import.sh
```

### Para SSH Tradicional
```bash
cd backend
./scripts/migrate_to_production.sh
```

E siga as instruções interativas.

### Opção 2: Manual
```bash
cd backend
source venv/bin/activate

# Exportar
python manage.py export_data --output dados.json

# Transferir
scp dados.json usuario@servidor:/caminho/

# No servidor (via SSH)
python manage.py import_data --input dados.json --dry-run --skip-existing
python manage.py import_data --input dados.json --skip-existing
```

## 📚 Documentação Completa

Veja [MIGRACAO_DADOS.md](../MIGRACAO_DADOS.md) para documentação completa.
