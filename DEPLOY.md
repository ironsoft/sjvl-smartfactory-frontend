# sjvl-smartfactory-frontend 배포 가이드

프로덕션 URL: `https://sjvl.sjinnovation.space`  
API 백엔드: `https://backend.sjep.space/api/v1/` (기존과 동일)

## Render Static Site 설정

1. Render Dashboard → **New** → **Static Site**
2. GitHub repo `ironsoft/sjvl-smartfactory-frontend` 연결
3. 설정:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
4. Environment Variables (`.env`와 동일):
   - `REACT_APP_MQTT_BROKER_HOST`
   - `REACT_APP_MQTT_BROKER_PORT`
   - `REACT_APP_MQTT_USERNAME`
   - `REACT_APP_MQTT_PASSWORD`
   - `REACT_APP_MQTT_TOPIC`
5. SPA rewrite: `render.yaml`에 `/* → /index.html` 포함됨

## 커스텀 도메인 (sjvl.sjinnovation.space)

1. Render 서비스 → **Settings** → **Custom Domains** → `sjvl.sjinnovation.space` 추가
2. DNS (sjinnovation.space 관리 패널):
   - Type: `CNAME`
   - Name: `sjvl`
   - Value: Render가 안내하는 `*.onrender.com` 호스트
3. Render가 TLS 인증서 자동 발급 (수 분 소요)

## 백엔드(backend.sjep.space) 필수 설정

동일 백엔드를 사용하므로 아래 도메인을 추가해야 합니다.

```python
# Django settings.py (또는 환경변수)
CORS_ALLOWED_ORIGINS = [
    # ...기존 도메인...
    "https://sjvl.sjinnovation.space",
]

CSRF_TRUSTED_ORIGINS = [
    # ...기존 도메인...
    "https://sjvl.sjinnovation.space",
]
```

### Cross-site 쿠키 (중요)

- 기존 `sjep.space` ↔ `backend.sjep.space`는 same-site → `SameSite=Lax` 동작
- 신규 `sjvl.sjinnovation.space` ↔ `backend.sjep.space`는 **cross-site**
- 로그인/세션/CSRF 쿠키가 전송되려면 백엔드 쿠키 설정 필요:

```python
SESSION_COOKIE_SAMESITE = "None"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE = True
```

## 배포 후 검증 체크리스트

- [ ] `https://sjvl.sjinnovation.space` 접속
- [ ] SPA 라우팅: `/ep-production/...` 등 직접 URL 새로고침
- [ ] 로그인 → `/users/me` 인증 (cross-site 쿠키)
- [ ] IoT QR 공개 페이지: `/public/iot-setup/:id`
- [ ] MQTT 연결 (Hot & Cold Press IoT Monitor)
