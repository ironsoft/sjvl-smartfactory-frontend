const SAM_CATEGORY_COLOR_SCHEMES = [
  "purple",
  "blue",
  "teal",
  "cyan",
  "orange",
  "pink",
  "green",
  "red",
  "yellow",
] as const;

export function samCategoryColorScheme(
  catId: number
): (typeof SAM_CATEGORY_COLOR_SCHEMES)[number] {
  const i = Math.abs(catId) % SAM_CATEGORY_COLOR_SCHEMES.length;
  return SAM_CATEGORY_COLOR_SCHEMES[i];
}
