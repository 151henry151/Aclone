import type { CommunicationRules } from '../../shared/communication-rules';
// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { decisionSchema, decisionSchemaForRules } from './decision.ts';
const parameters = z.toJSONSchema(decisionSchema, {
  target: 'draft-7',
  override: ({ jsonSchema }) => {
    // Zod emits oneOf for discriminated unions. The API supports anyOf instead;
    // our kind/type discriminator values make these branches mutually exclusive.
    if (jsonSchema.oneOf) {
      jsonSchema.anyOf = jsonSchema.oneOf;
      delete jsonSchema.oneOf;
    }
  },
});
delete parameters.$schema;
export const turnTool = {
  type: 'function',
  name: 'plan_turn',
  description: 'Choose your next actions and optional spoken reply as this resident.',
  strict: true,
  parameters,
};
/** Preserve each tool's protocol and bind its shared speech shape to local rules. */
export function toolWithChatRules<
  T extends { parameters: { properties?: Record<string, unknown> } },
>(tool: T, settings: Partial<CommunicationRules>) {
  const schema = decisionSchemaForRules(settings);
  if (schema === decisionSchema) return tool;
  const speech = z.toJSONSchema(schema.shape.speech, { target: 'draft-7' });
  delete speech.$schema;
  return {
    ...tool,
    parameters: { ...tool.parameters, properties: { ...tool.parameters.properties, speech } },
  };
}
export const outputLimit = 2200;
