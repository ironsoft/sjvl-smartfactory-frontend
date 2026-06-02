# VL Assembly Production – Backend Reference

This directory contains reference serializer/model snippets that describe
**how the real Django backend should compute cumulative `output_qty`** for the
VL Assembly SJ No / Module / Process hierarchy so that the
"VL Realtime Production" list view can display accurate cumulative totals.

---

## Cumulative Output Qty Roll-up Logic

### Process level (`VlAssemblyProcess`)

The process is the leaf node. Its `output_qty` is managed as the **sum of all
`VlAssemblyProductionDailyOutput.qty` rows** that belong to it:

```python
# models.py (simplified)
class VlAssemblyProcess(models.Model):
    output_qty = models.PositiveIntegerField(default=0)
    output_qty_locked = models.BooleanField(default=False)
    total_qty = models.PositiveIntegerField(null=True, blank=True)
    ...

# signal / save hook – called after every daily-output create/update/delete
def sync_process_output_qty(process: VlAssemblyProcess):
    agg = VlAssemblyProductionDailyOutput.objects.filter(
        vl_assembly_process=process
    ).aggregate(total=Sum("qty"))
    total = agg["total"] or 0
    has_records = VlAssemblyProductionDailyOutput.objects.filter(
        vl_assembly_process=process
    ).exists()
    process.output_qty = total
    process.output_qty_locked = has_records   # lock inline edit when records exist
    process.save(update_fields=["output_qty", "output_qty_locked"])
```

### Module level (`VlAssemblyModule`)

The module rolls up from its child processes.  
The *bottleneck* (minimum) process `output_qty` is the module's cumulative output:

```python
def sync_module_output_qty(module: VlAssemblyModule):
    processes = list(module.vl_assembly_processes.filter(is_deleted=False))
    if not processes:
        return
    # Use the bottleneck (min) process output as the module cumulative
    module.output_qty = min(p.output_qty for p in processes)
    module.save(update_fields=["output_qty"])
```

> **Note:** Alternatively, if module-level daily outputs
> (`VlAssemblyModuleProductionDailyOutput`) are tracked separately, use their
> sum instead:
>
> ```python
> agg = VlAssemblyModuleProductionDailyOutput.objects.filter(
>     vl_assembly_module=module
> ).aggregate(total=Sum("qty"))
> module.output_qty = agg["total"] or 0
> module.save(update_fields=["output_qty"])
> ```

### SJ No level (`VlAssemblySjNo`)

The SJ No rolls up from its child modules (bottleneck / min):

```python
def sync_sj_no_output_qty(sj_no: VlAssemblySjNo):
    modules = list(sj_no.vl_assembly_modules.filter(is_deleted=False))
    if not modules:
        return
    sj_no.output_qty = min(m.output_qty for m in modules)
    sj_no.save(update_fields=["output_qty"])
```

---

## Serializer – exposing `output_qty` as read-only cumulative

```python
# serializers.py (relevant fields only)
class VlAssemblySjNoCopySerializer(serializers.ModelSerializer):
    output_qty = serializers.IntegerField(read_only=True)   # always computed
    total_defect_qty = serializers.SerializerMethodField()

    def get_total_defect_qty(self, obj):
        return obj.vl_assembly_inspection_records.aggregate(
            total=Sum("defect_qty")
        )["total"] or 0

    class Meta:
        model = VlAssemblySjNo
        fields = [
            "pk", "sj_no", "output_qty", "total_qty", "status",
            "cycle_time", "target_qty_per_hour", "daily_target_qty_8h",
            "total_defect_qty", "ep_modules",
            # ↓ 추가 필드 (아래 섹션 참조)
            "sj_style_thumbnail", "sj_style_name", "sj_style_code",
        ]
        read_only_fields = ["pk", "output_qty", "total_defect_qty"]
```

---

## SJ No 별 스타일 썸네일 (`sj_style_thumbnail`)

**배경**: VL Assembly 스케줄에는 여러 SJ No가 포함될 수 있으며, 각 SJ No는 서로 다른
스타일(다른 썸네일)에 연결될 수 있습니다.  
기존에는 스케줄 레벨의 `sj_order_info.sj_style.thumbnail` 하나만 반환하여,
스타일이 다른 SJ No 행에 잘못된 이미지가 표시되거나 이미지가 아예 표시되지 않는
문제가 발생합니다.

### 해결 방법: `VlAssemblySjNoSerializer`에 SerializerMethodField 추가

```python
# serializers.py
from rest_framework import serializers

class VlAssemblySjNoSerializer(serializers.ModelSerializer):
    sj_style_thumbnail = serializers.SerializerMethodField()
    sj_style_name      = serializers.SerializerMethodField()
    sj_style_code      = serializers.SerializerMethodField()

    def _source_style(self, obj):
        """원본 SJ No → SJ Order → SJ Style 탐색"""
        try:
            # VlAssemblySjNo.source_sj_no → SjNo.sj_order → SjOrder.sj_style
            source = obj.source_sj_no          # FK or OneToOne to original SjNo
            if source is None:
                return None
            order = getattr(source, "sj_order", None)
            if order is None:
                return None
            return getattr(order, "sj_style", None)
        except Exception:
            return None

    def get_sj_style_thumbnail(self, obj):
        style = self._source_style(obj)
        if style is None:
            return None
        return getattr(style, "thumbnail", None) or None

    def get_sj_style_name(self, obj):
        style = self._source_style(obj)
        return getattr(style, "style_name", None) if style else None

    def get_sj_style_code(self, obj):
        style = self._source_style(obj)
        return getattr(style, "code", None) if style else None

    class Meta:
        model = VlAssemblySjNo
        fields = [
            "pk", "sj_no", "output_qty", "total_qty", "status",
            "cycle_time", "target_qty_per_hour", "daily_target_qty_8h",
            "total_defect_qty", "ep_modules",
            "sj_style_thumbnail", "sj_style_name", "sj_style_code",
        ]
        read_only_fields = ["pk", "output_qty", "total_defect_qty"]
```

> **주의**: 모델 필드 이름(예: `source_sj_no`, `sj_order`, `sj_style`)은 실제
> 백엔드 코드에 맞게 조정하세요.  
> N+1 쿼리 방지를 위해 목록 뷰의 `queryset`에 다음을 추가하세요:
> ```python
> queryset = VlAssemblySjNo.objects.select_related(
>     "source_sj_no__sj_order__sj_style"
> )
> ```

### 프론트엔드 우선순위 (이미 적용됨)

```
thumb = sj.sj_style_thumbnail   // SJ No별 썸네일 (최우선)
     ?? o?.sj_style?.thumbnail  // 스케줄 sj_order_info 썸네일 (fallback)
     ?? null                    // 없음
```

---

## Today Output Qty – frontend implementation

The *"Today Output Qty"* column in the list view does **not** require a
dedicated backend endpoint.  It is computed on the **frontend** by filtering
the existing calendar daily-output maps to today's YMD:

| Row level | Data source |
|-----------|-------------|
| SJ No     | Sum of `dailyQtyByModule[mod.pk][todayYmd]` for all modules under the SJ |
| Module    | `dailyQtyByModule[mod.pk][todayYmd]` |
| Process   | `dailyQtyByProcess[p.pk][todayYmd]` |

These maps are already fetched as part of the 3-month calendar window query
(`vlModuleDailyOutputsCalendar`, `vlProcessDailyOutputsCalendar`).

If a separate "today only" API endpoint is needed for performance reasons,
add `?date_from=<today>&date_to=<today>` filter to the existing
`vl-assembly-production/module-daily-outputs/` and
`vl-assembly-production/daily-outputs/` endpoints.

---

---

## 신규 컬럼 — DB 스키마 추가 (2025-05 확장)

### 배경

빈롱 공장 엑셀 생산스케줄의 누락 컬럼을 시스템에 반영합니다.
모든 신규 필드는 **최초 1차 구현 시 `CharField(max_length=255, blank=True, null=True)` 로 통일**하고,
나중에 단계적으로 적절한 타입으로 마이그레이션합니다.
CMT / FOB 관련 필드는 **반드시 DB에 별도로 저장**해야 합니다 (단순 계산 캐시가 아님).

---

### 1. `EpSjOrder` (공통 오더 모델) — 오더 레벨 신규 필드

```python
class EpSjOrder(models.Model):
    # ... 기존 필드 ...

    # ── 오더 분류 ───────────────────────────────────────────────
    ex_country         = models.CharField(max_length=255, blank=True, null=True, verbose_name="수출 국가")
    air_or_vessel      = models.CharField(max_length=50,  blank=True, null=True, verbose_name="운송 수단(항공/해상)")
    po_date            = models.CharField(max_length=20,  blank=True, null=True, verbose_name="PO 발행일 (YYYY-MM-DD)")
    newness_or_repeat  = models.CharField(max_length=50,  blank=True, null=True, verbose_name="신규/리피트 구분")

    # ── CMT / FOB (별도 DB 저장 필수) ───────────────────────────
    gong_in            = models.CharField(max_length=50,  blank=True, null=True, verbose_name="공임 단가 (CMT 단가)")
    total_cmt          = models.CharField(max_length=50,  blank=True, null=True, verbose_name="공임 총액")
    actual_cmt         = models.CharField(max_length=50,  blank=True, null=True, verbose_name="실제 공임 지급액")
    unit_fob           = models.CharField(max_length=50,  blank=True, null=True, verbose_name="FOB 단가")
    total_fob          = models.CharField(max_length=50,  blank=True, null=True, verbose_name="FOB 총액")
    actual_fob         = models.CharField(max_length=50,  blank=True, null=True, verbose_name="실제 FOB")
```

**마이그레이션 SQL (rename 없음, 순수 추가):**
```sql
ALTER TABLE ep_sj_order ADD COLUMN ex_country          VARCHAR(255);
ALTER TABLE ep_sj_order ADD COLUMN air_or_vessel       VARCHAR(50);
ALTER TABLE ep_sj_order ADD COLUMN po_date             VARCHAR(20);
ALTER TABLE ep_sj_order ADD COLUMN newness_or_repeat   VARCHAR(50);
ALTER TABLE ep_sj_order ADD COLUMN gong_in             VARCHAR(50);
ALTER TABLE ep_sj_order ADD COLUMN total_cmt           VARCHAR(50);
ALTER TABLE ep_sj_order ADD COLUMN actual_cmt          VARCHAR(50);
ALTER TABLE ep_sj_order ADD COLUMN unit_fob            VARCHAR(50);
ALTER TABLE ep_sj_order ADD COLUMN total_fob           VARCHAR(50);
ALTER TABLE ep_sj_order ADD COLUMN actual_fob          VARCHAR(50);
```

---

### 2. `VlAssemblySchedule` (VL 스케줄 모델) — 스케줄 레벨 신규 필드

```python
class VlAssemblySchedule(models.Model):
    # ... 기존 필드 ...

    # ── 출고 ────────────────────────────────────────────────────
    ex_factory_2nd               = models.CharField(max_length=20,  blank=True, null=True, verbose_name="2차 선적 예정일")

    # ── 서브 공정 진행 상황 (텍스트/날짜 자유 형식) ──────────────
    cutting_start_date           = models.CharField(max_length=20,  blank=True, null=True, verbose_name="재단 시작일")
    vien_laser                   = models.CharField(max_length=255, blank=True, null=True, verbose_name="Trim + Laser 진행 상황")
    printing_folding             = models.CharField(max_length=255, blank=True, null=True, verbose_name="Printing/Folding 진행 상황")
    sub_tg                       = models.CharField(max_length=255, blank=True, null=True, verbose_name="SUB TG 진행 상황")
    sub_vl                       = models.CharField(max_length=255, blank=True, null=True, verbose_name="SUB VL 진행 상황")
    pre                          = models.CharField(max_length=255, blank=True, null=True, verbose_name="Pre 공정 진행 상황")
    scom                         = models.CharField(max_length=255, blank=True, null=True, verbose_name="SCOM 진행 상황")
    expected_date_finished       = models.CharField(max_length=255, blank=True, null=True, verbose_name="예상 완료일/진행 상황")

    # ── 관리 ────────────────────────────────────────────────────
    keep                         = models.CharField(max_length=255, blank=True, null=True, verbose_name="KEEP 여부/내용")
    issue_or_not                 = models.CharField(max_length=255, blank=True, null=True, verbose_name="문제 여부/내용")
    final                        = models.CharField(max_length=255, blank=True, null=True, verbose_name="최종 완료 여부/날짜")
    balance_expected_finish_date = models.CharField(max_length=20,  blank=True, null=True, verbose_name="잔량 예상 완료일")
```

**마이그레이션 SQL:**
```sql
ALTER TABLE vl_assembly_schedule ADD COLUMN ex_factory_2nd               VARCHAR(20);
ALTER TABLE vl_assembly_schedule ADD COLUMN cutting_start_date           VARCHAR(20);
ALTER TABLE vl_assembly_schedule ADD COLUMN vien_laser                   VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN printing_folding             VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN sub_tg                       VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN sub_vl                       VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN pre                          VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN scom                         VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN expected_date_finished       VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN keep                         VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN issue_or_not                 VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN final                        VARCHAR(255);
ALTER TABLE vl_assembly_schedule ADD COLUMN balance_expected_finish_date VARCHAR(20);
```

---

### 3. Serializer 노출

#### `EpSjOrderSerializer` (또는 `ISjOrderInfo` 대응 시리얼라이저)

```python
class EpSjOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = EpSjOrder
        fields = [
            # ... 기존 필드 ...
            "ex_country", "air_or_vessel", "po_date", "newness_or_repeat",
            "gong_in", "total_cmt", "actual_cmt",
            "unit_fob", "total_fob", "actual_fob",
        ]
```

#### `VlAssemblyScheduleSerializer`

```python
class VlAssemblyScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = VlAssemblySchedule
        fields = [
            # ... 기존 필드 ...
            "ex_factory_2nd", "cutting_start_date",
            "vien_laser", "printing_folding", "sub_tg", "sub_vl",
            "pre", "scom", "expected_date_finished",
            "keep", "issue_or_not", "final", "balance_expected_finish_date",
        ]
```

---

### 4. 프론트엔드 계산 전용 필드 (DB 저장 불필요)

| 컬럼 키 | 계산식 | 위치 |
|---|---|---|
| `ex_fty_from_today` | `(ex_factory_date - today).days` | SJ 행 Td |
| `daily_target_80` | `daily_target × 0.8` | SJ 행 Td |

---

## Signal wiring (Django)

```python
# signals.py
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

@receiver([post_save, post_delete], sender=VlAssemblyProductionDailyOutput)
def on_process_daily_output_change(sender, instance, **kwargs):
    sync_process_output_qty(instance.vl_assembly_process)
    sync_module_output_qty(instance.vl_assembly_process.vl_assembly_module)
    sync_sj_no_output_qty(
        instance.vl_assembly_process.vl_assembly_module.vl_assembly_sj_no
    )

@receiver([post_save, post_delete], sender=VlAssemblyModuleProductionDailyOutput)
def on_module_daily_output_change(sender, instance, **kwargs):
    sync_module_output_qty(instance.vl_assembly_module)
    sync_sj_no_output_qty(instance.vl_assembly_module.vl_assembly_sj_no)
```
