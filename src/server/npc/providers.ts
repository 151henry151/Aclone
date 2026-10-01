// SPDX-License-Identifier: GPL-3.0-or-later
import { JevBrain } from './jev.ts';
import { OpenAIBrain } from './openai.ts';
import { AnthropicBrain } from './anthropic.ts';
import { residentsEnvironment } from './config.ts';
/** Credentials stay in provider instances, never in resident state or HTTP status. */
export function configuredResidents(env: NodeJS.ProcessEnv = process.env) {
  const configured = residentsEnvironment(env);
  if (!configured) return undefined;
  return {
    budget: configured.budget,
    residents: configured.residents.map(({ config, apiKey, rates, dialogue }) => ({
      config,
      rates,
      dialogue: dialogue
        ? { brain: new AnthropicBrain(dialogue.apiKey, dialogue.model), rates: dialogue.rates }
        : undefined,
      brain:
        config.provider === 'jev'
          ? new JevBrain(apiKey, config.model)
          : config.provider === 'anthropic'
            ? new AnthropicBrain(apiKey, config.model)
            : new OpenAIBrain(apiKey, config.model),
    })),
  };
}
