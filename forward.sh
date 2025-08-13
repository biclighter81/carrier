#!/usr/bin/env bash
set -euo pipefail

# === Configurable host ports (override with env vars) ===
GRAFANA_HOST_PORT="${GRAFANA_HOST_PORT:-3000}"
PROMETHEUS_HOST_PORT="${PROMETHEUS_HOST_PORT:-9090}"
LOCUST_HOST_PORT="${LOCUST_HOST_PORT:-8089}"

# === Configurable SERVICE ports (target ports inside the Service) ===
# Values can be:
#  - a number (e.g., 80, 9090, 8089)
#  - a port name defined on the Service (e.g., "http", "web", "metrics")
#  - "auto" to use the first port in the Service spec
GRAFANA_SERVICE_PORT="${GRAFANA_SERVICE_PORT:-auto}"
PROMETHEUS_SERVICE_PORT="${PROMETHEUS_SERVICE_PORT:-auto}"
LOCUST_SERVICE_PORT="${LOCUST_SERVICE_PORT:-8089}"  # default per your request

# === Helpers ===
die() { echo "ERROR: $*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"
}

is_integer() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

find_svc() {
  # Args: regex_pattern
  # Echo: "<namespace> <name>" for the FIRST match found across all namespaces
  local pat="$1"
  # NAMESPACE NAME TYPE CLUSTER-IP EXTERNAL-IP PORT(S) AGE
  kubectl get svc -A --no-headers 2>/dev/null \
    | awk -v p="$pat" 'BEGIN{IGNORECASE=1} $2 ~ p {print $1" "$2; exit}'
}

svc_port_first() {
  # Args: namespace name
  kubectl -n "$1" get svc "$2" -o jsonpath='{.spec.ports[0].port}'
}

svc_port_by_name() {
  # Args: namespace name port_name
  local ns="$1" name="$2" pname="$3"
  # Print all ports as "name:port" lines, then pick match
  local line
  while IFS= read -r line; do
    local n="${line%%:*}"
    local p="${line#*:}"
    if [[ "$n" == "$pname" ]]; then
      echo "$p"
      return 0
    fi
  done < <(kubectl -n "$ns" get svc "$name" -o jsonpath='{range .spec.ports[*]}{.name}:{.port}{"\n"}{end}')
  return 1
}

resolve_svc_port() {
  # Args: namespace name override
  # If override == auto -> first port
  # If override is integer -> use it
  # Otherwise treat as named port
  local ns="$1" name="$2" override="$3"
  if [[ "$override" == "auto" ]]; then
    svc_port_first "$ns" "$name"
    return
  fi
  if is_integer "$override"; then
    echo "$override"
    return
  fi
  # named port
  if port=$(svc_port_by_name "$ns" "$name" "$override"); then
    echo "$port"
  else
    die "Port name '$override' not found on service $ns/$name"
  fi
}

forward() {
  # Args: ns name local_port target_port label
  local ns="$1" name="$2" local_port="$3" target_port="$4" label="$5"

  echo "→ Port-forwarding ${label} (svc/${name} in ${ns}) ${local_port}->${target_port} ..."

  # Capture stderr for debugging
  local errfile
  errfile=$(mktemp)

  # Pin to 127.0.0.1 for safety
  kubectl -n "$ns" port-forward "svc/${name}" \
    "${local_port}:${target_port}" \
    >/dev/null 2>"${errfile}" &

  local pid=$!
  echo "${pid}" >> "${PF_PIDS_FILE}"

  # Give kubectl some time to fail if it will
  sleep 0.7

  if ! kill -0 "${pid}" 2>/dev/null; then
    echo "  ! Failed to start port-forward for ${label} (svc/${name})."
    if [[ -s "${errfile}" ]]; then
      echo "    Reason:"
      sed 's/^/      /' "${errfile}"
    else
      echo "    (No error message captured — possible port reservation or firewall issue.)"
    fi
  else
    echo "  ✓ ${label} available at http://127.0.0.1:${local_port}"
  fi

  rm -f "${errfile}"
}

cleanup() {
  echo
  echo "Shutting down port-forwards..."
  if [[ -f "${PF_PIDS_FILE}" ]]; then
    while read -r pid; do
      [[ -n "${pid}" ]] && kill "${pid}" 2>/dev/null || true
    done < "${PF_PIDS_FILE}"
    rm -f "${PF_PIDS_FILE}"
  fi
  exit 0
}

# === Pre-flight ===
need kubectl

PF_PIDS_FILE="$(mktemp)"
trap cleanup INT TERM EXIT

echo "Discovering services across all namespaces..."

# --- Grafana ---
GRAFANA_MATCHES=("grafana")
GRAFANA_SVC=""
for pat in "${GRAFANA_MATCHES[@]}"; do
  if out=$(find_svc "$pat"); then
    GRAFANA_SVC="$out"
    break
  fi
done

# --- Prometheus ---
PROM_MATCHES=("kube-prometheus.*prometheus" "prometheus-operated" "prometheus")
PROM_SVC=""
for pat in "${PROM_MATCHES[@]}"; do
  if out=$(find_svc "$pat"); then
    PROM_SVC="$out"
    break
  fi
done

# --- Locust (optional) ---
LOCUST_MATCHES=("locust-master" "locust-headless" "locust")
LOCUST_SVC=""
for pat in "${LOCUST_MATCHES[@]}"; do
  if out=$(find_svc "$pat"); then
    LOCUST_SVC="$out"
    break
  fi
done

# === Start forwards ===
ANY=0

if [[ -n "${GRAFANA_SVC}" ]]; then
  read -r g_ns g_name <<<"${GRAFANA_SVC}"
  g_port=$(resolve_svc_port "${g_ns}" "${g_name}" "${GRAFANA_SERVICE_PORT}")
  forward "${g_ns}" "${g_name}" "${GRAFANA_HOST_PORT}" "${g_port}" "Grafana"
  ANY=1
else
  echo "(!) Could not find a Grafana service."
fi

if [[ -n "${PROM_SVC}" ]]; then
  read -r p_ns p_name <<<"${PROM_SVC}"
  p_port=$(resolve_svc_port "${p_ns}" "${p_name}" "${PROMETHEUS_SERVICE_PORT}")
  forward "${p_ns}" "${p_name}" "${PROMETHEUS_HOST_PORT}" "${p_port}" "Prometheus"
  ANY=1
else
  echo "(!) Could not find a Prometheus service."
fi

if [[ -n "${LOCUST_SVC}" ]]; then
  read -r l_ns l_name <<<"${LOCUST_SVC}"
  l_port=$(resolve_svc_port "${l_ns}" "${l_name}" "${LOCUST_SERVICE_PORT}")
  forward "${l_ns}" "${l_name}" "${LOCUST_HOST_PORT}" "${l_port}" "Locust"
  ANY=1
else
  echo "(i) No Locust service detected (skipping)."
fi

if [[ "${ANY}" -eq 0 ]]; then
  die "No matching services were found. Are they deployed?"
fi

echo
echo "Port-forwards are running. Press Ctrl+C to stop."
# Keep the script alive while background port-forwards run
while true; do sleep 3600; done
