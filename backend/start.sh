#!/bin/bash
# Script de inicialização para Railway
# Roda migrações e collectstatic antes de iniciar o servidor

set -e  # Para na primeira falha

echo "🔄 Running collectstatic..."
python manage.py collectstatic --noinput

echo "🔄 Running migrations..."
python manage.py migrate --noinput

echo "✅ Setup complete! Starting gunicorn..."
exec gunicorn gestao_financeira.wsgi
