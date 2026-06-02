/** ModuleCategory.name = English, name_ko / name_vi = optional localized labels. */

export function resolveModuleCategoryLanguage(lang: string | undefined): "en" | "ko" | "vi" {
  const l = (lang || "en").toLowerCase();
  if (l.startsWith("ko")) return "ko";
  if (l.startsWith("vi")) return "vi";
  return "en";
}

export function displayModuleCategoryTriple(
  en: string | null | undefined,
  ko: string | null | undefined,
  vi: string | null | undefined,
  lang?: string
): string {
  const mode = resolveModuleCategoryLanguage(lang);
  const e = (en ?? "").trim();
  const k = (ko ?? "").trim();
  const v = (vi ?? "").trim();
  if (mode === "vi") return v || k || e;
  if (mode === "ko") return k || e || v;
  return e || k || v;
}

export type ModuleCategoryLabeled = {
  name: string;
  name_ko?: string | null;
  name_vi?: string | null;
};

export function displayModuleCategoryName(c: ModuleCategoryLabeled, lang?: string): string {
  const s = displayModuleCategoryTriple(c.name, c.name_ko, c.name_vi, lang);
  return s;
}

/** Split a single stored display path into badge segments (e.g. "A > B"). */
export function splitModuleCategoryDisplayPath(s: string): string[] {
  const t = s.trim();
  if (!t) return [];
  for (const sep of [/\s*>\s*/, /\s*›\s*/, /\s*\/\s*/, /\s*\|\s*/]) {
    const parts = t
      .split(sep)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return [t];
}

/** VL schedule module row — localized major/sub labels for Cat. badges. */
export type VlModuleCategoryI18n = {
  module_category_name?: string | null;
  module_category_name_ko?: string | null;
  module_category_name_vi?: string | null;
  module_sub_category_name?: string | null;
  module_sub_category_name_ko?: string | null;
  module_sub_category_name_vi?: string | null;
};

export function vlModuleCategoryBadgeLabels(mod: VlModuleCategoryI18n, lang?: string): string[] {
  const majorRaw = displayModuleCategoryTriple(
    mod.module_category_name,
    mod.module_category_name_ko,
    mod.module_category_name_vi,
    lang
  );
  const subRaw = displayModuleCategoryTriple(
    mod.module_sub_category_name,
    mod.module_sub_category_name_ko,
    mod.module_sub_category_name_vi,
    lang
  );
  const out: string[] = [];
  for (const p of splitModuleCategoryDisplayPath(majorRaw)) {
    if (p && !out.includes(p)) out.push(p);
  }
  for (const p of splitModuleCategoryDisplayPath(subRaw)) {
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** Single uppercase line letter (e.g. Assembly line A / B). On VL SJ rows, always shown as A. */
const SJ_ASSEMBLY_LINE_LETTER = /^[A-Z]$/;

/**
 * VL SJ 행: Assembly가 있고 A·B·… 라인 글자가 합쳐지면, 라인 배지는 실제 글자와 관계없이 항상 A만 표기 (Assembly, A).
 */
export function collapseSjAssemblyLineLetters(labels: string[]): string[] {
  const hasAssembly = labels.some((l) => l.trim().toLowerCase() === "assembly");
  const hadLineLetter = labels.some((l) => SJ_ASSEMBLY_LINE_LETTER.test(l.trim()));
  if (!hasAssembly || !hadLineLetter) return labels;

  const out = labels.filter((l) => !SJ_ASSEMBLY_LINE_LETTER.test(l.trim()));
  const assemblyIdx = out.findIndex((l) => l.trim().toLowerCase() === "assembly");
  if (assemblyIdx >= 0) out.splice(assemblyIdx + 1, 0, "A");
  else out.push("A");
  return out;
}

/** VL SJ 행: 하위 모듈들의 카테고리 세그먼트를 순서대로 합치되 동일 문자열은 한 번만. */
export function aggregateSjSubCategoryBadgeLabels(modules: VlModuleCategoryI18n[], lang?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const mod of modules) {
    for (const label of vlModuleCategoryBadgeLabels(mod, lang)) {
      if (!seen.has(label)) {
        seen.add(label);
        out.push(label);
      }
    }
  }
  return collapseSjAssemblyLineLetters(out);
}
