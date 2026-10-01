// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { decisionSchema } from './decision.ts';
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
export const outputLimit = 2200;
