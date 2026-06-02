# VL Assembly — 계획용 공휴일 (Plan Holidays)

Django 패키지명은 **`plan_holidays`** 입니다 (`plan-holidays` 폴더명은 파이썬 모듈로 쓸 수 없음).

프론트엔드가 `GET` / `POST` / `DELETE`로 호출하는 API를 장고 프로젝트에 붙일 때 이 디렉터리를 통째로 복사해 사용합니다.

## 엔드포인트

- `GET /api/v1/vl-assembly-production/plan-holidays/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`  
  → 해당 기간 안에 있는 공휴일 목록 `{ "results": [{ "pk", "date", "name", … }] }`
- `POST /api/v1/vl-assembly-production/plan-holidays/` JSON `{ "date": "YYYY-MM-DD", "name": "" }`  
- `DELETE /api/v1/vl-assembly-production/plan-holidays/<pk>/`

`date`는 **하루당 한 건** 고유(`unique`)로 두는 것을 권장합니다.

## 장고 앱 설치

1. 이 `plan_holidays` 폴더를 프로젝트의 앱 경로에 복사합니다.
2. `settings.INSTALLED_APPS`에 `'plan_holidays.apps.PlanHolidaysConfig'` 또는 `'plan_holidays'` 추가.
3. `python manage.py migrate`
4. 최상위 `urls.py`에 다음 포함:

```python
path("api/v1/vl-assembly-production/plan-holidays/", include("plan_holidays.urls")),
```

5. 권한: 기존 VL Assembly 생산 메뉴와 동일하게 **로그인 사용자** + 필요 시 **스태프 전용**으로 `permission_classes` 조정.

## Django Admin에서 보기

`/admin/` 접속 → 스태프 권한 사용자로 로그인 → **VL plan holidays** (또는 등록한 `verbose_name_plural`) 섹션에서 `VlPlanHoliday` 행을 확인·수정·삭제할 수 있습니다. 모델 명은 `plan_holidays` 앱의 **`VlPlanHoliday`**, `admin.py`에 등록되어 있어야 목록에 나타납니다.

## 저장이 안 될 때 확인

1. **URL 연결**: 브라우저 개발자 도구 → Network에서 `POST .../plan-holidays/` 가 **404**가 아닌지 확인. 404면 장고 `urls.py` 포함이 없거나 경로가 다른 것입니다.
2. **마이그레이션**: `python manage.py migrate plan_holidays` 로 `plan_holidays_vlplanholiday` 테이블이 만들어졌는지 확인.
3. **목록이 비어 보일 때**: 프론트는 GET 실패 시 조용히 빈 배열을 쓰므로, Network에서 GET 응답이 200인지·에러인지 확인합니다.
4. **CSRF**: 같은 도메인 세션이 아니면 `POST` 가 403 일 수 있습니다.

프론트는 **일요일 + 등록된 공휴일**을 근무 가능일(8h day)에서 빼서 일일 목표 수량을 계산합니다. 조립 기간·목표 수량을 **서버에서도** 동일 규칙으로 저장/검증하려면 해당 계산식에 동일 Set을 반영하세요.
