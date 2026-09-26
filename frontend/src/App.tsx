import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { ChatFeed } from './components/ChatFeed';
import { ControlBar } from './components/ControlBar';
import { SettingsModal } from './components/SettingsModal';
import { FloatingActionsModal } from './components/FloatingActionsModal';
import { ThreadSidepanel } from './components/ThreadSidepanel';
import {
  ChatMessage,
  Session,
  Settings,
  RecordingState,
  ActionCardData,
  TranscriptSegment,
  HighlightData,
} from './types';
import { pywebviewService } from './services/pywebview';

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [activeHighlightForModal, setActiveHighlightForModal] = useState<HighlightData | null>(null);
  const [isSidepanelOpen, setIsSidepanelOpen] = useState(false);
  const [activeThreadHighlightId, setActiveThreadHighlightId] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const [recordingState, setRecordingState] = useState<RecordingState>({
    is_recording: false,
    is_paused: false,
  });
  const [settings, setSettings] = useState<Settings>({
    audio_intent_hotkey: '<ctrl>+<shift>+a',
    vision_intent_hotkey: '<ctrl>+<shift>+v',
    lookback_duration_sec: 10,
    lookback_words: 50,
    whisper_model: 'base.en',
    input_device_index: null,
    loopback_device_index: null,
    gemini_api_key: '',
    always_on_top: true,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);

  // References for latest state inside callbacks
  const messagesRef = useRef<ChatMessage[]>([]);
  const highlightsRef = useRef<HighlightData[]>([]);
  const activeSessionRef = useRef<Session | null>(null);
  const settingsRef = useRef<Settings>(settings);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    highlightsRef.current = highlights;
  }, [highlights]);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Initialize
  useEffect(() => {
    loadInitialData();

    // Event listener: Incoming transcripts
    const unsubTranscript = pywebviewService.onTranscript((seg: TranscriptSegment) => {
      setMessages((prev) => {
        if (prev.length === 0) {
          return [
            {
              id: `msg_trans_${seg.id}`,
              type: 'transcript',
              timestamp: seg.timestamp,
              content: seg.text,
              speaker: seg.speaker,
              segmentId: seg.id,
            },
          ];
        }

        const lastIndex = prev.length - 1;
        const lastMsg = prev[lastIndex];
        const timeDiff = seg.timestamp - lastMsg.timestamp;

        // Concatenate if same speaker within a short pause window (~10s)
        if (
          lastMsg.type === 'transcript' &&
          lastMsg.speaker === seg.speaker &&
          timeDiff >= 0 &&
          timeDiff < 10.0
        ) {
          const updatedLastMsg: ChatMessage = {
            ...lastMsg,
            content: `${lastMsg.content} ${seg.text}`.trim(),
            timestamp: seg.timestamp,
          };
          const nextMessages = [...prev];
          nextMessages[lastIndex] = updatedLastMsg;
          return nextMessages;
        }

        // New speaker, longer pause, or separate turn
        return [
          ...prev,
          {
            id: `msg_trans_${seg.id}`,
            type: 'transcript',
            timestamp: seg.timestamp,
            content: seg.text,
            speaker: seg.speaker,
            segmentId: seg.id,
          },
        ];
      });
    });

    // Event listener: In-place highlight trigger (hotkey or button)
    const unsubTriggerHighlight = pywebviewService.onTriggerHighlight((data: { words: number }) => {
      triggerInPlaceHighlight(data?.words);
    });

    // Event listener: AI Response for a highlight
    const unsubHighlightAi = pywebviewService.onHighlightAiResponse((data: any) => {
      setIsLoadingAi(false);
      setHighlights((prev) =>
        prev.map((h) => {
          if (h.id === data.highlight_id) {
            return {
              ...h,
              ai_response: data.ai_response,
              thought: data.thought,
              action_cards: data.action_cards,
              is_saved: true,
            };
          }
          return h;
        })
      );
    });

    const unsubState = pywebviewService.onRecordingState((state: RecordingState) => {
      setRecordingState(state);
    });

    return () => {
      unsubTranscript();
      unsubTriggerHighlight();
      unsubHighlightAi();
      unsubState();
    };
  }, []);

  const loadInitialData = async () => {
    try {
      const s = await pywebviewService.getSettings();
      setSettings(s);
      setAlwaysOnTop(s.always_on_top ?? true);

      const sessList = await pywebviewService.getSessions();
      setSessions(sessList);

      if (sessList.length > 0) {
        selectSession(sessList[0].id);
      } else {
        createNewSession();
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
  };

  const createNewSession = async () => {
    try {
      const newSess = await pywebviewService.createSession('New note');
      setSessions((prev) => [newSess, ...prev]);
      setActiveSession(newSess);
      setMessages([]);
      setHighlights([]);
      setActiveHighlightForModal(null);
      setActiveThreadHighlightId(null);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const selectSession = async (id: string) => {
    try {
      const sess = await pywebviewService.getSession(id);
      if (sess) {
        setActiveSession(sess);
        setMessages(sess.messages || []);
        setHighlights(sess.highlights || []);
        setActiveHighlightForModal(null);
        setActiveThreadHighlightId(null);
      }
    } catch (e) {
      console.error('Failed to select session:', e);
    }
  };

  const deleteSession = async (id: string) => {
    try {
      await pywebviewService.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        if (remaining.length > 0) {
          selectSession(remaining[0].id);
        } else {
          createNewSession();
        }
      }
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const handleUpdateTitle = (newTitle: string) => {
    if (!activeSession) return;
    const updated = { ...activeSession, title: newTitle };
    setActiveSession(updated);
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, title: newTitle } : s)));
    pywebviewService.saveSession(updated.id, newTitle, updated.notes || '', messages);
  };

  const handleUpdateCard = (msgId: string, updatedCard: ActionCardData) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === msgId && m.action_cards) {
          return {
            ...m,
            action_cards: m.action_cards.map((c) =>
              c.actionId === updatedCard.actionId ? updatedCard : c
            ),
          };
        }
        return m;
      })
    );
  };

  // Trigger in-place highlight logic
  const triggerInPlaceHighlight = (wordsCount?: number) => {
    const currentMessages = messagesRef.current;
    if (!currentMessages || currentMessages.length === 0) {
      return;
    }

    // Find the latest transcript message
    const transcriptMsgs = currentMessages.filter((m) => m.type === 'transcript');
    if (transcriptMsgs.length === 0) {
      return;
    }

    const lastMsg = transcriptMsgs[transcriptMsgs.length - 1];
    const budget = wordsCount || settingsRef.current.lookback_words || 50;

    // Clean text: strip any leading [CALLER]: / [ME]: tags, only count speech
    const cleanText = lastMsg.content.replace(/^\[(CALLER|ME)\]:\s*/i, '').trim();
    const words = cleanText.split(/\s+/);
    const excerpt = words.length <= budget ? cleanText : words.slice(-budget).join(' ');

    const newHighlight: HighlightData = {
      id: `hl_${Date.now()}`,
      messageId: lastMsg.id,
      text: excerpt,
      speaker: lastMsg.speaker || 'caller',
      timestamp: lastMsg.timestamp,
      created_at: Date.now() / 1000,
      is_saved: false,
    };

    setHighlights((prev) => {
      const next = [...prev, newHighlight];
      if (activeSessionRef.current) {
        pywebviewService.saveHighlight(activeSessionRef.current.id, newHighlight);
      }
      return next;
    });

    // Automatically prompt with floating actions modal!
    setActiveHighlightForModal(newHighlight);
  };

  // Toggle or open sidepanel and resize window dynamically
  const handleToggleSidepanel = async (forcedOpen?: boolean) => {
    const shouldOpen = forcedOpen !== undefined ? forcedOpen : !isSidepanelOpen;
    setIsSidepanelOpen(shouldOpen);
    try {
      await pywebviewService.resizeWindow(shouldOpen);
    } catch (e) {
      console.error('Failed to resize window:', e);
    }
  };

  // Click on a highlighted text in chat
  const handleHighlightClick = (hl: HighlightData) => {
    if (hl.ai_response) {
      // Already has AI response -> open directly in AI Thread
      setActiveThreadHighlightId(hl.id);
      handleToggleSidepanel(true);
    } else {
      // Prompt with floating actions modal
      setActiveHighlightForModal(hl);
    }
  };

  // Floating Actions: 1. Ask AI about...
  const handleModalAskAi = async (hl: HighlightData) => {
    setActiveHighlightForModal(null);
    setActiveThreadHighlightId(hl.id);
    setIsLoadingAi(true);
    await handleToggleSidepanel(true);

    if (activeSession) {
      await pywebviewService.askAiAboutHighlight(activeSession.id, hl.id, hl.text);
    }
  };

  // Floating Actions: 2. Copy to Clipboard
  const handleModalCopy = async (hl: HighlightData) => {
    setActiveHighlightForModal(null);
    await pywebviewService.copyToClipboard(hl.text);
  };

  // Floating Actions: 3. Save for later
  const handleModalSaveForLater = async (hl: HighlightData) => {
    setActiveHighlightForModal(null);
    const updated = { ...hl, is_saved: true };
    setHighlights((prev) => prev.map((h) => (h.id === hl.id ? updated : h)));
    if (activeSession) {
      await pywebviewService.saveHighlight(activeSession.id, updated);
    }
  };

  // Jump to transcript message and highlight briefly
  const handleJumpToTranscript = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-purple-950/40', 'border-purple-500/60');
      setTimeout(() => {
        el.classList.remove('bg-purple-950/40', 'border-purple-500/60');
      }, 2000);
    }
  };

  // Delete highlight
  const handleDeleteHighlight = (highlightId: string) => {
    setHighlights((prev) => {
      const next = prev.filter((h) => h.id !== highlightId);
      if (activeSession) {
        pywebviewService.saveSession(activeSession.id, activeSession.title, activeSession.notes || '', messages);
      }
      return next;
    });
    if (activeThreadHighlightId === highlightId) {
      setActiveThreadHighlightId(null);
    }
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      type: 'user',
      timestamp: Date.now() / 1000,
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const resp = await pywebviewService.sendUserMessage(text);
      const asstMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        type: 'assistant',
        timestamp: resp.timestamp || Date.now() / 1000,
        content: resp.content,
        thought: resp.thought,
        action_cards: resp.action_cards,
      };
      setMessages((prev) => [...prev, asstMsg]);
    } catch (e) {
      console.error('Failed to send user message:', e);
    }
  };

  const handleSaveSettings = async (newSettings: Settings) => {
    try {
      const saved = await pywebviewService.saveSettings(newSettings);
      setSettings(saved);
      setAlwaysOnTop(saved.always_on_top ?? true);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleToggleAlwaysOnTop = async () => {
    try {
      const current = await pywebviewService.toggleAlwaysOnTop();
      setAlwaysOnTop(current);
      setSettings((prev) => ({ ...prev, always_on_top: current }));
    } catch (e) {
      console.error('Failed to toggle always on top:', e);
    }
  };

  const savedHighlightsCount = highlights.filter((h) => h.is_saved || h.ai_response).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans border border-zinc-800/80 shadow-2xl">
      {/* TitleBar */}
      <TitleBar
        alwaysOnTop={alwaysOnTop}
        onToggleAlwaysOnTop={handleToggleAlwaysOnTop}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        sidebarOpen={isSidebarOpen}
        isRecording={recordingState.is_recording}
        onToggleSidepanel={() => handleToggleSidepanel()}
        sidepanelOpen={isSidepanelOpen}
        savedCount={savedHighlightsCount}
      />

      {/* Main Workspace Area (HUD + Right Sidepanel) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Navigation Sidebar */}
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSession?.id || null}
          onSelectSession={selectSession}
          onCreateSession={createNewSession}
          onDeleteSession={deleteSession}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Center Unified Chronological Stream */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-950 relative min-w-[340px]">
          <ChatFeed
            title={activeSession?.title || 'New note'}
            onUpdateTitle={handleUpdateTitle}
            messages={messages}
            highlights={highlights}
            onHighlightClick={handleHighlightClick}
            onUpdateCard={handleUpdateCard}
            isRecording={recordingState.is_recording}
          />

          {/* Floating Actions Modal (Antigravity 2.0 style above dock) */}
          {activeHighlightForModal && (
            <FloatingActionsModal
              highlight={activeHighlightForModal}
              onAskAi={handleModalAskAi}
              onCopy={handleModalCopy}
              onSaveForLater={handleModalSaveForLater}
              onDismiss={() => setActiveHighlightForModal(null)}
            />
          )}

          {/* Floating Bottom Control Bar */}
          <ControlBar
            recordingState={recordingState}
            onStartRecord={() => pywebviewService.startRecording(activeSession?.id)}
            onPauseRecord={() => pywebviewService.pauseRecording()}
            onResumeRecord={() => pywebviewService.resumeRecording()}
            onStopRecord={() => pywebviewService.stopRecording()}
            onTriggerIntent={() => pywebviewService.triggerHighlight()}
            onSendMessage={handleSendMessage}
            audioHotkey={settings.audio_intent_hotkey}
          />
        </div>

        {/* Right Sidepanel: Saved Highlights & AI Threads */}
        {isSidepanelOpen && (
          <ThreadSidepanel
            highlights={highlights}
            activeHighlightId={activeThreadHighlightId}
            isLoadingAi={isLoadingAi}
            onSelectHighlight={(hl) => {
              setActiveThreadHighlightId(hl.id);
              if (!hl.ai_response && activeSession) {
                setIsLoadingAi(true);
                pywebviewService.askAiAboutHighlight(activeSession.id, hl.id, hl.text);
              }
            }}
            onBackToHighlights={() => setActiveThreadHighlightId(null)}
            onClose={() => handleToggleSidepanel(false)}
            onJumpToTranscript={handleJumpToTranscript}
            onDeleteHighlight={handleDeleteHighlight}
          />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
};

export default App;
