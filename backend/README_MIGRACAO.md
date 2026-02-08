# 📚 Documentação Completa - Migração de Dados

Este é o guia principal para migração de dados do ambiente de desenvolvimento para produção.

## 🚀 Start Aqui

**Usando Railway?** 🚂
- [**RAILWAY_QUICK_START.md**](RAILWAY_QUICK_START.md) - Guia rápido para Railway
- [**RAILWAY_MIGRATION_GUIDE.md**](RAILWAY_MIGRATION_GUIDE.md) - Guia completo Railway

**Usando servidor SSH tradicional?**
- [**QUICK_START_MIGRACAO.md**](QUICK_START_MIGRACAO.md) - Guia rápido de 3 passos
- [**MIGRACAO_DADOS.md**](MIGRACAO_DADOS.md) - Documentação completa e detalhada

## 📁 Arquivos Criados

### 📖 Documentação
| Arquivo | Descrição |
|---------|-----------|
| [RAILWAY_QUICK_START.md](RAILWAY_QUICK_START.md) | ⭐ Guia rápido Railway |
| [RAILWAY_MIGRATION_GUIDE.md](RAILWAY_MIGRATION_GUIDE.md) | Guia completo Railway |
| [QUICK_START_MIGRACAO.md](QUICK_START_MIGRACAO.md) | Guia rápido SSH tradicional |
| [MIGRACAO_DADOS.md](MIGRACAO_DADOS.md) | Documentação completa SSH |
| [VALIDACAO_POS_IMPORTACAO.md](VALIDACAO_POS_IMPORTACAO.md) | Guia de validação |
| [scripts/README.md](scripts/README.md) | Documentação dos scripts |

### 🐍 Django Management Commands
| Comando | Arquivo | Descrição |
|---------|---------|-----------|
| `export_data` | [core/management/commands/export_data.py](core/management/commands/export_data.py) | Exporta dados para JSON |
| `import_data` | [core/management/commands/import_data.py](core/management/commands/import_data.py) | Importa dados do JSON |

### 🛠️ Scripts Auxiliares
| Script | Descrição |
|--------|-----------|
| [scripts/railway_import.sh](scripts/railway_import.sh) | ⭐ Script para Railway |
| [scripts/migrate_to_production.sh](scripts/migrate_to_production.sh) | Script para SSH tradicional |
| [scripts/export_only.sh](scripts/export_only.sh) | Script simples de exportação |
| [scripts/validate_import.py](scripts/validate_import.py) | Validação automática |

## 🎯 Fluxo Recomendado

### Para Railway 🚂

```bash
cd backend
./scripts/railway_import.sh
```

### Para SSH Tradicional ✨

```bash
cd backend
./scripts/migrate_to_production.sh
```

O script guiará você por todo o processo!

### Opção 2: Manual (Mais Controle) 🔧

```bash
# 1. Exportar
cd backend
source venv/bin/activate
python manage.py export_data --output dados.json

# 2. Transferir
scp dados.json user@server:/path/

# 3. No servidor (via SSH)
python manage.py import_data --input dados.json --dry-run --skip-existing
python manage.py import_data --input dados.json --skip-existing

# 4. Validar
python scripts/validate_import.py
```

## 📋 Comandos Principais

### Exportação
```bash
# Exportar tudo
python manage.py export_data --output dados.json

# Exportar empresa específica
python manage.py export_data --output dados.json --company-id 1

# Ver ajuda
python manage.py help export_data
```

### Importação
```bash
# Dry-run (teste sem salvar)
python manage.py import_data --input dados.json --dry-run

# Importar (pulando duplicatas)
python manage.py import_data --input dados.json --skip-existing

# Ver ajuda
python manage.py help import_data
```

### Validação
```bash
# Executar script de validação
python scripts/validate_import.py

# Ou validar no Django shell (ver VALIDACAO_POS_IMPORTACAO.md)
python manage.py shell
```

## 🎓 Recursos por Nível

### Iniciante
1. Leia [QUICK_START_MIGRACAO.md](QUICK_START_MIGRACAO.md)
2. Use `./scripts/migrate_to_production.sh`
3. Pronto! ✅

### Intermediário
1. Leia [MIGRACAO_DADOS.md](MIGRACAO_DADOS.md)
2. Use comandos manuais
3. Valide com [VALIDACAO_POS_IMPORTACAO.md](VALIDACAO_POS_IMPORTACAO.md)

### Avançado
1. Customize [import_data.py](core/management/commands/import_data.py)
2. Crie seus próprios scripts
3. Use SQL direto para validações

## ⚠️ Checklist ANTES de Migrar

- [ ] Fez backup do banco de produção
- [ ] Aplicou todas as migrations em produção
- [ ] Testou em ambiente de staging (se disponível)
- [ ] Notificou usuários sobre possível downtime
- [ ] Tem acesso SSH ao servidor
- [ ] Verificou espaço em disco no servidor

## ✅ Checklist DEPOIS de Migrar

- [ ] Executou validação: `python scripts/validate_import.py`
- [ ] Testou login com usuários importados
- [ ] Verificou dashboard e relatórios
- [ ] Confirmou saldos das contas bancárias
- [ ] Testou criação de nova receita/despesa
- [ ] Removeu arquivo JSON do servidor
- [ ] Documentou o processo (data, versão, resultados)

## 🆘 Precisa de Ajuda?

### Erros Comuns

**"File not found"**
- Verifique o caminho do arquivo
- Use caminho absoluto

**"já existe"**
- Use `--skip-existing`

**"Foreign key constraint"**
- Dados estão na ordem errada
- Use o comando de importação padrão (já está na ordem correta)

### Onde Procurar

1. **Entender o processo** → [QUICK_START_MIGRACAO.md](QUICK_START_MIGRACAO.md)
2. **Detalhes técnicos** → [MIGRACAO_DADOS.md](MIGRACAO_DADOS.md)
3. **Validar importação** → [VALIDACAO_POS_IMPORTACAO.md](VALIDACAO_POS_IMPORTACAO.md)
4. **Customizar processo** → Código em `core/management/commands/`

## 🔐 Segurança

- ⚠️ Arquivos JSON contêm dados sensíveis
- ⚠️ Delete após importação
- ⚠️ Não commite no Git
- ⚠️ Use conexões seguras (SSH, SFTP)

## 📊 Modelos Importados

A importação preserva todos os relacionamentos:

1. **Company** → Base de tudo (multi-tenancy)
2. **CustomUser** → Usuários do sistema
3. **Funcionario** → Funcionários/Parceiros/Fornecedores
4. **Cliente** → Clientes (Fixo/Avulso)
5. **FormaCobranca** → Formas de cobrança dos clientes
6. **ContaBancaria** → Contas bancárias
7. **Receita** → Receitas
8. **ReceitaRecorrente** → Receitas recorrentes
9. **Despesa** → Despesas
10. **DespesaRecorrente** → Despesas recorrentes
11. **Payment** → Pagamentos
12. **Custodia** → Custódias (ativos/passivos)
13. **Transfer** → Transferências entre contas
14. **Allocation** → Alocações de pagamentos

## 🎯 Casos de Uso

### Caso 1: Primeira Migração para Produção
```bash
./scripts/migrate_to_production.sh
```

### Caso 2: Migração Incremental (apenas novos dados)
```bash
# Exportar apenas uma empresa
python manage.py export_data --company-id 2 --output empresa2.json

# Importar com --skip-existing
python manage.py import_data --input empresa2.json --skip-existing
```

### Caso 3: Migração Entre Ambientes (Dev → Staging → Prod)
```bash
# Dev → Staging
python manage.py export_data --output dev_data.json
scp dev_data.json staging:/path/
ssh staging "python manage.py import_data --input dev_data.json --dry-run"

# Staging → Prod (após validação)
ssh staging "python manage.py export_data --output staging_data.json"
scp staging:/path/staging_data.json prod:/path/
ssh prod "python manage.py import_data --input staging_data.json --skip-existing"
```

### Caso 4: Backup e Restore
```bash
# Backup
python manage.py export_data --output backup_$(date +%Y%m%d).json

# Restore (se necessário)
python manage.py import_data --input backup_20240115.json --skip-existing
```

## 🏗️ Arquitetura do Sistema

```
backend/
├── core/
│   └── management/
│       └── commands/
│           ├── export_data.py       # Comando de exportação
│           └── import_data.py       # Comando de importação
├── scripts/
│   ├── migrate_to_production.sh    # Script completo
│   ├── export_only.sh              # Script simples
│   ├── validate_import.py          # Validação
│   └── README.md                   # Docs dos scripts
├── QUICK_START_MIGRACAO.md         # Início rápido
├── MIGRACAO_DADOS.md               # Documentação completa
├── VALIDACAO_POS_IMPORTACAO.md     # Guia de validação
└── README_MIGRACAO.md              # Este arquivo (índice)
```

## 📞 Suporte

Se encontrar problemas:

1. Verifique a documentação relevante (links acima)
2. Execute o script de validação
3. Verifique os logs de erro
4. Consulte o código-fonte dos comandos

## 🎓 Aprendizado

Quer entender como funciona?

1. Leia [export_data.py](core/management/commands/export_data.py)
2. Leia [import_data.py](core/management/commands/import_data.py)
3. Veja como os IDs são mapeados
4. Entenda a ordem de importação

---

**Pronto para começar?** → [QUICK_START_MIGRACAO.md](QUICK_START_MIGRACAO.md)
