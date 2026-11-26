#!/usr/bin/env bash
# Tevunia: varredura de segredos do CI com o Betterleaks (ADR-012, #47).
# Fonte: tevunia-platform/templates/segredos/varrer-alteracoes.sh. Cada repositório guarda uma cópia
# idêntica em `.github/segredos/varrer-alteracoes.sh` (conferida por tools/segredos/sincronizar-regras.sh).
#
# Modos (SEGREDOS_MODO):
#   commits (padrão)  pull_request -> commits origin/<base>..HEAD; push -> <before>..HEAD;
#                     outro evento, branch nova ou push forçado -> só o commit do topo.
#   arvore            todos os arquivos do checkout, sem histórico (varredura manual).
# Variáveis que o workflow passa: EVENT_NAME, BASE_REF, BEFORE_SHA, HEAD_SHA.
# SEGREDOS_TIMEOUT (segundos, padrão 600): estourou, o passo falha (não passa em silêncio).
# BETTERLEAKS_BIN: binário já instalado (testes); sem ela, baixa a versão fixada e confere o sha256.
set -euo pipefail

BETTERLEAKS_VERSION='1.10.1'
BETTERLEAKS_SHA256_X64='c174b42d7aa60caf58c0c3e555c0e4bed01fe6b0d99a412bce777b5af4ce913e'
BETTERLEAKS_SHA256_ARM64='62a63199f9f61a6b5e5a6f58f048493db20fbc8c770014f4d903a4d97886e1bf'

instalar() {
  local arq sha dir tarball
  case "$(uname -m)" in
    aarch64 | arm64) arq=arm64 sha=$BETTERLEAKS_SHA256_ARM64 ;;
    *) arq=x64 sha=$BETTERLEAKS_SHA256_X64 ;;
  esac
  # Runner próprio: sem sudo e com jobs simultâneos -> RUNNER_TEMP (limpo a cada job), nunca /tmp fixo.
  dir="${RUNNER_TEMP:-$(mktemp -d)}/betterleaks-${BETTERLEAKS_VERSION}"
  tarball="betterleaks_${BETTERLEAKS_VERSION}_linux_${arq}.tar.gz"
  mkdir -p "$dir"
  curl -sSfL --retry 3 "https://github.com/betterleaks/betterleaks/releases/download/v${BETTERLEAKS_VERSION}/${tarball}" -o "$dir/$tarball"
  echo "${sha}  ${dir}/${tarball}" | sha256sum -c - >&2
  tar -xzf "$dir/$tarball" -C "$dir" betterleaks
  echo "$dir/betterleaks"
}

# `--instalar`: só baixa e confere o binário e imprime o caminho (usado pelos testes da plataforma).
if [ "${1:-}" = --instalar ]; then instalar; exit 0; fi

bin=${BETTERLEAKS_BIN:-}
[ -n "$bin" ] || bin=$(instalar)

modo=${SEGREDOS_MODO:-commits}
evento=${EVENT_NAME:-}
head=${HEAD_SHA:-HEAD}
zero=0000000000000000000000000000000000000000
intervalo=''
if [ "$modo" != arvore ]; then
  if [ "$evento" = pull_request ] && [ -n "${BASE_REF:-}" ]; then
    git rev-parse --verify -q "origin/${BASE_REF}^{commit}" >/dev/null ||
      git fetch --no-tags -q origin "+refs/heads/${BASE_REF}:refs/remotes/origin/${BASE_REF}"
    intervalo="origin/${BASE_REF}..${head}"
  elif [ "$evento" = push ] && [ -n "${BEFORE_SHA:-}" ] && [ "$BEFORE_SHA" != "$zero" ] &&
    git cat-file -e "${BEFORE_SHA}^{commit}" 2>/dev/null; then
    intervalo="${BEFORE_SHA}..${head}"
  else
    # Branch nova, push forçado sem o commit anterior, dispatch, tag ou agendado: só o commit do topo.
    intervalo="-1 ${head}"
  fi
fi

args=(--no-banner --redact --verbose --exit-code 1)
[ -f .betterleaks.toml ] && args+=(--config .betterleaks.toml)
[ -f .betterleaksignore ] && args+=(--gitleaks-ignore-path .betterleaksignore)
if [ "$modo" = arvore ]; then
  echo "varredura de segredos: árvore inteira" >&2
  cmd=("$bin" dir . "${args[@]}")
else
  echo "varredura de segredos: commits ${intervalo}" >&2
  cmd=("$bin" git . --log-opts="$intervalo" "${args[@]}")
fi

set +e
timeout "${SEGREDOS_TIMEOUT:-600}" "${cmd[@]}"
codigo=$?
set -e
if [ "$codigo" -eq 124 ]; then
  echo "::error::varredura de segredos excedeu ${SEGREDOS_TIMEOUT:-600}s; o job falha em vez de passar sem varrer" >&2
  exit 1
fi
if [ "$codigo" -ne 0 ]; then
  echo "::error::segredo encontrado (arquivo e linha acima; valor omitido). Tire o valor do código e troque a chave; falso positivo vai para a allowlist do .betterleaks.toml com '# motivo:'." >&2
  exit "$codigo"
fi
echo "varredura de segredos: nada encontrado" >&2
