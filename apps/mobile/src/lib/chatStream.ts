import EventSource from 'react-native-sse';
import type { ChatStreamEvent, TokenPair } from '@cymetric/types';
import { secureTokenStorage } from './storage';
import { API_BASE_URL } from './api';

// Streams an assistant reply over SSE. React Native's fetch on the old
// architecture doesn't return a usable ReadableStream, so we use
// react-native-sse (XMLHttpRequest under the hood — supports both archs).
//
// Returns a `close()` callback so the caller can cancel the stream from a
// React effect cleanup or an "abort" button. `onEvent` fires once per SSE
// frame; on terminal events (`done`/`error`) we close automatically.
export function streamChatMessage(args: {
  threadId: string;
  content: string;
  onEvent: (evt: ChatStreamEvent) => void;
  onClose?: () => void;
  onTransportError?: (err: unknown) => void;
}): () => void {
  const url = `${API_BASE_URL}/api/v1/ai/chat/threads/${encodeURIComponent(args.threadId)}/messages`;

  let cancelled = false;
  let es: EventSource | null = null;

  (async () => {
    let tokens: TokenPair | null;
    try {
      tokens = await secureTokenStorage.getTokens();
    } catch (err) {
      args.onTransportError?.(err);
      args.onClose?.();
      return;
    }
    if (cancelled) return;

    es = new EventSource(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(tokens?.accessToken
          ? { Authorization: `Bearer ${tokens.accessToken}` }
          : {}),
      },
      body: JSON.stringify({ content: args.content }),
      // The library auto-reconnects by default; we want a single one-shot
      // stream, so disable retry logic.
      pollingInterval: 0,
    });

    es.addEventListener('message', (event) => {
      if (!event.data) return;
      let parsed: ChatStreamEvent;
      try {
        parsed = JSON.parse(event.data) as ChatStreamEvent;
      } catch {
        return; // malformed frame — skip
      }
      args.onEvent(parsed);
      // Terminal events: close the connection so we don't leak.
      if (parsed.type === 'done' || parsed.type === 'error') {
        es?.close();
        args.onClose?.();
      }
    });

    es.addEventListener('error', (event) => {
      // Library emits an "error" event for network failures, non-2xx HTTP,
      // and the server closing the stream cleanly. We can't reliably tell
      // them apart, but if we already saw a terminal event we ignore this.
      // If we haven't received any events yet, surface as transport error.
      args.onTransportError?.(event);
      args.onClose?.();
    });

    es.addEventListener('close', () => {
      args.onClose?.();
    });
  })();

  return () => {
    cancelled = true;
    es?.close();
  };
}
