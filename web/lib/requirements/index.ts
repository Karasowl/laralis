import dag from '@/config/requirements-dag.json';

export type RequirementId =
  | 'depreciation'
  | 'fixed_costs'
  | 'cost_per_min'
  | 'break_even'
  | 'supplies'
  | 'service_recipe'
  | 'tariffs';

export type ActionId = 'create_service' | 'create_tariff' | 'create_treatment';

export type GuardContext = {
  workspaceId?: string;
  clinicId: string;
  serviceId?: string;
};

type NodeDef = {
  id: RequirementId;
  level: number;
  dependsOn?: RequirementId[];
  validatorKey: keyof typeof import('./validators');
  autofixKey?: keyof typeof import('./autofix');
};

type ActionDef = {
  id: ActionId;
  minRequirements: RequirementId[];
  snapshotRequired?: boolean;
  allowClinicalWithoutTariff?: boolean;
  defaults?: Record<string, unknown>;
};

const nodes = (dag as any).nodes as NodeDef[];
const actions = (dag as any).actions as ActionDef[];

function topoOrder(reqs: RequirementId[], acc: RequirementId[] = [], seen = new Set<string>()): RequirementId[] {
  for (const r of reqs) {
    if (seen.has(r)) continue;
    seen.add(r);
    const node = nodes.find(n => n.id === r);
    if (!node) continue;
    if (node.dependsOn?.length) topoOrder(node.dependsOn, acc, seen);
    acc.push(node.id);
  }
  // de-dup while preserving order
  return Array.from(new Set(acc));
}

export async function evaluateRequirements(ctx: GuardContext, reqs: RequirementId[]) {
  const ordered = topoOrder(reqs);
  const missing: RequirementId[] = [];
  const validators = await import('./validators');

  for (const id of ordered) {
    const node = nodes.find(n => n.id === id)!;
    const ok = await (validators as any)[node.validatorKey](ctx);
    if (!ok) missing.push(id);
  }
  return { missing };
}

export function getAction(actionId: ActionId): ActionDef {
  const a = actions.find(x => x.id === actionId);
  if (!a) throw new Error(`Unknown action: ${actionId}`);
  return a;
}

export function getNode(id: RequirementId): NodeDef {
  const n = nodes.find(x => x.id === id);
  if (!n) throw new Error(`Unknown node: ${id}`);
  return n;
}

export async function tryAutofix(ctx: GuardContext, missing: RequirementId[]) {
  // Only trigger ONE autofix per ensureReady to avoid loops and UI overload.
  const { openBulkImportSupplies, openQuickRecipeWizard, openTariffDrawer } = await import('./autofix');
  const map: Record<string, (c: GuardContext) => Promise<boolean>> = {
    openBulkImportSupplies,
    openQuickRecipeWizard,
    openTariffDrawer
  } as any;
  // Pick first missing node that has an autofix
  for (const id of missing) {
    const node = nodes.find(n => n.id === id);
    const key = node?.autofixKey;
    if (key && map[key]) {
      await map[key](ctx);
      return [id];
    }
  }
  return [];
}
