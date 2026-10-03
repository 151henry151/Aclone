// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { preferencesSchema } from './agenda.ts';
import { gameplayRequestSchema, employmentRequestSchema } from './commitments.ts';
import { decisionSchema, type Decision } from './decision.ts';
export const conversationSchema = decisionSchema.pick({ notebook: true, speech: true }).extend({
  notebook: decisionSchema.shape.notebook.describe(
    'Update only the current speaker and public/private channel summary. Preserve useful earlier facts in that scoped notebook; never invent memories or summarize other private conversations.',
  ),
  gameplayRequest: gameplayRequestSchema.nullable(),
  preferences: preferencesSchema.nullable().optional(),
});
// Providers require all strict-tool properties, while old saved requests remain readable.
const toolSchema = conversationSchema.extend({
  preferences: preferencesSchema.nullable(),
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
    'Reply as this resident and update only this speaker/channel memory summary. Optionally record considered personal activity preferences. When agreeing to a delivery or to train and take a job, include the concrete gameplayRequest. Speech alone cannot queue work; never promise an unqueued action.',
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
  if (
    /\bI(?:['’]ll| will)\s+(?:go ahead and (?:explain|describe|answer)|work out (?:the )?(?:numbers|cost|price|math))\b/i.test(
      text,
    ) &&
    !/\b(?:drive|deliver|study|school|mill|bring)\b/i.test(text)
  )
    return false;
  return /\bI(?:['’]ll| will|['’]m going to| am going to)\s+(?:head|drive|travel|go|learn|study|take (?:the|a|your) job|bring|deliver|load|sell|buy|gather|harvest|build|work|start (?:work|studying|training))\b/i.test(
    text,
  );
}

export function conversationPreferences(value: unknown) {
  return conversationSchema.parse({ gameplayRequest: null, ...(value as object) }).preferences;
}
