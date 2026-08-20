#!/usr/bin/env bash
# fake-mise: deterministic mise CLI fixture for MiseUI server tests.
# Env vars: FAKE_MISE_PROJECT (project dir for config paths), FAKE_MISE_FAULT (make env fail),
#           FAKE_MISE_LOG (append each invoked argv line to this file)
set -u
PROJECT="${FAKE_MISE_PROJECT:-.}"
if [ -n "${FAKE_MISE_LOG:-}" ]; then printf '%s
' "$*" >> "${FAKE_MISE_LOG}"; fi
if [ -n "${FAKE_MISE_FAULT:-}" ] && [ "$1" = "env" ]; then
  echo "simulated failure" >&2
  exit 1
fi
case "$1" in
  --version)
    echo "2026.8.1-fake"
    ;;
  env)
    if printf '%s' "$*" | grep -q -- '--json-extended'; then
      if [ "${MISE_ENV:-}" = "staging" ]; then
        NODE_ENV_VAL="staging"
      else
        NODE_ENV_VAL="development"
      fi
      cat <<EOF
{"PATH":{"value":"$PROJECT/shims:/usr/bin:$PROJECT/shims:/usr/bin:/nonexistent-xyz","source":"$PROJECT/mise.toml"},"NODE_ENV":{"value":"$NODE_ENV_VAL","source":"$PROJECT/mise.toml"},"GLOBAL_KEY":{"value":"global-val","source":"$HOME/.config/mise/config.toml"},"TOOL_VAR":{"value":"node-tool-val","tool":"node","source":"$PROJECT/mise.toml"},"INHERITED_VAR":{"value":"from-shell"}}
EOF
    elif printf '%s' "$*" | grep -q -- '--json'; then
      cat <<EOF
{"PATH":"$PROJECT/shims:/usr/bin","NODE_ENV":"$NODE_ENV_VAL"}
EOF
    else
      printf 'PATH=%s/shims:/usr/bin
' "$PROJECT"
    fi
    ;;
  doctor)
    if printf '%s' "$*" | grep -q -- '--json'; then
      cat <<EOF
{"version":"2026.8.1-fake","os":{"name":"Linux","version":"6.x"},"shell":{"name":"bash","path":"/bin/bash"},"settings":{},"env_files":["$PROJECT/.env"],"config_files":["$PROJECT/mise.toml","$HOME/.config/mise/config.toml"],"plugins":[{"name":"node","installed":true}],"tools":[{"name":"node","version":"22.11.0","source":"$PROJECT/mise.toml","requested_version":"22","installed":true}],"warnings":[],"problems":[]}
EOF
    else
      echo "mise doctor"
    fi
    ;;
  config)
    echo '[{"path":"'$PROJECT'/mise.toml"},{"path":"'$HOME'/.config/mise/config.toml"}]'
    ;;
  ls)
    if printf '%s' "$*" | grep -q -- '--json'; then
      if [ "${FAKE_MISE_LS_MODE:-}" = "object" ]; then
        # real mise shape: object keyed by tool name, source is an object
        cat <<EOF
{"node":[{"version":"22.11.0","requested_version":"22","installed":true,"active":true,"source":{"type":"mise.toml","path":"$PROJECT/mise.toml"}}],"go":[{"version":"1.22.1","requested_version":"latest","installed":false,"active":false,"source":{"type":"mise.toml","path":"$PROJECT/mise.toml"}}]}
EOF
      else
        cat <<EOF
[{"name":"node","version":"22.11.0","installed":true,"source":"$PROJECT/mise.toml","requested_version":"22"},{"name":"go","version":"1.22.1","installed":false,"source":"$PROJECT/mise.toml","requested_version":"latest"}]
EOF
      fi
    else
      echo "node 22.11.0"
      echo "go   1.22.1"
    fi
    ;;
  ls-remote)
    echo "22.11.0"
    echo "22.10.0"
    echo "22.9.0"
    echo "20.15.0"
    ;;
  install)
    echo "installing $2 done"
    ;;
  use)
    echo "using $2"
    ;;
  tasks)
    echo '[{"name":"build","description":"build it"},{"name":"test","description":"run tests"}]'
    ;;
  run)
    if [ "$2" = "fail" ]; then echo "boom" >&2; exit 3; fi
    echo "building..."
    echo "done"
    ;;
  settings)
    if printf '%s' "$*" | grep -q -- '-J'; then
      echo '{"env_file":true,"always_keep_download":false,"jobs":4}'
    elif [ "$2" = "set" ] || [ "$2" = "unset" ]; then
      echo "settings ok"
    else
      echo "env_file = true"
    fi
    ;;
  plugins)
    if printf '%s' "$*" | grep -q -- '-J'; then
      echo '[{"name":"node","installed":true},{"name":"go","installed":true}]'
    else
      echo "node"
      echo "go"
    fi
    ;;
  set)
    echo "set ok"
    ;;
  unset)
    echo "unset ok"
    ;;
  *)
    echo "fake-mise: unhandled args: $*" >&2
    exit 2
    ;;
esac
