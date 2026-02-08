# Guia de Migração de Dados (Dev → Produção)

Este guia explica como migrar dados do ambiente de desenvolvimento para produção usando os management commands criados.

## 📋 Pré-requisitos

1. Acesso SSH ao servidor de produção
2. Python virtual environment ativado no servidor
3. Banco de dados de produção configurado e com migrations aplicadas

## 🔄 Processo de Migração

### Passo 1: Exportar Dados do Ambiente de Desenvolvimento

No seu ambiente de **desenvolvimento local**:

```bash
cd backend
source venv/bin/activate

# Exportar todos os dados
python manage.py export_data --output dados_dev.json

# OU exportar apenas uma empresa específica (se houver múltiplas)
python manage.py export_data --output dados_dev.json --company-id 1
```

Isso criará o arquivo `dados_dev.json` com todos os dados exportados.

### Passo 2: Transferir o Arquivo para o Servidor de Produção

Use `scp` para copiar o arquivo:

```bash
# Sintaxe geral:
scp dados_dev.json usuario@servidor:/caminho/para/backend/

# Exemplo:
scp dados_dev.json ubuntu@seu-servidor.com:/home/ubuntu/ERP-Adv/backend/
```

### Passo 3: Importar Dados no Servidor de Produção

Conecte via SSH ao servidor:

```bash
ssh usuario@servidor
```

No servidor de produção:

```bash
cd /caminho/para/backend
source venv/bin/activate

# PASSO 1: Fazer um dry-run primeiro (teste sem salvar)
python manage.py import_data --input dados_dev.json --dry-run

# PASSO 2: Se o dry-run passou, importar de verdade
python manage.py import_data --input dados_dev.json --skip-existing
```

## 🎯 Opções do Comando de Importação

### `--dry-run`
**Recomendado fazer primeiro!**

Simula a importação sem salvar nada no banco. Use para verificar se há erros.

```bash
python manage.py import_data --input dados_dev.json --dry-run
```

### `--skip-existing`
**Recomendado para evitar duplicatas!**

Pula registros que já existem (por nome, CNPJ, CPF, etc) ao invés de falhar.

```bash
python manage.py import_data --input dados_dev.json --skip-existing
```

### Combinando opções

```bash
# Teste completo antes de importar
python manage.py import_data --input dados_dev.json --dry-run --skip-existing

# Importação real
python manage.py import_data --input dados_dev.json --skip-existing
```

## 📊 Ordem de Importação

O comando importa automaticamente nesta ordem (respeitando dependências):

1. ✅ **Companies** (Empresas)
2. ✅ **CustomUser** (Usuários)
3. ✅ **Funcionários** (Funcionários/Parceiros/Fornecedores)
4. ✅ **Clientes**
5. ✅ **Formas de Cobrança**
6. ✅ **Contas Bancárias**
7. ✅ **Receitas**
8. ✅ **Receitas Recorrentes**
9. ✅ **Despesas**
10. ✅ **Despesas Recorrentes**
11. ✅ **Payments** (Pagamentos)
12. ✅ **Custódias**
13. ✅ **Transferências**
14. ✅ **Allocations** (Alocações)

## ⚠️ Tratamento de Duplicatas

O comando detecta duplicatas baseado em:

- **Companies**: CNPJ ou CPF
- **Users**: username
- **Funcionários**: nome + company
- **Clientes**: nome + company
- **Contas Bancárias**: nome + company

Com `--skip-existing`, registros duplicados são pulados e os IDs antigos são mapeados para os IDs existentes.

## 🔍 Mapeamento de IDs

O comando mantém um mapeamento interno de IDs antigos → IDs novos para preservar relacionamentos:

```
ID antigo (dev) → ID novo (prod)
Cliente #5      → Cliente #127
Receita #10     → Receita #450
```

Isso garante que:
- Receitas continuam ligadas aos clientes corretos
- Despesas continuam ligadas aos funcionários corretos
- Allocations continuam ligadas aos payments corretos
- Etc.

## 📝 Logs de Importação

Durante a importação, você verá logs detalhados:

```
📦 Importando Companies...
  ✓ Escritório Silva & Souza (ID: 1 → 5)

👤 Importando Users...
  ✓ admin (ID: 1 → 3)

👔 Importando Funcionários...
  ⊙ João Silva já existe
  ✓ Maria Santos (ID: 2 → 15)

...
```

Símbolos:
- ✓ = Registro importado com sucesso
- ⊙ = Registro já existia (pulado)

## 🚨 Em Caso de Erro

Se a importação falhar:

1. **Verifique o erro** - O comando mostra qual registro causou o problema
2. **Corrija o arquivo JSON** manualmente se necessário
3. **Use --dry-run** novamente para testar
4. **Use --skip-existing** para pular registros problemáticos

### Rollback Automático

Se houver erro durante a importação, **nenhuma alteração é salva** (graças ao `@transaction.atomic`).

## 💡 Dicas

### 1. Backup Antes de Importar

Sempre faça backup do banco de produção antes:

```bash
# PostgreSQL
pg_dump nome_do_banco > backup_antes_importacao.sql

# Se estiver usando Docker/Railway/Heroku, use as ferramentas específicas
```

### 2. Teste Localmente Primeiro

Antes de importar em produção, teste o processo em outro ambiente:

```bash
# Criar banco de teste local
createdb erp_teste

# Configurar .env para usar este banco
# Aplicar migrations
python manage.py migrate

# Testar importação
python manage.py import_data --input dados_dev.json --dry-run
```

### 3. Importações Parciais

Se você quiser importar apenas certos dados, edite o arquivo JSON `dados_dev.json` e remova as seções que não quer importar.

### 4. Senhas de Usuários

As senhas dos usuários são exportadas já hasheadas (seguro). Os usuários poderão fazer login com as mesmas senhas que usavam em dev.

## 🔐 Segurança

⚠️ **IMPORTANTE**:

1. **Não compartilhe o arquivo JSON** - Ele contém dados sensíveis
2. **Delete o arquivo** após a importação:
   ```bash
   rm dados_dev.json
   ```
3. **Considere alterar senhas** de usuários em produção após importação

## 📞 Solução de Problemas

### Erro: "File not found"
- Verifique o caminho do arquivo
- Use caminho absoluto: `/home/ubuntu/ERP-Adv/backend/dados_dev.json`

### Erro: "já existe"
- Use `--skip-existing` para pular duplicatas
- Ou edite o JSON para remover/renomear registros duplicados

### Erro de Foreign Key
- O comando respeita a ordem de dependências
- Verifique se todos os registros relacionados estão no JSON

### Erro de Decimal/Data
- Verifique o formato dos campos no JSON
- Datas devem estar em formato ISO: `"2024-01-15"`
- Decimais devem ser strings: `"1500.00"`

## 📚 Exemplo Completo de Uso

```bash
# ========================================
# NO AMBIENTE DE DESENVOLVIMENTO
# ========================================
cd ~/Desktop/coding/ERP-Adv/backend
source venv/bin/activate

# Exportar dados
python manage.py export_data --output dados_dev.json

# Verificar arquivo criado
ls -lh dados_dev.json

# ========================================
# TRANSFERIR PARA PRODUÇÃO
# ========================================
scp dados_dev.json ubuntu@meu-servidor.com:/home/ubuntu/app/backend/

# ========================================
# NO SERVIDOR DE PRODUÇÃO (via SSH)
# ========================================
ssh ubuntu@meu-servidor.com

cd /home/ubuntu/app/backend
source venv/bin/activate

# Fazer backup do banco primeiro!
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Dry-run (teste)
python manage.py import_data --input dados_dev.json --dry-run --skip-existing

# Se passou, importar de verdade
python manage.py import_data --input dados_dev.json --skip-existing

# Limpar arquivo após importação
rm dados_dev.json

# Verificar no Django admin ou fazer queries de teste
python manage.py shell
```

## ✅ Checklist Pós-Importação

Após importar, verifique:

- [ ] Empresas foram importadas corretamente
- [ ] Usuários conseguem fazer login
- [ ] Clientes estão listados
- [ ] Funcionários estão listados
- [ ] Receitas e despesas aparecem nos relatórios
- [ ] Saldos das contas bancárias estão corretos
- [ ] Relacionamentos estão preservados (Cliente → Receitas, etc)

## 🎓 Comandos Úteis Adicionais

```bash
# Ver quantas empresas foram importadas
python manage.py shell -c "from core.models import Company; print(Company.objects.count())"

# Ver quantos clientes foram importados
python manage.py shell -c "from core.models import Cliente; print(Cliente.objects.count())"

# Listar todas as empresas
python manage.py shell -c "from core.models import Company; [print(c.id, c.name) for c in Company.objects.all()]"
```
