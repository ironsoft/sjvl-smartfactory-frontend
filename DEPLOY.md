# sjvl-smartfactory-frontend 배포 가이드

프로덕션 URL: `https://sjvl.sjinnovation.space`  
API 백엔드: `https://backend.sjep.space/api/v1/` (기존과 동일)

## 1. GitHub 저장소 생성 및 push

로컬 프로젝트 경로: `/Users/keunsunglee/sjvl-smartfactory-frontend`

```bash
cd /Users/keunsunglee/sjvl-smartfactory-frontend
gh auth login
bash scripts/push-to-github.sh
```

또는 GitHub 웹에서 `ironsoft/sjvl-smartfactory-frontend` private repo 생성 후:

```bash
git remote add origin https://github.com/ironsoft/sjvl-smartfactory-frontend.git
git push -u origin main
```

## 2. Render Static Site 생성

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

## 3. 커스텀 도메인 (sjvl.sjinnovation.space) — Render 설정 완료

Render에 커스텀 도메인 등록 및 SPA rewrite 완료:
- 서비스 URL: `https://sjvl-smartfactory-frontend.onrender.com`
- 커스텀 도메인: `sjvl.sjinnovation.space` (Render 등록됨, DNS 검증 대기)

**Namecheap DNS (수동 1회)** — `sam.sjinnovation.space` 와 동일 패턴:

| Type | Host | Value |
|------|------|-------|
| CNAME | sjvl | `sjvl-smartfactory-frontend.onrender.com` |

설정 후 검증:
```bash
bash scripts/setup-dns.sh
```

## 4. 백엔드(backend.sjep.space) 설정 — 완료됨

`airbnb-clone-backend3`의 `config/settings.py`에 아래 도메인이 추가되어 push됨:

- `CORS_ALLOWED_ORIGINS`: `https://sjvl.sjinnovation.space`
- `CSRF_TRUSTED_ORIGINS`: `https://sjvl.sjinnovation.space`

백엔드 Render 서비스가 자동 재배포되면 적용됩니다.

## 5. Cross-site 쿠키 — 이미 설정됨

백엔드에 아래 설정이 이미 존재 (sam.sjinnovation.space 등과 동일):

```python
SESSION_COOKIE_SAMESITE = "None"
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE = True
```

`sjvl.sjinnovation.space` ↔ `backend.sjep.space` cross-site 로그인이 동작해야 합니다.

## 6. 배포 후 검증

```bash
bash scripts/verify-deployment.sh
```

수동 체크리스트:

- [ ] `https://sjvl.sjinnovation.space` 접속
- [ ] SPA 라우팅: `/ep-production/...` 등 직접 URL 새로고침
- [ ] 로그인 → `/users/me` 인증 (cross-site 쿠키)
- [ ] IoT QR 공개 페이지: `/public/iot-setup/:id`
- [ ] MQTT 연결 (Hot & Cold Press IoT Monitor)
