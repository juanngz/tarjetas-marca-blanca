#!/bin/bash
# Prepara el proyecto al iniciar una sesión de Claude Code en la nube,
# para que pueda correr las pruebas y el lint sin que nadie le explique nada.
# Ver docs: README.md, sección "Levantar el proyecto".
set -euo pipefail

# Solo en sesiones en la nube. En la compu de cada uno se usa npm run setup a mano.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

APP="$CLAUDE_PROJECT_DIR/app"

# Si todavía no existe la app, no hay nada que instalar.
if [ ! -f "$APP/package.json" ]; then
  echo "Todavía no hay app (app/package.json): nada que instalar."
  exit 0
fi

cd "$APP"

# npm run setup instala, copia las claves de prueba y crea la base local con datos inventados.
# Si todavía no existe, alcanza con instalar las dependencias.
if node -e 'process.exit(require("./package.json").scripts?.setup ? 0 : 1)'; then
  npm run setup
else
  npm install
fi
