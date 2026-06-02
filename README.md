# sjvl-smartfactory-frontend

SJVL Smart Factory 프론트엔드 (CRA). 기존 `airbnb-clone-frontend3` 복제본.

- **프로덕션 URL**: `https://sjvl.sjinnovation.space`
- **API**: `https://backend.sjep.space/api/v1/` (기존 백엔드 공유)
- **배포**: Render Static Site

## 로컬 개발

```bash
npm install
npm start
```

## 배포

자세한 내용은 [DEPLOY.md](./DEPLOY.md) 참고.

## GitHub 저장소 push

```bash
gh auth login   # 최초 1회
bash scripts/push-to-github.sh
```
