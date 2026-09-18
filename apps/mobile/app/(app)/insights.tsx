import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ChatRole, type ChatMessage, type ChatThread } from '@cymetric/types';
import { Screen } from '@/components/Screen';
import { TopBar } from '@/components/TopBar';
import { api } from '@/lib/api';
import { streamChatMessage } from '@/lib/chatStream';
import { colors } from '@/theme/colors';

// Suggested prompts surfaced in the empty state — tap to send. These map
// to specific intents the advisor handles confidently, so the user's first
// tap always lands on a useful answer.
const SUGGESTIONS = [
  'Where am I weakest?',
  'What should I focus on first?',
  'How do I improve my Process score?',
  'What threats matter for my industry?',
];

export default function Chat() {
  const qc = useQueryClient();

  // Active thread id; null means "no thread yet" (empty state).
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Local in-flight assistant message text — appended to as SSE deltas arrive.
  // Cleared when the `done` event lands and the persisted row replaces it.
  const [streamingText, setStreamingText] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  // Returned by streamChatMessage; calling it cancels the in-flight stream.
  const cancelStreamRef = useRef<(() => void) | null>(null);

  // Optimistic user message — appended locally the moment the user taps Send
  // so the bubble shows instantly. Replaced by the canonical row after the
  // server emits `user_message`. Identified by negative timestamp ids.
  const [optimistic, setOptimistic] = useState<ChatMessage | null>(null);

  const threadsQuery = useQuery({
    queryKey: ['chat', 'threads'],
    queryFn: () => api.chat.listThreads(),
  });
  const threads = threadsQuery.data?.threads ?? [];

  // Auto-select the most recent thread on first load.
  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0]!.id);
    }
  }, [activeThreadId, threads]);

  const messagesQuery = useQuery({
    queryKey: ['chat', 'messages', activeThreadId],
    queryFn: () => api.chat.getMessages(activeThreadId!),
    enabled: !!activeThreadId,
  });

  const createThread = useMutation({
    mutationFn: () => api.chat.createThread(),
    onSuccess: (thread) => {
      qc.invalidateQueries({ queryKey: ['chat', 'threads'] });
      setActiveThreadId(thread.id);
      setDrawerOpen(false);
    },
  });

  const deleteThread = useMutation({
    mutationFn: (id: string) => api.chat.deleteThread(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['chat', 'threads'] });
      if (activeThreadId === id) setActiveThreadId(null);
    },
  });

  // Cleanup any in-flight stream when leaving the screen / changing thread.
  useEffect(() => {
    return () => {
      cancelStreamRef.current?.();
    };
  }, [activeThreadId]);

  const send = useCallback(
    async (content: string) => {
      if (streaming) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      // Lazily mint a thread if none active yet.
      let threadId = activeThreadId;
      if (!threadId) {
        try {
          const t = await api.chat.createThread();
          qc.invalidateQueries({ queryKey: ['chat', 'threads'] });
          setActiveThreadId(t.id);
          threadId = t.id;
        } catch {
          Alert.alert('Could not start chat', 'Please try again.');
          return;
        }
      }

      // Show the user message instantly.
      const tempId = `optimistic-${Date.now()}`;
      setOptimistic({
        id: tempId,
        role: ChatRole.USER,
        content: trimmed,
        createdAt: new Date().toISOString(),
      });
      setStreamingText('');
      setStreaming(true);

      // Cancel any previous in-flight stream before starting a new one.
      cancelStreamRef.current?.();
      let sawTerminal = false;
      cancelStreamRef.current = streamChatMessage({
        threadId,
        content: trimmed,
        onEvent: (evt) => {
          switch (evt.type) {
            case 'user_message':
              // Canonical user row exists; clear the optimistic stub.
              setOptimistic(null);
              break;
            case 'delta':
              setStreamingText((prev) => prev + evt.text);
              break;
            case 'done':
              sawTerminal = true;
              setStreaming(false);
              setStreamingText('');
              qc.invalidateQueries({
                queryKey: ['chat', 'messages', threadId],
              });
              qc.invalidateQueries({ queryKey: ['chat', 'threads'] });
              break;
            case 'error':
              sawTerminal = true;
              setStreaming(false);
              setStreamingText('');
              Alert.alert(
                'Chat error',
                evt.message || 'Something went wrong on our end.',
              );
              break;
          }
        },
        onTransportError: () => {
          // Library fires this for network failures AND for clean server
          // closes — only surface if we never saw a terminal event.
          if (sawTerminal) return;
          setStreaming(false);
          setStreamingText('');
          setOptimistic(null);
          Alert.alert(
            'Network error',
            'Could not reach the AI service. Check your connection.',
          );
        },
        onClose: () => {
          cancelStreamRef.current = null;
        },
      });
    },
    [activeThreadId, qc, streaming],
  );

  return (
    <Screen glow>
      <TopBar title="CHAT" />
      <View style={{ flex: 1 }}>
        {/* Thread bar */}
        <ThreadBar
          activeThread={threads.find((t) => t.id === activeThreadId) ?? null}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNewThread={() => createThread.mutate()}
          creating={createThread.isPending}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <MessageList
            loading={messagesQuery.isLoading}
            messages={messagesQuery.data?.messages ?? []}
            optimistic={optimistic}
            streamingText={streamingText}
            streaming={streaming}
            onSuggestionPress={send}
          />
          <Composer onSend={send} disabled={streaming} />
        </KeyboardAvoidingView>
      </View>

      {/* Threads drawer */}
      {drawerOpen && (
        <ThreadsDrawer
          threads={threads}
          activeId={activeThreadId}
          onSelect={(id) => {
            setActiveThreadId(id);
            setDrawerOpen(false);
          }}
          onDelete={(id) => {
            Alert.alert('Delete chat?', 'This conversation will be archived.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteThread.mutate(id),
              },
            ]);
          }}
          onNewThread={() => createThread.mutate()}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </Screen>
  );
}

function ThreadBar({
  activeThread,
  onOpenDrawer,
  onNewThread,
  creating,
}: {
  activeThread: ChatThread | null;
  onOpenDrawer: () => void;
  onNewThread: () => void;
  creating: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <Pressable
        onPress={onOpenDrawer}
        hitSlop={10}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.04)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Ionicons name="menu" size={18} color={colors.text.secondary} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: colors.text.primary, fontSize: 14, fontWeight: '700' }}
          numberOfLines={1}
        >
          {activeThread?.title ?? 'New chat'}
        </Text>
        <Text style={{ color: colors.text.muted, fontSize: 11, marginTop: 1 }}>
          CyMetric Advisor
        </Text>
      </View>
      <Pressable
        onPress={onNewThread}
        disabled={creating}
        hitSlop={10}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: `${colors.brand[500]}22`,
          borderWidth: 1,
          borderColor: `${colors.brand[500]}55`,
          opacity: creating ? 0.5 : 1,
        }}
      >
        <Ionicons name="create-outline" size={14} color={colors.brand[400]} />
        <Text
          style={{
            color: colors.brand[400],
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1,
          }}
        >
          NEW
        </Text>
      </Pressable>
    </View>
  );
}

function MessageList({
  loading,
  messages,
  optimistic,
  streamingText,
  streaming,
  onSuggestionPress,
}: {
  loading: boolean;
  messages: ChatMessage[];
  optimistic: ChatMessage | null;
  streamingText: string;
  streaming: boolean;
  onSuggestionPress: (text: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const merged = useMemo(() => {
    const arr = [...messages];
    if (optimistic) arr.push(optimistic);
    return arr;
  }, [messages, optimistic]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [merged.length, streamingText]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand[400]} />
      </View>
    );
  }

  if (merged.length === 0 && !streaming) {
    return (
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          paddingBottom: 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 24 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: `${colors.brand[500]}1c`,
              borderWidth: 1,
              borderColor: `${colors.brand[500]}55`,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="sparkles" size={26} color={colors.brand[400]} />
          </View>
          <Text
            style={{
              color: colors.text.primary,
              fontSize: 20,
              fontWeight: '800',
              marginTop: 16,
            }}
          >
            Ask your scorecard
          </Text>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: 13,
              marginTop: 8,
              textAlign: 'center',
              lineHeight: 19,
            }}
          >
            Your AI advisor knows your KPIs, scores, and underperforming areas.
            Ask anything.
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => onSuggestionPress(s)}
              style={{
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 14,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.07)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={14}
                color={colors.brand[400]}
              />
              <Text style={{ color: colors.text.primary, fontSize: 13, flex: 1 }}>
                {s}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={14}
                color={colors.text.muted}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 10 }}
    >
      {merged.map((m) => (
        <Bubble key={m.id} role={m.role} content={m.content} />
      ))}
      {streaming && (
        <Bubble
          role={ChatRole.ASSISTANT}
          content={streamingText || '...'}
          streaming
        />
      )}
    </ScrollView>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: ChatRole;
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === ChatRole.USER;
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 16,
        backgroundColor: isUser
          ? `${colors.brand[500]}33`
          : 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: isUser
          ? `${colors.brand[500]}55`
          : 'rgba(255,255,255,0.07)',
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
      }}
    >
      <Text
        style={{
          color: colors.text.primary,
          fontSize: 14,
          lineHeight: 20,
        }}
      >
        {content}
        {streaming && (
          <Text style={{ color: colors.brand[400] }}>{' ▍'}</Text>
        )}
      </Text>
    </View>
  );
}

function Composer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        padding: 12,
        paddingBottom: Platform.OS === 'ios' ? 16 : 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          borderRadius: 18,
          paddingHorizontal: 14,
          paddingVertical: Platform.OS === 'ios' ? 10 : 4,
          maxHeight: 120,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={disabled ? 'Thinking…' : 'Ask about your scorecard'}
          placeholderTextColor={colors.text.muted}
          multiline
          editable={!disabled}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          style={{
            color: colors.text.primary,
            fontSize: 14,
            lineHeight: 19,
          }}
        />
      </View>
      <Pressable
        onPress={submit}
        disabled={disabled || !text.trim()}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor:
            disabled || !text.trim() ? 'rgba(255,255,255,0.06)' : colors.brand[500],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons
          name={disabled ? 'hourglass-outline' : 'arrow-up'}
          size={18}
          color="#fff"
        />
      </Pressable>
    </View>
  );
}

function ThreadsDrawer({
  threads,
  activeId,
  onSelect,
  onDelete,
  onNewThread,
  onClose,
}: {
  threads: ChatThread[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewThread: () => void;
  onClose: () => void;
}) {
  return (
    <Pressable
      onPress={onClose}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
      }}
    >
      <Pressable
        onPress={() => {}}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: '78%',
          backgroundColor: colors.bg.card,
          borderRightWidth: 1,
          borderRightColor: 'rgba(255,255,255,0.07)',
          paddingTop: 60,
          paddingBottom: 24,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <Text
            style={{ color: colors.text.primary, fontSize: 18, fontWeight: '800' }}
          >
            Conversations
          </Text>
          <Pressable
            onPress={() => {
              onNewThread();
            }}
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: colors.brand[500],
            }}
          >
            <Ionicons name="add" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
              NEW
            </Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }}>
          {threads.length === 0 ? (
            <Text style={{ color: colors.text.muted, fontSize: 13, padding: 8 }}>
              No conversations yet.
            </Text>
          ) : (
            threads.map((t) => {
              const active = t.id === activeId;
              return (
                <View
                  key={t.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: active
                      ? `${colors.brand[500]}1c`
                      : 'transparent',
                    borderWidth: 1,
                    borderColor: active
                      ? `${colors.brand[500]}55`
                      : 'rgba(255,255,255,0.05)',
                    borderRadius: 10,
                  }}
                >
                  <Pressable
                    onPress={() => onSelect(t.id)}
                    style={{ flex: 1, padding: 12 }}
                  >
                    <Text
                      style={{
                        color: colors.text.primary,
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                      numberOfLines={1}
                    >
                      {t.title}
                    </Text>
                    {t.lastMessagePreview && (
                      <Text
                        style={{
                          color: colors.text.muted,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {t.lastMessagePreview}
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => onDelete(t.id)}
                    hitSlop={8}
                    style={{ padding: 12 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={14}
                      color={colors.text.muted}
                    />
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}
