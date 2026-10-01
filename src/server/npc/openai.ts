// SPDX-License-Identifier: GPL-3.0-or-later
import { decisionSchema, type Brain, type BrainRequest, type BrainResult } from './decision.ts';
import { conversationTool, conversationOutputLimit, conversationDecision } from './conversation.ts';
import { outputLimit, turnTool } from './turn-tool.ts';
export { outputLimit, turnTool } from './turn-tool.ts';
export class OpenAIBrain implements Brain {
  constructor(
    private apiKey: string,
    private model: string,
    private transport: typeof fetch = fetch,
    private mode: 'plan' | 'conversation' = 'plan',
  ) {}
  async decide(request: BrainRequest, signal: AbortSignal): Promise<BrainResult> {
    const tool = this.mode === 'conversation' ? conversationTool : turnTool;
    const response = await this.transport('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
      body: JSON.stringify({
        model: this.model,
        store: false,
        instructions: request.instructions,
        input: JSON.stringify(request.observation),
        tools: [tool],
        tool_choice: { type: 'function', name: tool.name },
        parallel_tool_calls: false,
        max_output_tokens: this.mode === 'conversation' ? conversationOutputLimit : outputLimit,
      }),
    });
    // Never persist provider error bodies: they can echo credentials or prompt data.
    if (!response.ok) throw Error(`AI provider HTTP ${response.status}`);
    const body = (await response.json()) as {
      status?: string;
      output?: { type: string; name?: string; arguments?: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };
    if (body.status !== 'completed') throw Error('AI response incomplete');
    const calls =
      body.output?.filter((o) => o.type === 'function_call' && o.name === tool.name) ?? [];
    if (calls.length !== 1 || !calls[0].arguments || calls[0].arguments.length > 20000)
      throw Error('AI response did not contain one valid turn');
    const decision =
      this.mode === 'conversation'
        ? conversationDecision(JSON.parse(calls[0].arguments))
        : decisionSchema.parse(JSON.parse(calls[0].arguments));
    if (
      !body.usage ||
      !Number.isSafeInteger(body.usage.input_tokens) ||
      !Number.isSafeInteger(body.usage.output_tokens) ||
      body.usage.input_tokens < 0 ||
      body.usage.output_tokens < 0
    )
      throw Error('AI response missing token accounting');
    return {
      decision,
      inputTokens: body.usage.input_tokens,
      outputTokens: body.usage.output_tokens,
    };
  }
}
