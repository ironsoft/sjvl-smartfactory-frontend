/**
 * 중앙 집중 Query Key Factory
 *
 * ─ 원칙 ────────────────────────────────────────────────────────────────────
 * 1. 모든 queryKey / invalidateQueries 호출은 반드시 이 파일의 함수를 사용합니다.
 * 2. 새로운 쿼리를 추가할 때 이 파일에 먼저 키를 정의합니다.
 * 3. 두 도메인이 같은 루트 키를 쓰면 컴파일 오류 또는 코드 리뷰에서 즉시 발견됩니다.
 *
 * ─ 도메인 접두어 규칙 ────────────────────────────────────────────────────
 *   ep   → EP Real-time Production (EpSchedule*)
 *   vl   → VL Realtime Production  (VlAssembly*)
 *   sj   → SJ Orders / Styles / Media
 *   wk   → Workers
 *   prod → 공통 생산 설정 (ProductionLine, ModuleCategory …)
 *   그 외 → 도메인 이름 그대로 (jigs, machines, kaizen …)
 * ───────────────────────────────────────────────────────────────────────────
 */

// ── EP Real-time Production ──────────────────────────────────────────────────
export const epKeys = {
  all: () => ["epSchedules"] as const,
  list: (params: { search?: string; year?: number; month?: number }) =>
    ["epSchedules", params.search ?? "", params.year, params.month] as const,
  detail: (pk: number) => ["epSchedule", pk] as const,
  detailFull: (pk: number) => ["epScheduleDetail", pk] as const,
  sjNoDetail: (pk: number) => ["epSjNoDetail", pk] as const,
  moduleDetail: (pk: number) => ["epModuleDetail", pk] as const,
  processDetail: (pk: number) => ["epProcessDetail", pk] as const,
  columnPreference: () => ["epColumnPreference"] as const,
  dailyOutputs: () => ["epDailyOutputs"] as const,
  dailyOutputDetail: (pk: number) => ["epDailyOutputDetail", pk] as const,
  dailyOutputFilter: () => ["epSchedules", "daily-output-filter"] as const,
  inspections: () => ["epInspections"] as const,
  inspection: (pk: number) => ["epInspection", pk] as const,
  inspectionFilter: () => ["epSchedules", "inspection-filter"] as const,
  sjOrderFilter: (sjOrderPk: number | undefined) =>
    ["epSchedules", "sjOrder", sjOrderPk] as const,
  dailyOutputReport: (date?: string) => ["ep-daily-output-report", date] as const,
  dailyOutputReportDashboard: () => ["ep-daily-output-report-dashboard"] as const,
  dailyInspectionReport: (date?: string) => ["ep-daily-inspection-report", date] as const,
  dailyInspectionReportDashboard: () => ["ep-daily-inspection-report-dashboard"] as const,
} as const;

// ── VL Realtime Production ───────────────────────────────────────────────────
export const vlKeys = {
  all: () => ["vlSchedules"] as const,
  list: (params: { search?: string; year?: number; month?: number }) =>
    ["vlSchedules", params.search ?? "", params.year, params.month] as const,
  listOverlapWindow: (params: { search?: string; dateFrom?: string; dateTo?: string }) =>
    ["vlSchedules", params.search ?? "", "overlapWin", params.dateFrom, params.dateTo] as const,
  detail: (pk: number) => ["vlScheduleDetail", pk] as const,
  sjNoDetail: (pk: number) => ["vlSjNoDetail", pk] as const,
  moduleDetail: (pk: number) => ["vlModuleDetail", pk] as const,
  processDetail: (pk: number) => ["vlProcessDetail", pk] as const,
  columnPreference: () => ["vlColumnPreference"] as const,
  planHolidays: () => ["vlPlanHolidays"] as const,

  // 일실적 (조립)
  scheduleDailyOutputs: () => ["vlScheduleProductionDailyOutputs"] as const,
  scheduleDailyOutputDetail: (pk: number) => ["vlScheduleProductionDailyOutputDetail", pk] as const,
  scheduleDailyOutputsCalendar: () => ["vlScheduleDailyOutputsCalendar"] as const,
  scheduleDailyOutputFilter: () => ["vlSchedules", "schedule-prod-daily-filter"] as const,

  // 일실적 (모듈)
  moduleDailyOutputs: () => ["vlModuleDailyOutputs"] as const,
  moduleDailyOutputDetail: (pk: number) => ["vlModuleDailyOutputDetail", pk] as const,
  moduleDailyOutputsCalendar: () => ["vlModuleDailyOutputsCalendar"] as const,
  moduleDailyOutputFilter: () => ["vlSchedules", "daily-output-filter"] as const,

  // 일실적 (공정)
  processDailyOutputsCalendar: () => ["vlProcessDailyOutputsCalendar"] as const,

  // 차트
  sjNoScheduleProdDailyOutputChart: (sjNoPk: number | undefined) =>
    ["vlSjNoScheduleProductionDailyOutputChart", sjNoPk] as const,
  sjNoScheduleProdDailyOutputs: (sjNoPk: number | undefined) =>
    ["vlSjNoScheduleProductionDailyOutputs", sjNoPk] as const,

  // 검수
  inspections: () => ["vlInspections"] as const,
  inspection: (pk: number) => ["vlInspection", pk] as const,
  inspectionFilter: () => ["vlSchedules", "inspection-filter"] as const,
  sjOrderFilter: (sjOrderPk: number | undefined) =>
    ["vlSchedules", "sjOrder", sjOrderPk] as const,

  // 리포트
  dailyInspectionReport: (date?: string) => ["vl-daily-inspection-report", date] as const,
  moduleDailyOutputReport: (date?: string) => ["vl-module-daily-output-report", date] as const,
} as const;

// ── 공통 생산 설정 ────────────────────────────────────────────────────────────
export const prodKeys = {
  lines: () => ["productionLines"] as const,
  linesVlOnly: () => ["productionLines", "vlOnly"] as const,
  moduleCategories: (...args: unknown[]) => ["moduleCategories", ...args] as const,
  modules: () => ["modules"] as const,
  modulesBySjNo: (sjNoPk: number | undefined) => ["modulesBySjNo", sjNoPk] as const,
  moduleDetail: (pk: number) => ["moduleDetail", pk] as const,
  moduleSuggestions: (q: string) => ["moduleSuggestions", q] as const,
  processes: () => ["processes"] as const,
  processDetail: (pk: number) => ["processDetail", pk] as const,
  kaizen: {
    posts: () => ["kaizenPosts"] as const,
    post: (pk: number) => ["kaizenPost", pk] as const,
    styleSearch: (q: string) => ["kaizen-style-search", q] as const,
    sjNoSearch: (q: string) => ["kaizen-sjno-search", q] as const,
    moduleSearch: (q: string) => ["kaizen-module-search", q] as const,
    processSearch: (q: string) => ["kaizen-process-search", q] as const,
  },
} as const;

// ── SJ Orders / Styles / Media ───────────────────────────────────────────────
export const sjKeys = {
  orders: () => ["sjorders"] as const,
  orderDetail: (pk: number) => ["sjOrderDetail", pk] as const,
  styles: () => ["sjstyles"] as const,
  styleDetail: (pk: number) => ["sjStyleDetail", pk] as const,
  stylePhotos: (pk: number) => ["sjStylePhotos", pk] as const,
  styleSearch: (q: string) => ["sjStyleSearch", q] as const,
  stylesForMedia: () => ["sjStylesForMedia"] as const,
  nos: () => ["sjnos"] as const,
  noDetail: (pk: number) => ["sjNoDetail", pk] as const,
  noSuggestions: (q: string) => ["sjNoSuggestions", q] as const,
  noSugg: (q: string) => ["sjNoSugg", q] as const,
  media: () => ["sjmedia"] as const,
  mediaList: () => ["sjmedia-list"] as const,
  poTypes: () => ["poTypes"] as const,
  styleSugg: (q: string) => ["styleSugg", q] as const,
  styleSuggestions: (q: string) => ["styleSuggestions", q] as const,
} as const;

// ── Workers ──────────────────────────────────────────────────────────────────
export const wkKeys = {
  workers: () => ["workers"] as const,
  workerDetail: (pk: number | string) => ["workerDetail", pk] as const,
  workerMe: () => ["workerMe"] as const,
  countries: () => ["wCountries"] as const,
  departments: () => ["wDepts"] as const,
  factories: () => ["wFactories"] as const,
  lines: () => ["wLines"] as const,
  positions: () => ["wPositions"] as const,
  ranks: () => ["wRanks"] as const,
  sections: () => ["wSections"] as const,
  teams: () => ["wTeams"] as const,
  users: () => ["users"] as const,
} as const;

// ── 기타 도메인 ──────────────────────────────────────────────────────────────
export const jigKeys = {
  list: () => ["jigs"] as const,
  detail: (pk: number) => ["jigDetail", pk] as const,
  photos: (pk: number) => ["jigPhotos", pk] as const,
  photosPublic: (pk: number) => ["jigPhotosPublic", pk] as const,
  public: (pk: number) => ["jigPublic", pk] as const,
  videos: (pk: number) => ["jigVideos", pk] as const,
} as const;

export const machineKeys = {
  list: () => ["machines"] as const,
  detail: (pk: number) => ["machineDetail", pk] as const,
  suggestions: (q: string) => ["machineSuggestions", q] as const,
} as const;

export const aluminumMoldKeys = {
  list: () => ["aluminumMolds"] as const,
  detail: (pk: number) => ["aluminumMoldDetail", pk] as const,
  photos: (pk: number) => ["aluminumMoldPhotos", pk] as const,
  photosPublic: (pk: number) => ["aluminumMoldPhotosPublic", pk] as const,
  public: (pk: number) => ["aluminumMoldPublic", pk] as const,
  videos: (pk: number) => ["aluminumMoldVideos", pk] as const,
} as const;

export const bindingGuideKeys = {
  list: () => ["bindingGuides"] as const,
  detail: (pk: number) => ["bindingGuideDetail", pk] as const,
  photos: (pk: number) => ["bindingGuidePhotos", pk] as const,
  photosPublic: (pk: number) => ["bindingGuidePhotosPublic", pk] as const,
  public: (pk: number) => ["bindingGuidePublic", pk] as const,
  videos: (pk: number) => ["bindingGuideVideos", pk] as const,
} as const;

// ── Hot & Cold Press IoT ─────────────────────────────────────────────────────
export const hotColdPressKeys = {
  setup: (processPk: number) => ["hcPressIoTSetup", processPk] as const,
  cycles: (processPk: number, date?: string) => ["hcPressIoTCycles", processPk, date ?? ""] as const,
  allCycles: (params: { date: string; machineIotId?: string }) =>
    ["hcPressAllCycles", params.date, params.machineIotId ?? ""] as const,
  cycleDetail: (cycleId: number) => ["hcPressCycleDetail", cycleId] as const,
  bulkStatus: (pks: number[]) => ["hcPressBulkStatus", pks.slice().sort().join(",")] as const,
} as const;

export const miscKeys = {
  amenities: () => ["amenities"] as const,
  bagCategories: () => ["bagCategories"] as const,
  bagTypes: () => ["bagTypes"] as const,
  bodyMaterials: () => ["bodyMaterials"] as const,
  buyerBrands: () => ["buyerBrands"] as const,
  categories: () => ["categories"] as const,
  defectCategories: () => ["defectCategories"] as const,
  blog: () => ["blog"] as const,
  room: (pk: number) => ["room", pk] as const,
  rooms: () => ["rooms"] as const,
  storageLocation: () => ["storage-location"] as const,
  storageLocations: () => ["storage-locations"] as const,
  term: () => ["term"] as const,
  tools: () => ["tools"] as const,
  wishList: () => ["wishList"] as const,
} as const;

// ── Welding Room Press Jobs ───────────────────────────────────────────────────
export const weldingPressJobKeys = {
  active: (machineIotId: string) => ["weldingPressJobActive", machineIotId] as const,
  list: (machineIotId: string) => ["weldingPressJobList", machineIotId] as const,
} as const;
