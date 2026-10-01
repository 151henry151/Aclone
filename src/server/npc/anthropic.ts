// SPDX-License-Identifier: GPL-3.0-or-later
import { decisionSchema, type Brain, type BrainRequest, type BrainResult } from './decision.ts';
import { conversationTool, conversationOutputLimit, conversationDecision } from './conversation.ts';
import { outputLimit, turnTool } from './turn-tool.ts';

// Explain numeric/string limits as well as specifying them in the schema.
// The full action union exceeds Claude strict grammar limits, so the original
// Zod schema remains authoritative and invalid turns never execute.
function claudeSchema(value: unknown): any {
  if (Array.isArray(value)) return value.map(claudeSchema);
  if (!value || typeof value !== 'object') return value;
  const schema: Record<string, any> = {};
  const bounds: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (['minimum', 'maximum', 'minLength', 'maxLength', 'maxItems'].includes(key))
      bounds.push(`${key}: ${entry}`);
    schema[key] = claudeSchema(entry);
  }
  if (bounds.length)
    schema.description = [schema.description, `Required limits: ${bounds.join(', ')}.`]
      .filter(Boolean)
      .join(' ');
  return schema;
}
export const claudeTurnTool = {
  name: turnTool.name,
  description: turnTool.description,
  input_schema: claudeSchema(turnTool.parameters),
};

/** Claude uses the same bounded plan and local game rules as other providers. */
export class AnthropicBrain implements Brain {
  constructor(
    private apiKey: string,
    private model: string,
    private transport: typeof fetch = fetch,
    private mode: 'plan' | 'conversation' = 'plan',
  ) {}
  async decide(request: BrainRequest, signal: AbortSignal): Promise<BrainResult> {
    const tool =
      this.mode === 'conversation'
        ? {
            name: conversationTool.name,
            description: conversationTool.description,
            input_schema: claudeSchema(conversationTool.parameters),
          }
        : claudeTurnTool;
    const response = await this.transport('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.mode === 'conversation' ? conversationOutputLimit : outputLimit,
        // Cache only the stable instructions/tools, never a growing chat history.
        system: [
          {
            type: 'text',
            text: request.instructions,
            cache_control: { type: 'ephemeral', ttl: '5m' },
          },
        ],
        messages: [{ role: 'user', content: JSON.stringify(request.observation) }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name, disable_parallel_tool_use: true },
      }),
    });
    // Provider bodies can echo private data; retain only the HTTP status.
    if (!response.ok) throw Error(`AI provider HTTP ${response.status}`);
    const body = (await response.json()) as {
      stop_reason?: string;
      content?: { type: string; name?: string; input?: unknown }[];
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
    if (body.stop_reason !== 'tool_use') throw Error('AI response incomplete');
    const calls = body.content?.filter((c) => c.type === 'tool_use') ?? [];
    if (
      calls.length !== 1 ||
      calls[0].name !== tool.name ||
      !calls[0].input ||
      JSON.stringify(calls[0].input).length > 20000
    )
      throw Error('AI response did not contain one valid turn');
    let value = calls[0].input;
    if (this.mode === 'conversation') {
      try {
        value = conversationDecision(value);
      } catch {
        throw Error('AI response did not contain one valid turn');
      }
    }
    const parsed = decisionSchema.safeParse(value);
    if (!parsed.success) throw Error('AI response did not contain one valid turn');
    const inputTokens = body.usage?.input_tokens;
    const outputTokens = body.usage?.output_tokens;
    const cacheWriteTokens = body.usage?.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = body.usage?.cache_read_input_tokens ?? 0;
    if (
      ![inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens].every(
        (n) => Number.isSafeInteger(n) && n! >= 0,
      )
    )
      throw Error('AI response missing token accounting');
    return {
      decision: parsed.data,
      inputTokens: inputTokens!,
      outputTokens: outputTokens!,
      cacheWriteTokens,
      cacheReadTokens,
    };
  }
}
