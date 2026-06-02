#!/usr/bin/env bash
# Render Static Site 생성 (render CLI 로그인 필요)
set -euo pipefail

if ! render whoami >/dev/null 2>&1; then
  echo "Render CLI 로그인이 필요합니다:"
  echo "  render login"
  exit 1
fi

# .env에서 MQTT 값 로드
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

render services create \
  --confirm \
  --type static_site \
  --name sjvl-smartfactory-frontend \
  --repo https://github.com/ironsoft/sjvl-smartfactory-frontend \
  --branch main \
  --build-command "npm install && npm run build" \
  --publish-directory build \
  --env-var "REACT_APP_MQTT_BROKER_HOST=${REACT_APP_MQTT_BROKER_HOST}" \
  --env-var "REACT_APP_MQTT_BROKER_PORT=${REACT_APP_MQTT_BROKER_PORT}" \
  --env-var "REACT_APP_MQTT_USERNAME=${REACT_APP_MQTT_USERNAME}" \
  --env-var "REACT_APP_MQTT_PASSWORD=${REACT_APP_MQTT_PASSWORD}" \
  --env-var "REACT_APP_MQTT_TOPIC=${REACT_APP_MQTT_TOPIC}" \
  --output json

echo ""
echo "생성 완료. Render Dashboard에서 SPA rewrite(/* -> /index.html) 확인 후"
echo "Custom Domain: sjvl.sjinnovation.space 추가"
echo "DNS CNAME: sjvl -> sjvl-smartfactory-frontend.onrender.com"
