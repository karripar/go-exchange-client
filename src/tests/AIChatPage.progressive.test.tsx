import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    toggleLanguage: vi.fn(),
  }),
}));

vi.mock('@/lib/aiChatApi', () => ({
  sendChatMessage: vi.fn(),
}));

import AIChatPage from '@/app/ai-chat/page';
import { sendChatMessage } from '@/lib/aiChatApi';

const mockSendChatMessage = vi.mocked(sendChatMessage);

describe('AIChatPage progressive streaming', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockSendChatMessage.mockImplementation(
      async (_messages, onChunk, onComplete) => {
        setTimeout(() => onChunk({ type: 'text', content: 'Hello' }), 100);
        setTimeout(() => onChunk({ type: 'text', content: ' world' }), 200);
        setTimeout(() => onComplete(), 300);
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('assistant message grows as chunks arrive', async () => {
    render(<AIChatPage />);

    fireEvent.change(screen.getByLabelText('Kirjoita viesti'), {
      target: { value: 'Test prompt' },
    });
    fireEvent.click(screen.getByLabelText('Lähetä viesti'));

    expect(mockSendChatMessage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.queryByText('Hello world')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });
});
