// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { decisionSchema, type Decision } from './decision.ts';
export const conversationSchema = decisionSchema.pick({ notebook: true, speech: true });
const parameters = z.toJSONSchema(conversationSchema, { target: 'draft-7' });
delete parameters.$schema;
export const conversationTool = {
  type: 'function',
  name: 'converse',
  description: 'Reply as this resident and update a concise memory notebook. No gameplay actions.',
  strict: true,
  parameters,
};
export const conversationOutputLimit = 1200;
export function conversationDecision(value: unknown): Decision {
  const c = conversationSchema.parse(value);
  return {
    ...c,
    intent: 'Conversation',
    plan: [{ kind: 'wait', seconds: 60 }],
    repeat: 1,
    reconsiderSeconds: 60,
  };
}
