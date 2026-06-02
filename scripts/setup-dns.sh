#!/usr/bin/env bash
# sjvl.sjinnovation.space DNS 설정 안내 및 Render 검증 트리거
set -euo pipefail

CNAME_TARGET="sjvl-smartfactory-frontend.onrender.com"
SERVICE_ID="srv-d8f4j4l53gjs739mc55g"
DOMAIN="sjvl.sjinnovation.space"

echo "=== DNS 설정 (Namecheap / sjinnovation.space) ==="
echo "Type:  CNAME"
echo "Host:  sjvl"
echo "Value: ${CNAME_TARGET}"
echo "TTL:   Automatic (또는 300)"
echo ""
echo "sam.sjinnovation.space 와 동일한 패턴입니다."
echo ""

CURRENT=$(dig +short "$DOMAIN" CNAME | sed 's/\.$//')
if [[ "$CURRENT" == "$CNAME_TARGET" ]]; then
  echo "[OK] DNS CNAME 이미 설정됨: $CURRENT"
else
  echo "[PENDING] 현재 CNAME: ${CURRENT:-없음}"
  echo "Namecheap → Domain List → sjinnovation.space → Advanced DNS 에서 위 CNAME 추가"
  exit 1
fi

if command -v render >/dev/null 2>&1 && render whoami >/dev/null 2>&1; then
  API_KEY=$(python3 -c "import yaml; print(yaml.safe_load(open('$HOME/.render/cli.yaml'))['api']['key'])")
  echo ""
  echo "=== Render 도메인 검증 트리거 ==="
  curl -s -X POST "https://api.render.com/v1/services/${SERVICE_ID}/custom-domains/${DOMAIN}/verify" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" | python3 -m json.tool 2>/dev/null || true
fi
