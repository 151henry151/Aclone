// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { gameplayRequestSchema } from './commitments.ts';
import { decisionSchema, type Decision } from './decision.ts';
export const conversationSchema = decisionSchema
  .pick({ notebook: true, speech: true })
  .extend({ gameplayRequest: gameplayRequestSchema.nullable() });
const parameters = z.toJSONSchema(conversationSchema, { target: 'draft-7' });
delete parameters.$schema;
export const conversationTool = {
  type: 'function',
  name: 'converse',
  description:
    'Reply as this resident and update a concise memory notebook. Optionally record an agreed goal or delivery for Jev to plan; never execute gameplay actions.',
  strict: true,
  parameters,
};
export const conversationOutputLimit = 2200;
export function conversationDecision(value: unknown): Decision {
  const c = conversationSchema.parse({ gameplayRequest: null, ...(value as object) });
  return {
    notebook: c.notebook,
    speech: c.speech,
    intent: 'Conversation',
    plan: [{ kind: 'wait', seconds: 60 }],
    repeat: 1,
    reconsiderSeconds: 60,
  };
}

export function conversationRequest(value: unknown) {
  return conversationSchema.parse({ gameplayRequest: null, ...(value as object) }).gameplayRequest;
}
