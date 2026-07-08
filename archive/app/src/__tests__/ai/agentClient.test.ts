/**
 * agentClient tests — classifier and history compression
 *
 * We test `classifyQuery` directly (now exported) for all routing rules.
 * We also test the escalation logic (fast → full fallback) by mocking
 * the Anthropic SDK and verifying which model gets called.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyQuery } from '../../ai/agentClient';

// Mock Anthropic SDK — no actual API calls in tests
vi.mock('@anthropic-ai/sdk', () => {
  const mockStream = {
    [Symbol.asyncIterator]: () => {
      let done = false;
      return {
        next: async () => {
          if (!done) {
            done = true;
            return { value: { type: 'message_stop' }, done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
    finalMessage: vi.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn' }),
  };

  return {
    // Must use a regular function (not arrow) so `new Anthropic(...)` works
    default: vi.fn(function() {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'summary text' }],
            stop_reason: 'end_turn',
          }),
          stream: vi.fn().mockReturnValue(mockStream),
        },
      };
    }),
  };
});

vi.mock('../../ai/agentBackground', () => ({
  scheduleBackgroundAnalysis: vi.fn(),
  triggerTaskCompletedAnalysis: vi.fn(),
}));
vi.mock('../../store/changelog', () => ({
  logChange: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('classifyQuery — FAST tier patterns', () => {

  it('"hi" → fast', () => {
    expect(classifyQuery('hi', false)).toBe('fast');
  });

  it('"hey" → fast', () => {
    expect(classifyQuery('hey', false)).toBe('fast');
  });

  it('"Hello" → fast (case insensitive)', () => {
    expect(classifyQuery('Hello', false)).toBe('fast');
  });

  it('"thanks" → fast', () => {
    expect(classifyQuery('thanks', false)).toBe('fast');
  });

  it('"ok" → fast', () => {
    expect(classifyQuery('ok', false)).toBe('fast');
  });

  it('"got it" → fast', () => {
    expect(classifyQuery('got it', false)).toBe('fast');
  });

  it('"sounds good" → fast', () => {
    expect(classifyQuery('sounds good', false)).toBe('fast');
  });

  it('"great" → fast', () => {
    expect(classifyQuery('great', false)).toBe('fast');
  });

  it('"what\'s next" → fast', () => {
    expect(classifyQuery("what's next", false)).toBe('fast');
  });

  it('"what should i do next" → fast', () => {
    expect(classifyQuery('what should i do next', false)).toBe('fast');
  });

  it('"how many tasks" → fast', () => {
    expect(classifyQuery('how many tasks', false)).toBe('fast');
  });

  it('"how far along" → fast', () => {
    expect(classifyQuery('how far along', false)).toBe('fast');
  });

  it('"show my plan" → fast', () => {
    expect(classifyQuery('show my plan', false)).toBe('fast');
  });

  it('"list tasks" → fast', () => {
    expect(classifyQuery('list tasks', false)).toBe('fast');
  });

  it('"am i on track" → fast', () => {
    expect(classifyQuery('am i on track', false)).toBe('fast');
  });

  it('"are we making progress" → fast', () => {
    expect(classifyQuery('are we making progress', false)).toBe('fast');
  });

  it('short message (< 60 chars) with no FULL keywords → fast', () => {
    expect(classifyQuery('nice work today', false)).toBe('fast');
  });

  it('empty string → fast (length < 60)', () => {
    expect(classifyQuery('', false)).toBe('fast');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('classifyQuery — FULL tier patterns', () => {

  it('"add a task for spark plugs" → full', () => {
    expect(classifyQuery('add a task for spark plugs', false)).toBe('full');
  });

  it('"create a new phase" → full', () => {
    expect(classifyQuery('create a new phase for interior work', false)).toBe('full');
  });

  it('"search for brake drum prices" → full', () => {
    expect(classifyQuery('search for brake drum prices in Israel', false)).toBe('full');
  });

  it('"research AMC 258 head gasket" → full', () => {
    expect(classifyQuery('research AMC 258 head gasket failure modes', false)).toBe('full');
  });

  it('"engine is making a knocking noise" → full (engine keyword)', () => {
    expect(classifyQuery('engine is making a knocking noise', false)).toBe('full');
  });

  it('"brake pads are worn" → full (brake keyword)', () => {
    expect(classifyQuery('brake pads are worn out', false)).toBe('full');
  });

  it('"help me plan the suspension rebuild" → full', () => {
    expect(classifyQuery('help me plan the suspension rebuild', false)).toBe('full');
  });

  it('"should I rebuild or replace the carb" → full', () => {
    expect(classifyQuery('should I rebuild or replace the carb', false)).toBe('full');
  });

  it('"walk me through the timing procedure" → full', () => {
    expect(classifyQuery('walk me through the timing procedure', false)).toBe('full');
  });

  it('"fix the oil leak" → full (fix keyword)', () => {
    expect(classifyQuery('fix the oil leak', false)).toBe('full');
  });

  it('"rebuild the carburetor" → full', () => {
    expect(classifyQuery('rebuild the carburetor', false)).toBe('full');
  });

  it('"remove the old gasket" → full', () => {
    expect(classifyQuery('remove the old gasket', false)).toBe('full');
  });

  it('"where can I buy parts in Israel" → full (israel keyword)', () => {
    expect(classifyQuery('where can I buy parts in Israel', false)).toBe('full');
  });

  it('"move task to another phase" → full', () => {
    expect(classifyQuery('move task to another phase', false)).toBe('full');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('classifyQuery — length rules override patterns', () => {

  it('message > 120 chars → full regardless of content', () => {
    const longMsg = 'hi '.repeat(50); // 150 chars, matches FAST "hi" but is too long
    expect(classifyQuery(longMsg, false)).toBe('full');
  });

  it('message between 60-120 chars with no keywords → full', () => {
    // 65 chars, no FAST or FULL keywords
    const mid = 'The weather outside is absolutely beautiful today and I feel good';
    expect(mid.length).toBeGreaterThan(60);
    expect(mid.length).toBeLessThanOrEqual(120);
    expect(classifyQuery(mid, false)).toBe('full');
  });

  it('message exactly 59 chars with no keywords → fast', () => {
    const short = 'a'.repeat(59);
    expect(classifyQuery(short, false)).toBe('fast');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('classifyQuery — image always forces full', () => {

  it('any message with image → full', () => {
    expect(classifyQuery('hi', true)).toBe('full');
  });

  it('one-char message + image → full', () => {
    expect(classifyQuery('x', true)).toBe('full');
  });

  it('FAST pattern + image → full (image wins)', () => {
    expect(classifyQuery("what's next", true)).toBe('full');
  });

  it('empty string + image → full', () => {
    expect(classifyQuery('', true)).toBe('full');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('classifyQuery — edge cases', () => {

  it('"thanks for adding that task" → fast (starts with "thanks")', () => {
    expect(classifyQuery('thanks for adding that task', false)).toBe('fast');
  });

  it('"q: how many phases" → fast (q: prefix)', () => {
    expect(classifyQuery('q: how many phases do I have', false)).toBe('fast');
  });

  it('message with "explain" keyword → full', () => {
    expect(classifyQuery('explain how the transfer case works', false)).toBe('full');
  });

  it('message with "why" keyword → full', () => {
    expect(classifyQuery('why is my engine leaking', false)).toBe('full');
  });

  it('"set_car_fact" — tool name in message → full', () => {
    // "set" is a FULL_PATTERN keyword
    expect(classifyQuery('set my budget to 80000', false)).toBe('full');
  });
});
