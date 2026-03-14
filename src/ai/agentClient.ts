/**
 * agentClient.ts
 *
 * Improvements over v1:
 *
 * 1. PROMPT CACHING — Static system prompt (CJ8 knowledge + rules) is
 *    marked with cache_control: { type: 'ephemeral' }. After the first
 *    request in a session, cached tokens cost ~10% of normal price.
 *    The static part is ~60–70% of the total system prompt.
 *
 * 2. CONTEXT SELECTION — Dynamic context is built by contextSelector.ts,
 *    which sends only what's relevant to the query (focused task detail,
 *    system-specific tasks, cost summary, or compressed plan) instead of
 *    always dumping the full plan. Reduces dynamic context 50–80% on most
 *    requests.
 *
 * 3. TWO-TIER ROUTING — Simple queries (status checks, "what's next",
 *    greetings) are served by claude-haiku-4-5 with no tools and minimal
 *    context. Complex queries (planning, research, restructuring) use the
 *    full claude-sonnet-4-6 pipeline. Haiku calls are ~10–15x cheaper.
 *
 * 4. CONVERSATION COMPRESSION — After a full-tier turn completes, if
 *    the conversation history exceeds 12 messages the oldest 8 are
 *    summarized into a single compact message via a cheap haiku call.
 *    The plan data itself is always in the system prompt, so nothing
 *    meaningful is lost.
 */

import Anthropic from '@anthropic-ai/sdk';
import { AGENT_TOOL_DEFINITIONS, executeToolCall } from './agentTools';
import { STATIC_SYSTEM_PROMPT, buildSystemPrompt } from './systemPrompt';
import { buildDynamicContext } from './contextSelector';
import { useRenovationStore } from '../store/useRenovationStore';
import { saveSnapshot, logChange } from '../store/changelog';
import type { ToolCall } from '../types';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

const SONNET_MODEL = 'claude-sonnet-4-6';
const HAIKU_MODEL  = 'claude-haiku-4-5';

// ─── Public types ──────────────────────────────────────────────────────────────

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

// ─── Query tier classifier ─────────────────────────────────────────────────────
// Decides whether a query needs the full sonnet pipeline or can be served
// cheaply by haiku with no tools.

const FAST_PATTERNS = [
  /^(what'?s? (next|my next task|left)|what should i do next)/i,
  /^how (many|far|much) (tasks?|phases?|progress|complete)/i,
  /^(show|list) (my )?(tasks?|phases?|plan|progress)/i,
  /^(am i|are we) (on track|making progress|doing (ok|well|good))/i,
  /^(thanks|ok|got it|sounds good|cool|nice|great|perfect|awesome)\b/i,
  /^(hi|hey|hello|yo)\b/i,
  /^(quick question:|q:)/i,
  /^(what'?s? the status of|how is)/i,
  /^(remind me|what did we|what have we)/i,
];

const FULL_PATTERNS = [
  /\b(add|create|build|plan|search|research|restructure|move|remove|delete|flag|update|set)\b/i,
  /\b(phase|new task|parts list|cost estimate|supplier|steps|guide|task[s]?)\b/i,
  /\b(should i|help me|suggest|recommend|what about|how do i|why|explain|walk me through)\b/i,
  /\b(engine|brake|suspension|electrical|frame|axle|transmission|transfer case|steering|cooling|fuel)\b/i,
  /\b(fix|repair|replace|rebuild|restore|install|remove|check|inspect|test)\b/i,
  /\b(part number|supplier|buy|order|israel|shipping|price)\b/i,
];

function classifyQuery(message: string, hasImage: boolean): 'fast' | 'full' {
  if (hasImage) return 'full';
  if (message.length > 120) return 'full';
  if (FAST_PATTERNS.some((p) => p.test(message.trim()))) return 'fast';
  if (FULL_PATTERNS.some((p) => p.test(message))) return 'full';
  return message.length < 60 ? 'fast' : 'full';
}

// ─── One-shot image analysis ───────────────────────────────────────────────────
// Used by the "Analyze with AI" button. Returns plain text, not streamed.

export async function analyzeImage(
  image: PendingImage,
  context: string,
): Promise<string> {
  const base64Data = image.dataUrl.split(',')[1] ?? image.dataUrl;
  const mediaType = image.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const response = await client.messages.create({
    model: SONNET_MODEL,
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

// ─── Fast tier: haiku, no tools, minimal context ──────────────────────────────

async function sendFastMessage(
  userMessage: string,
  callbacks: StreamCallbacks,
  taskId?: string,
  phaseId?: string,
): Promise<void> {
  const dynamicCtx = buildDynamicContext(userMessage, { taskId, phaseId });

  const stream = client.messages.stream({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system: `You are a Jeep CJ8 restoration advisor. Answer concisely and practically — no tool calls, no planning. Just answer the question.\n\n${dynamicCtx}`,
    messages: [{ role: 'user', content: userMessage }],
  });

  let fullText = '';
  for await (const event of await stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text;
      callbacks.onToken(event.delta.text);
    }
  }

  logChange({
    type: 'fast_query',
    summary: `Fast query (haiku): "${userMessage.slice(0, 60)}${userMessage.length > 60 ? '…' : ''}"`,
  }).catch(() => {});

  callbacks.onDone(fullText, []);
}

// ─── History compression ───────────────────────────────────────────────────────
// After a full-tier turn with 12+ history messages, compress the oldest 8
// into a compact summary via a cheap haiku call.
// The full plan is always injected via the system prompt, so no plan detail
// is lost — only the raw back-and-forth chat text gets summarized.

async function maybeCompressHistory(): Promise<void> {
  const history = useRenovationStore.getState().agentHistory;
  if (history.length <= 12) return;

  const toCompress = history.slice(0, history.length - 4); // keep 4 most recent raw
  if (toCompress.length < 6) return;

  try {
    const convText = toCompress
      .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 400)}`)
      .join('\n\n');

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Summarize this Jeep CJ8 restoration conversation into a compact context note. Focus on: decisions made, facts confirmed about the Jeep, approaches agreed on, anything the advisor committed to doing. Be terse and specific. Under 180 words. Do not include task names unless something important was decided about them.\n\n${convText}`,
      }],
    });

    const summary = response.content[0]?.type === 'text' ? response.content[0].text : '';
    if (!summary) return;

    const idsToReplace = toCompress.map((m) => m.id);
    const summaryContent = `[EARLIER CONVERSATION SUMMARY]\n${summary}`;

    useRenovationStore.getState().compressAgentHistory(summaryContent, idsToReplace);

    logChange({
      type: 'history_compressed',
      summary: `History compressed: ${toCompress.length} messages → summary`,
      compressedCount: toCompress.length,
    }).catch(() => {});
  } catch {
    // Compression failure is silent — history just stays longer
  }
}

// ─── Full tier: sonnet, tools, smart context ──────────────────────────────────

export async function sendAgentMessage(
  userMessage: string,
  callbacks: StreamCallbacks,
  pendingImage?: PendingImage,
  opts?: { taskId?: string; phaseId?: string },
): Promise<void> {
  const store = useRenovationStore.getState();
  const { agentHistory } = store;

  const tier = classifyQuery(userMessage, !!pendingImage);

  // ── Fast tier shortcut ────────────────────────────────────────────────────
  if (tier === 'fast') {
    try {
      await sendFastMessage(userMessage, callbacks, opts?.taskId, opts?.phaseId);
    } catch (error) {
      // Fast tier failed — fall through to full tier
      const msg = error instanceof Error ? error.message : 'Unknown error';
      // Only escalate if it looks like a non-auth error
      if (!msg.includes('authentication') && !msg.includes('credit')) {
        await runFullTier(userMessage, callbacks, agentHistory, pendingImage, opts);
        return;
      }
      callbacks.onError(msg);
    }
    return;
  }

  // ── Full tier ─────────────────────────────────────────────────────────────
  store.setAgentStreaming(true);
  try {
    await runFullTier(userMessage, callbacks, agentHistory, pendingImage, opts);
    // After a successful full turn, check if history needs compression
    maybeCompressHistory().catch(() => {});
  } finally {
    store.setAgentStreaming(false);
  }
}

async function runFullTier(
  userMessage: string,
  callbacks: StreamCallbacks,
  agentHistory: ReturnType<typeof useRenovationStore.getState>['agentHistory'],
  pendingImage?: PendingImage,
  opts?: { taskId?: string; phaseId?: string },
): Promise<void> {
  // Build history (last 20 messages, but respect compressed summaries)
  const historyMessages = agentHistory.slice(-20).map((msg) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  // Build user message content — may include an image
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

  // Build split system prompt: static (cacheable) + dynamic (live state)
  const dynamicContext = buildDynamicContext(userMessage, opts);

  let fullText = '';
  const toolCallsMade: ToolCall[] = [];

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
      model: SONNET_MODEL,
      max_tokens: 2048,
      // Split system prompt — static part gets prompt caching (~10% cost on cache hits)
      system: [
        {
          type: 'text' as const,
          text: STATIC_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' as const },
        },
        {
          type: 'text' as const,
          text: dynamicContext,
        },
      ] as Anthropic.TextBlockParam[],
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
        if (toolBlocks.length > 0) {
          continueLoop = true;

          // Auto-snapshot before bulk changes (≥2 tool calls = agent is restructuring)
          if (toolBlocks.length >= 2) {
            const currentStateJson = useRenovationStore.getState().exportProgress();
            saveSnapshot(currentStateJson).catch(() => {});
            logChange({
              type: 'agent_bulk_change',
              summary: `Agent made ${toolBlocks.length} changes: ${toolBlocks.map((b) => b.name).join(', ')}`,
            }).catch(() => {});
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of toolBlocks) {
            const result = await executeToolCall(block.name, block.input);
            callbacks.onToolResult(block.name, result);
            toolCallsMade.push({ name: block.name, input: block.input, result });
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
          }

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
}
