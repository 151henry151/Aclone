// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { gameplayRequestSchema, employmentRequestSchema } from './commitments.ts';
import { decisionSchema, type Decision } from './decision.ts';
export const conversationSchema = decisionSchema
  .pick({ notebook: true, speech: true })
  .extend({ gameplayRequest: gameplayRequestSchema.nullable() });
// Providers require all strict-tool properties, while old saved requests remain readable.
const toolSchema = conversationSchema.extend({
  gameplayRequest: gameplayRequestSchema
    .extend({ employment: employmentRequestSchema.nullable() })
    .nullable(),
});
const parameters = z.toJSONSchema(toolSchema, { target: 'draft-7' });
delete parameters.$schema;
export const conversationTool = {
  type: 'function',
  name: 'converse',
  description:
    'Reply as this resident and update a concise memory notebook. When agreeing to a delivery or to train and take a job, include the concrete gameplayRequest. Speech alone cannot queue work; never promise an unqueued action.',
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

/** Catch common first-person action promises when the model omitted the request.
 * This is a truthfulness backstop, never a natural-language action executor. */
export function unqueuedPromise(text: string) {
  return /\bI(?:['’]ll| will|['’]m going to| am going to)\s+(?:head|drive|travel|go|learn|study|take (?:the|a|your) job|bring|deliver|load|sell|buy|gather|harvest|build|work|start (?:work|studying|training))\b/i.test(
    text,
  );
}
