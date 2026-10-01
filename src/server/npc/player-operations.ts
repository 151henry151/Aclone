// SPDX-License-Identifier: GPL-3.0-or-later
import { stepSchema, type Step } from './decision.ts';
import type { Action } from '../../shared/types.ts';
export function operation(
  type: Extract<Step, { kind: 'operation' }>['operation'],
  fields: Record<string, string | number | boolean> = {},
): Step {
  return stepSchema.parse({
    kind: 'operation',
    operation: type,
    parameters: Object.entries(fields).map(([name, value]) => ({ name, value })),
  });
}
export function operationAction(step: Extract<Step, { kind: 'operation' }>): Action {
  if (new Set(step.parameters.map((p) => p.name)).size !== step.parameters.length)
    throw Error('Duplicate operation parameter');
  return {
    type: step.operation,
    ...Object.fromEntries(step.parameters.map((p) => [p.name, p.value])),
  };
}
