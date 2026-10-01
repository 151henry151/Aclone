// SPDX-License-Identifier: GPL-3.0-or-later
import { OpenAIBrain } from './openai.ts';
import { AnthropicBrain } from './anthropic.ts';
import { residentsEnvironment } from './config.ts';
/** Credentials stay in provider instances, never in resident state or HTTP status. */
export function configuredResidents(env: NodeJS.ProcessEnv = process.env) {
  const configured = residentsEnvironment(env);
  if (!configured) return undefined;
  return {
    budget: configured.budget,
    residents: configured.residents.map(({ config, apiKey, rates }) => ({
      config,
      rates,
      brain:
        config.provider === 'anthropic'
          ? new AnthropicBrain(apiKey, config.model)
          : new OpenAIBrain(apiKey, config.model),
    })),
  };
}
