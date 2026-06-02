/**
 * VL Real-time Production 목록은 링크가 `openWindow`(popup=1)로 열리는 경우가 많아,
 * 상세 창과 목록 창의 React Query 인스턴스가 서로 다릅니다.
 * 상세에서 저장 후 이 키를 갱신하면 다른 창의 `storage` 리스너가 목록 쿼리를 무효화합니다.
 */
export const VL_ASSEMBLY_SCHEDULE_LIST_CACHE_BUST_KEY =
  "vl-assembly-production:schedule-list-bust";

export function broadcastVlAssemblyScheduleListCacheBust(): void {
  try {
    localStorage.setItem(VL_ASSEMBLY_SCHEDULE_LIST_CACHE_BUST_KEY, String(Date.now()));
  } catch {
    /* private mode / quota */
  }
}
