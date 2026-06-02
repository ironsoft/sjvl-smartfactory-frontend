#!/usr/bin/env bash
# GitHub repo 생성 및 push (gh CLI 로그인 필요)
set -euo pipefail

REPO="ironsoft/sjvl-smartfactory-frontend"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$DIR"

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI 로그인이 필요합니다: gh auth login"
  exit 1
fi

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Creating private repo: $REPO"
  gh repo create "$REPO" --private --source=. --remote=origin --push
else
  echo "Repo exists. Pushing..."
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/${REPO}.git"
  git push -u origin main
fi

echo "Done: https://github.com/${REPO}"
