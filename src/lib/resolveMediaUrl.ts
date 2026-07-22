import { getApiBaseURL } from "../api";

/**
 * 백엔드가 `/media/...` 등 상대 경로로 주는 URL을 브라우저에서 로드 가능한 절대 URL로 만듦.
 * 이미 `https://` 인 경우 그대로 반환.
 */
export function resolveMediaUrl(raw: string | undefined | null): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) {
    return typeof window !== "undefined" && window.location?.protocol
      ? `${window.location.protocol}${s}`
      : `https:${s}`;
  }
  const base = getApiBaseURL();
  const originMatch = base.match(/^https?:\/\/[^/]+/i);
  const origin = originMatch ? originMatch[0] : "";
  if (!origin) return s;
  return s.startsWith("/") ? `${origin}${s}` : `${origin}/${s}`;
}

/** 직접 파일 URL이면 iframe 대신 <video> 사용 */
export function isDirectVideoFileUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url.trim());
}

const CF_STREAM_BASE = "https://customer-kc2gx0yn68qxte35.cloudflarestream.com";

/**
 * 붙여넣은 Cloudflare Stream 공유 URL 또는 UID에서 비디오 UID를 추출.
 * (customer-*.cloudflarestream.com, videodelivery.net 경로 등)
 */
export function parseCloudflareStreamUid(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  const looksLikeUid = (p: string) => /^[a-z0-9_-]{12,128}$/i.test(p);

  if (looksLikeUid(s) && !s.includes("/") && !s.includes(":")) {
    return s;
  }

  let href = s;
  if (!/^https?:\/\//i.test(href)) {
    if (!href.includes("cloudflarestream") && !href.includes("videodelivery")) {
      return null;
    }
    href = `https://${href}`;
  }

  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    if (!host.includes("cloudflarestream.com") && !host.includes("videodelivery.net")) {
      return null;
    }
    const skip = new Set(["iframe", "watch", "manifest", "thumbnails", "captions", "video"]);
    const parts = url.pathname.split("/").filter(Boolean);
    for (const p of parts) {
      if (skip.has(p.toLowerCase())) continue;
      if (looksLikeUid(p)) return p;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Cloudflare Stream UID 또는 URL을 iframe 재생 URL로 정규화.
 */
export function resolveStreamVideoUrl(raw: string | undefined | null): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return resolveMediaUrl(s);
  return `${CF_STREAM_BASE}/${s}/iframe`;
}
