import type { IModuleCategory } from "../api";

/** 대분류 중 slug `preparation` */
export function findPreparationRoot(categories: IModuleCategory[]): IModuleCategory | null {
  return categories.find((c) => c.parent === null && c.slug === "preparation") ?? null;
}

/**
 * Preparation → 일반가방(general) 하위의 EP 리프 분류 PK.
 * 시드에서 slug `ep` 또는 이름 EP 로 구성된 경우를 우선 매칭합니다.
 */
export function findPreparationEpLeafCategoryId(categories: IModuleCategory[]): number | null {
  const prep = findPreparationRoot(categories);
  if (!prep) return null;
  const underPrepGeneral = categories.filter(
    (c) => c.parent === prep.pk && c.applies_to === "general"
  );
  const ep =
    underPrepGeneral.find((c) => c.slug === "ep") ||
    underPrepGeneral.find((c) => /^ep$/i.test(String(c.name).trim())) ||
    underPrepGeneral.find((c) => /EP/i.test(String(c.name_ko)));
  return ep?.pk ?? null;
}
