import { patchSamModule, type ISamModule } from "../api";

/** DRF가 `previous_module` 또는 `previous_module_id` 중 하나만 반영하는 경우 대비 */
function fkModulePrevPatch(v: number | null) {
  return { previous_module: v, previous_module_id: v };
}

function fkModuleNextPatch(v: number | null) {
  return { next_module: v, next_module_id: v };
}

interface IModuleWithChain {
  pk: number;
  previous_module?: number | null;
  next_module?: number | null;
}

/**
 * 스타일 내 모듈 M의 이전(P)·다음(N) 연결을 이웃과 함께 반영한다.
 * 선행의 next, 후행의 previous를 정리한 뒤 P→M, M→N 링크를 맞춘다.
 * M 본문(code 등)은 호출 쪽에서 저장한다.
 */
export async function saveModulePrecedenceEdges<M extends IModuleWithChain>(
  mPk: number,
  newP: number | null,
  newN: number | null,
  modulesByPk: Map<number, M>,
  patchModule: (pk: number, data: Record<string, unknown>) => Promise<unknown>
): Promise<void> {
  const M = modulesByPk.get(mPk);
  if (!M) {
    throw new Error("saveModulePrecedenceEdges: missing module");
  }

  const oldP = M.previous_module ?? null;
  const oldN = M.next_module ?? null;

  if (oldP !== null && oldP !== newP) {
    const op = modulesByPk.get(oldP);
    if (op && op.next_module === mPk) {
      await patchModule(oldP, fkModuleNextPatch(null));
    }
  }
  if (oldN !== null && oldN !== newN) {
    const on = modulesByPk.get(oldN);
    if (on && on.previous_module === mPk) {
      await patchModule(oldN, fkModulePrevPatch(null));
    }
  }

  if (newP !== null) {
    const pMod = modulesByPk.get(newP);
    const oldNextOfP = pMod?.next_module ?? null;
    if (oldNextOfP !== null && oldNextOfP !== mPk) {
      await patchModule(oldNextOfP, fkModulePrevPatch(null));
    }
  }

  if (newN !== null) {
    const nMod = modulesByPk.get(newN);
    const oldPrevOfN = nMod?.previous_module ?? null;
    if (oldPrevOfN !== null && oldPrevOfN !== mPk) {
      await patchModule(oldPrevOfN, fkModuleNextPatch(null));
    }
  }

  if (newP !== null) {
    await patchModule(newP, fkModuleNextPatch(mPk));
  }
  if (newN !== null) {
    await patchModule(newN, fkModulePrevPatch(mPk));
  }
}

export async function saveSamModulePrecedenceEdges(
  mPk: number,
  newP: number | null,
  newN: number | null,
  modulesByPk: Map<number, ISamModule>
): Promise<void> {
  return saveModulePrecedenceEdges(mPk, newP, newN, modulesByPk, patchSamModule);
}
