/**
 * SAM 공정 API가 선/후행 FK를 숫자 또는 { pk } 로 줄 때 정수 pk로 맞춘다.
 */
export function normalizeSamProcessFk(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "object" && raw !== null && "pk" in raw) {
    const n = Number((raw as { pk: unknown }).pk);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * SAM 공정의 SJ Machine FK — 숫자, { pk }, machine_pk 등에서 정수 pk로 맞춘다.
 */
export function normalizeSamMachinePk(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "object" && raw !== null && "pk" in raw) {
    const n = Number((raw as { pk: unknown }).pk);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * SAM 공정에 연결된 SJ Machine pk — 백엔드는 보통 `sj_machine`(FK)를 쓰고,
 * 응답에 machine_* 가 섞일 수 있어 모두 허용한다.
 */
export function samProcessSjMachinePk(p: {
  sj_machine?: unknown;
  sj_machine_id?: unknown;
  machine?: unknown;
  machine_pk?: unknown;
  machine_id?: unknown;
}): number | null {
  return normalizeSamMachinePk(
    p.sj_machine ??
      p.sj_machine_id ??
      p.machine ??
      p.machine_pk ??
      p.machine_id
  );
}

/**
 * SJ Machine 표시용 문자열 (시리얼라이저가 내려주는 경우).
 */
export function samProcessSjMachineLabel(p: {
  sj_machine_name?: string | null;
  machine_name?: string | null;
}): string | null {
  const s = (p.sj_machine_name ?? p.machine_name ?? "").trim();
  return s || null;
}
