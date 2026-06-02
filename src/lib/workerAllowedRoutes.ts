/**
 * Worker 계정(`user.role === "worker"`)이 접근할 수 있는 경로.
 * QR로 여는 Work Input(일별 실적), 공정 상세(표준작업 영상·QC 등)를 허용합니다.
 * EP / VL Assembly 공장 각각 동일한 범주로 열어 둡니다.
 */
export function isWorkerAllowedPath(pathname: string): boolean {
  if (pathname === "/worker/me") return true;
  if (pathname.startsWith("/ep-production/daily-outputs")) return true;
  if (pathname.startsWith("/ep-production/inspections")) return true;
  if (pathname.startsWith("/ep-production/processes/")) return true;
  if (pathname.startsWith("/vl-assembly-production/schedule-daily-outputs")) return true;
  if (pathname.includes("/vl-assembly-production/sj-nos/") && pathname.includes("/schedule-daily-outputs"))
    return true;
  if (pathname.startsWith("/vl-assembly-production/daily-outputs")) return true;
  if (pathname.startsWith("/vl-assembly-production/module-daily-outputs")) return true;
  if (pathname.startsWith("/vl-assembly-production/inspections")) return true;
  if (pathname.startsWith("/vl-assembly-production/processes/")) return true;
  return false;
}
