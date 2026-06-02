import { QueryClient } from "@tanstack/react-query";
import { epKeys } from "./queryKeys";
import { broadcastVlAssemblyScheduleListCacheBust } from "./vlAssemblyProductionScheduleListCacheBust";

/**
 * EP Real-time Production 목록·스케줄·공정 상세의 output_qty 반영을 위해
 * 관련 쿼리를 stale 처리하고 **현재 마운트된(active)** 쿼리만 다시 가져옵니다.
 * (`refetchQueries` + type: "all" 처럼 비활성 쿼리까지 전부 네트워크 호출하지 않음)
 *
 * VL 캐시 무효화는 broadcastVlAssemblyScheduleListCacheBust() 를 통해
 * localStorage 이벤트로 처리됩니다 (팝업 창 분리 구조 때문).
 */
export function refreshEpProductionCaches(
  queryClient: QueryClient,
  opts: { ep_schedule_pk: number; ep_process: number }
): Promise<void> {
  broadcastVlAssemblyScheduleListCacheBust();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: epKeys.all() }),
    queryClient.invalidateQueries({ queryKey: epKeys.detail(opts.ep_schedule_pk) }),
    queryClient.invalidateQueries({ queryKey: epKeys.detailFull(opts.ep_schedule_pk) }),
    queryClient.invalidateQueries({ queryKey: epKeys.processDetail(opts.ep_process) }),
  ]).then(() => undefined);
}
