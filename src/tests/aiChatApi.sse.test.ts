import { describe, expect, test, vi } from 'vitest';
import { handleSSEDataLine, StreamChunk } from '@/lib/aiChatApi';

describe('handleSSEDataLine', () => {
  test('emits text chunks for deltas and done chunk for output completion', () => {
    const onChunk = vi.fn<(chunk: StreamChunk) => void>();
    const onComplete = vi.fn();

    const events = [
      JSON.stringify({
        event: 'response.output_text.delta',
        data: { delta: 'Hei ' },
      }),
      JSON.stringify({
        event: 'response.output_text.delta',
        data: { delta: 'maailma' },
      }),
      JSON.stringify({
        event: 'response.output_text.done',
        data: {},
      }),
    ];

    const completionFlags = events.map((event) =>
      handleSSEDataLine(event, onChunk, onComplete)
    );

    expect(completionFlags).toEqual([false, false, false]);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onChunk).toHaveBeenNthCalledWith(1, {
      type: 'text',
      content: 'Hei ',
    });
    expect(onChunk).toHaveBeenNthCalledWith(2, {
      type: 'text',
      content: 'maailma',
    });
    expect(onChunk).toHaveBeenNthCalledWith(3, { type: 'done' });
  });
});
