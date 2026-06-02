#!/usr/bin/env bash
# 배포 후 sjvl.sjinnovation.space 동작 검증
set -euo pipefail

BASE="${1:-https://sjvl.sjinnovation.space}"
API="https://backend.sjep.space/api/v1"

echo "=== Verifying $BASE ==="

check() {
  local name="$1" url="$2" expect="${3:-200}"
  code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "[OK] $name ($code)"
  else
    echo "[FAIL] $name — expected $expect, got $code"
    return 1
  fi
}

check "Homepage" "$BASE/"
check "SPA route (ep-production)" "$BASE/ep-production"
check "Public IoT setup page" "$BASE/public/iot-setup/1"

echo ""
echo "=== CORS preflight (backend) ==="
cors=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  -H "Origin: $BASE" \
  -H "Access-Control-Request-Method: GET" \
  "$API/users/me/" || echo "000")
if [[ "$cors" == "200" || "$cors" == "204" ]]; then
  echo "[OK] CORS preflight ($cors)"
else
  echo "[WARN] CORS preflight returned $cors — backend CORS 설정 확인 필요"
fi

echo ""
echo "Done. 로그인/세션은 브라우저에서 직접 확인하세요."
