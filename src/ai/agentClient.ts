import Anthropic from '@anthropic-ai/sdk';
import { AGENT_TOOL_DEFINITIONS, executeToolCall } from './agentTools';
import { buildSystemPrompt } from './systemPrompt';
import { useRenovationStore } from '../store/useRenovationStore';
import { saveSnapshot, logChange } from '../store/changelog';
import type { ToolCall } from '../types';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (toolName: string, input: Record<string, unknown>) => void;
  onToolResult: (toolName: string, result: string) => void;
  onDone: (fullText: string, toolCalls: ToolCall[]) => void;
  onError: (error: string) => void;
}

export interface PendingImage {
  dataUrl: string;    // full base64 data URL (data:image/...;base64,...)
  mimeType: string;   // e.g. "image/jpeg"
  filename?: string;
}

// ─── One-shot image analysis (no conversation, no streaming) ─────────────────
// Used by the "Analyze with AI" button in TaskDetailView.
// Returns a plain text analysis; caller saves it to the file record.
export async function analyzeImage(
  image: PendingImage,
  context: string,
): Promise<string> {
  const base64Data = image.dataUrl.split(',')[1] ?? image.dataUrl;
  const mediaType = image.mimeType as
    | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
        {
          type: 'text',
          text: `${context}\n\nDescribe what you observe relevant to the restoration. Note any damage, wear, corrosion, missing parts, or condition issues. Be specific and technical. Under 150 words.`,
        },
      ],
    }],
  });

  return response.content[0]?.type === 'text' ? response.content[0].text : '';
}

export async function sendAgentMessage(
  userMessage: string,
  callbacks: StreamCallbacks,
  pendingImage?: PendingImage,
): Promise<void> {
  const store = useRenovationStore.getState();
  const { agentHistory } = store;

  // Build messages array from history (last 20 to avoid token limits)
  const historyMessages = agentHistory.slice(-20).map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Build the user message content — may include an image
  const userContent: Anthropic.MessageParam['content'] = pendingImage
    ? [
        {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: pendingImage.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: pendingImage.dataUrl.split(',')[1] ?? pendingImage.dataUrl,
          },
        },
        { type: 'text' as const, text: userMessage },
      ]
    : userMessage;

  const messages: Anthropic.MessageParam[] = [
    ...historyMessages,
    { role: 'user', content: userContent },
  ];

  store.setAgentStreaming(true);

  let fullText = '';
  const toolCallsMade: ToolCall[] = [];

  try {
    // Agentic loop — keep going until no more tool calls
    let continueLoop = true;
    let currentMessages = messages;

    while (continueLoop) {
      continueLoop = false;
      let inputJson = '';
      let currentToolName = '';
      let currentToolUseId = '';
      let inToolUse = false;

      const stream = await client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: buildSystemPrompt(),
        tools: AGENT_TOOL_DEFINITIONS as Anthropic.Tool[],
        messages: currentMessages,
      });

      const toolBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            inToolUse = true;
            currentToolName = event.content_block.name;
            currentToolUseId = event.content_block.id;
            inputJson = '';
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            fullText += event.delta.text;
            callbacks.onToken(event.delta.text);
          } else if (event.delta.type === 'input_json_delta') {
            inputJson += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (inToolUse && currentToolName) {
            try {
              const input = JSON.parse(inputJson || '{}');
              toolBlocks.push({ id: currentToolUseId, name: currentToolName, input });
              callbacks.onToolCall(currentToolName, input);
            } catch {
              // ignore parse errors
            }
            inToolUse = false;
            inputJson = '';
            currentToolName = '';
          }
        } else if (event.type === 'message_stop') {
          // Process all tool calls
          if (toolBlocks.length > 0) {
            continueLoop = true;

            // Auto-snapshot before bulk changes (≥2 tool calls = agent is restructuring)
            if (toolBlocks.length >= 2) {
              const currentStateJson = useRenovationStore.getState().exportProgress();
              saveSnapshot(currentStateJson).catch(() => {});
              logChange({
                type: 'agent_bulk_change',
                summary: `Agent made ${toolBlocks.length} changes: ${toolBlocks.map(b => b.name).join(', ')}`,
              }).catch(() => {});
            }

            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const block of toolBlocks) {
              const result = await executeToolCall(block.name, block.input);
              callbacks.onToolResult(block.name, result);
              toolCallsMade.push({ name: block.name, input: block.input, result });
              toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
            }

            // Get the full response content for continuing the conversation
            const finalMessage = await stream.finalMessage();
            currentMessages = [
              ...currentMessages,
              { role: 'assistant' as const, content: finalMessage.content },
              { role: 'user' as const, content: toolResults },
            ];
          }
        }
      }
    }

    callbacks.onDone(fullText, toolCallsMade);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    callbacks.onError(msg);
  } finally {
    store.setAgentStreaming(false);
  }
}
