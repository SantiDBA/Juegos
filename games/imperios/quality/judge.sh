#!/usr/bin/env bash
# Imperios · juez ciego en SESIÓN AISLADA (headless)
# =================================================
#
# Corre el juez de la rúbrica en un proceso `cmd -p` NUEVO. Es obligatorio que sea
# una sesión aislada: en este entorno, el canal de visión de un subagente devuelve
# la última imagen leída en la sesión padre, así que un juez subagente puntúa a
# ciegas (ver README §3 y RUBRIC "Cómo el juez lee las imágenes").
#
# USO
#   games/imperios/quality/judge.sh <fase> [modelo]
#   games/imperios/quality/judge.sh ciclo-57-instrumento
#   games/imperios/quality/judge.sh ciclo-57-instrumento claude-sonnet-5   # fijar modelo
#
# Salida: markdown del juez por stdout. Guardar en shots/<fase>/judge.md.
#
# FIJÁ EL MODELO (2.º arg o -m) entre ciclos: distintos modelos puntúan distinto, y
# mezclar modelos rompe la comparación entre ciclos.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PHASE="${1:?uso: judge.sh <fase> [modelo]}"
MODEL="${2:-}"

PROMPT="$(sed "s/__PHASE__/${PHASE}/g" "$HERE/judge-prompt.txt")"

cd "$REPO"
if [ -n "$MODEL" ]; then
  printf '%s' "$PROMPT" | cmd -p --skip-onboarding --trust -m "$MODEL"
else
  printf '%s' "$PROMPT" | cmd -p --skip-onboarding --trust
fi
