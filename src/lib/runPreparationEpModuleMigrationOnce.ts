import type { QueryClient } from "@tanstack/react-query";
import type { UseToastOptions } from "@chakra-ui/react";
import { getModuleCategories, getModules, editModule } from "../api";
import { findPreparationEpLeafCategoryId } from "./preparationEpCategory";

const LS_KEY = "airbnb_clone_prep_ep_module_migrated_v1";

let inFlight: Promise<void> | null = null;

type ToastFn = (options: UseToastOptions) => void;

/**
 * airbnb-clone-frontend3 전용: 기존 생산 모듈을 Preparation · EP로 1회 보정.
 * 브라우저 localStorage 로 중복 실행을 막습니다.
 */
export function runPreparationEpModuleMigrationOnce(
  queryClient: QueryClient,
  toast: ToastFn
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (localStorage.getItem(LS_KEY) === "1") return Promise.resolve();
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const categories = await getModuleCategories();
      const epPk = findPreparationEpLeafCategoryId(categories);
      if (epPk == null) return;

      let page = 1;
      let totalPages = 1;
      do {
        const res = await getModules({ page, search: "" });
        for (const m of res.results) {
          if (m.module_category !== epPk) {
            await editModule(m.pk, { module_category: epPk });
          }
        }
        totalPages = res.total_pages;
        page += 1;
      } while (page <= totalPages);

      localStorage.setItem(LS_KEY, "1");
      await queryClient.invalidateQueries({ queryKey: ["moduleCategories"] });
      await queryClient.invalidateQueries({ queryKey: ["modules"] });
      toast({
        title: "기존 생산 모듈을 Preparation · EP로 맞췄습니다.",
        description: "이미 생성된 EP 스냅샷(EpModule)은 원본과 동기화 시 반영됩니다.",
        status: "success",
        duration: 6000,
        isClosable: true,
        position: "bottom-right",
      });
    } catch {
      toast({
        title: "모듈 분류 일괄 적용에 실패했습니다.",
        status: "error",
        duration: 4000,
        position: "bottom-right",
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
