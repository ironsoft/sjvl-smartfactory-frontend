/**
 * EP 스케줄 등과 동일한 방식의 독립 창.
 * `popup=1` 쿼리로 Root에서 Navbar를 숨김 (`Root.tsx`) — 창 이름에 이 접두어를 넣어두면
 * 창 안에서 다른 링크로 이동해 쿼리가 사라져도 (`window.name`은 내비게이션에 영향받지 않으므로)
 * Navbar가 다시 나타나지 않음. window.name은 창마다 독립적이라 다른 탭에는 영향 없음.
 */
export const APP_POPUP_WINDOW_NAME_PREFIX = "sjinnoAppPopup-";

export function openAppPopupWindow(path: string, opts?: { width?: number; height?: number }) {
  const w = opts?.width ?? 1200;
  const h = opts?.height ?? 900;
  const left = Math.round((window.screen.width - w) / 2);
  const top = Math.round((window.screen.height - h) / 2);
  const sep = path.includes("?") ? "&" : "?";
  window.open(
    `${window.location.origin}${path}${sep}popup=1`,
    `${APP_POPUP_WINDOW_NAME_PREFIX}${Date.now()}`,
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}
