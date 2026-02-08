# 🎯 START HERE - Migração de Dados

## ⚡ Você está usando Railway?

### SIM → Siga este caminho 🚂

```bash
cd backend
./scripts/railway_import.sh
```

**OU** veja: [RAILWAY_QUICK_START.md](RAILWAY_QUICK_START.md)

---

## ⚡ Você está usando servidor SSH tradicional?

### SIM → Siga este caminho 🖥️

```bash
cd backend
./scripts/migrate_to_production.sh
```

**OU** veja: [QUICK_START_MIGRACAO.md](QUICK_START_MIGRACAO.md)

---

## 📚 Documentação Completa

### Para Railway
- 🚀 [RAILWAY_QUICK_START.md](RAILWAY_QUICK_START.md) - Start rápido
- 📖 [RAILWAY_MIGRATION_GUIDE.md](RAILWAY_MIGRATION_GUIDE.md) - Guia completo

### Para SSH Tradicional
- 🚀 [QUICK_START_MIGRACAO.md](QUICK_START_MIGRACAO.md) - Start rápido
- 📖 [MIGRACAO_DADOS.md](MIGRACAO_DADOS.md) - Guia completo

### Geral
- 🔍 [VALIDACAO_POS_IMPORTACAO.md](VALIDACAO_POS_IMPORTACAO.md) - Como validar após importar
- 📋 [README_MIGRACAO.md](README_MIGRACAO.md) - Índice completo de toda documentação

---

## 🛠️ Comandos Django Criados

```bash
# Exportar dados
python manage.py export_data --output dados.json

# Importar dados (teste)
python manage.py import_data --input dados.json --dry-run --skip-existing

# Importar dados (real)
python manage.py import_data --input dados.json --skip-existing

# Ver ajuda
python manage.py help export_data
python manage.py help import_data
```

---

## ✅ Checklist Rápido

Antes de importar:
- [ ] Fez backup do banco de produção (se aplicável)
- [ ] Testou com `--dry-run` primeiro
- [ ] Tem Railway CLI instalado (`npm i -g @railway/cli`)

Após importar:
- [ ] Validou com `python scripts/validate_import.py`
- [ ] Testou login no sistema
- [ ] Verificou que os dados estão corretos
- [ ] Deletou o arquivo JSON local

---

## 🆘 Precisa de Ajuda?

1. **Erro do Railway CLI?** → Instale com `npm install -g @railway/cli`
2. **Quer ver exemplos?** → Veja [RAILWAY_QUICK_START.md](RAILWAY_QUICK_START.md)
3. **Arquivo muito grande?** → Use método de upload temporário (veja o guia)
4. **Dados não aparecem?** → Execute o script de validação

---

## 🎓 Como Funciona?

1. **Exportação**: Django serializa todos os dados para JSON
2. **Mapeamento**: Sistema mapeia IDs antigos → IDs novos automaticamente
3. **Importação**: Dados são importados na ordem correta (respeitando dependências)
4. **Validação**: Script verifica integridade e relacionamentos

---

## 📞 Seus Dados Railway

Você está usando:
- **Project**: `cdc8d057-52c1-4d62-95e1-9d630e03b361`
- **Environment**: `09095526-e4dc-4f0f-9104-1bdef75ce753`
- **Service**: `4a3a2180-96e7-4b31-a91f-ea21db2cab9a`

Conectar:
```bash
railway ssh \
  --project=cdc8d057-52c1-4d62-95e1-9d630e03b361 \
  --environment=09095526-e4dc-4f0f-9104-1bdef75ce753 \
  --service=4a3a2180-96e7-4b31-a91f-ea21db2cab9a
```

---

**PRONTO PARA COMEÇAR?**

Se está usando Railway: `./scripts/railway_import.sh` ✨
