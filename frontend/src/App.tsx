import React, { useState, useEffect, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { ChatFeed } from './components/ChatFeed';
import { ControlBar } from './components/ControlBar';
import { SettingsModal } from './components/SettingsModal';
import { FloatingActionsModal } from './components/FloatingActionsModal';
import { ThreadSidepanel } from './components/ThreadSidepanel';
import { TargetPickerPopover } from './components/TargetPickerPopover';
import { SessionPromptModal } from './components/SessionPromptModal';
import {
  ChatMessage,
  Session,
  Settings,
  RecordingState,
  ActionCardData,
  TranscriptSegment,
  HighlightData,
  CaptureTarget,
  ScreenshotData,
} from './types';
import { pywebviewService } from './services/pywebview';

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [highlights, setHighlights] = useState<HighlightData[]>([]);
  const [activeHighlightForModal, setActiveHighlightForModal] = useState<HighlightData | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<CaptureTarget | null>(null);
  const [isTargetPickerOpen, setIsTargetPickerOpen] = useState(false);
  const [activeScreenshotForModal, setActiveScreenshotForModal] = useState<ScreenshotData | null>(null);
  const [activeThreadScreenshot, setActiveThreadScreenshot] = useState<ScreenshotData | null>(null);
  const [isSidepanelOpen, setIsSidepanelOpen] = useState(false);
  const [activeThreadHighlightId, setActiveThreadHighlightId] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const DEFAULT_SIDEPANEL_WIDTH = 420;
  const [sidepanelWidth, setSidepanelWidth] = useState<number>(DEFAULT_SIDEPANEL_WIDTH);
  const [speechActivity, setSpeechActivity] = useState<{ is_speaking: boolean; speaker: string }>({
    is_speaking: false,
    speaker: 'me',
  });

  // App Opacity (50% to 100%)
  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('companion_opacity');
    return saved ? Math.max(0.5, Math.min(1.0, parseFloat(saved))) : 1.0;
  });

  // Independent Font Sizes (Transcript & Sidepanel)
  const [chatFontSize, setChatFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('companion_chat_font_size');
    return saved ? Math.max(11, Math.min(22, parseInt(saved, 10))) : 12;
  });
  const [sidepanelFontSize, setSidepanelFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('companion_sidepanel_font_size');
    return saved ? Math.max(11, Math.min(22, parseInt(saved, 10))) : 13;
  });

  // Per-Session AI Prompt Modal State
  const [isPromptsModalOpen, setIsPromptsModalOpen] = useState<boolean>(false);
  const [defaultPrompts, setDefaultPrompts] = useState<{ highlight: string; image: string }>({
    highlight: '',
    image: '',
  });

  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  const [recordingState, setRecordingState] = useState<RecordingState>({
    is_recording: false,
    is_paused: false,
  });
  const [settings, setSettings] = useState<Settings>({
    audio_intent_hotkey: '<ctrl>+<shift>+a',
    vision_intent_hotkey: '<ctrl>+<shift>+v',
    lookback_duration_sec: 10,
    lookback_words: 50,
    whisper_model: 'small.en',
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
  const isInitializingRef = useRef<boolean>(false);
  const isLoadedRef = useRef<boolean>(false);

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

  // Continuous debounced auto-save (500ms) for active session messages, highlights, and prompts
  useEffect(() => {
    if (!activeSession?.id) return;
    const timer = setTimeout(() => {
      pywebviewService.saveSession(
        activeSession.id,
        activeSession.title,
        activeSession.notes || '',
        messages,
        highlights,
        activeSession.prompt_highlight,
        activeSession.prompt_image
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, highlights, activeSession?.id, activeSession?.title, activeSession?.notes, activeSession?.prompt_highlight, activeSession?.prompt_image]);

  // Flush save on window unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (activeSessionRef.current) {
        pywebviewService.saveSession(
          activeSessionRef.current.id,
          activeSessionRef.current.title,
          activeSessionRef.current.notes || '',
          messagesRef.current,
          highlightsRef.current,
          activeSessionRef.current.prompt_highlight,
          activeSessionRef.current.prompt_image
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

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
      if (!state.is_recording) {
        setSpeechActivity({ is_speaking: false, speaker: 'me' });
      }
    });

    const unsubSpeechActivity = pywebviewService.onSpeechActivity((activity) => {
      setSpeechActivity(activity);
    });

    // Event listener: New screenshot captured
    const unsubScreenshot = pywebviewService.onScreenshot((data: ScreenshotData) => {
      setMessages((prev) => {
        const next: ChatMessage[] = [
          ...prev,
          {
            id: `msg_shot_${data.id}`,
            type: 'screenshot',
            timestamp: data.timestamp,
            screenshot: data,
          },
        ];
        if (activeSessionRef.current) {
          pywebviewService.saveSession(
            activeSessionRef.current.id,
            activeSessionRef.current.title,
            activeSessionRef.current.notes || '',
            next
          );
        }
        return next;
      });
      setActiveScreenshotForModal(data);
    });

    // Event listener: Vision AI analysis response
    const unsubVisionAi = pywebviewService.onVisionAi((data: any) => {
      setIsLoadingAi(false);
      setMessages((prev) => {
        const next = prev.map((m) => {
          if (m.type === 'screenshot' && m.screenshot && m.screenshot.id === data.image_id) {
            return {
              ...m,
              screenshot: {
                ...m.screenshot,
                ai_response: data.ai_response,
                thought: data.thought,
              },
            };
          }
          return m;
        });
        if (activeSessionRef.current) {
          pywebviewService.saveSession(
            activeSessionRef.current.id,
            activeSessionRef.current.title,
            activeSessionRef.current.notes || '',
            next
          );
        }
        return next;
      });
      setActiveThreadScreenshot((prev) => {
        if (prev && prev.id === data.image_id) {
          return {
            ...prev,
            ai_response: data.ai_response,
            thought: data.thought,
          };
        }
        return prev;
      });
    });

    // Event listener: Screenshot capture error (e.g. no target selected)
    const unsubScreenshotError = pywebviewService.onScreenshotError((data: { message: string }) => {
      console.warn('Screenshot error:', data.message);
      setIsTargetPickerOpen(true);
    });

    return () => {
      unsubTranscript();
      unsubSpeechActivity();
      unsubTriggerHighlight();
      unsubHighlightAi();
      unsubState();
      unsubScreenshot();
      unsubVisionAi();
      unsubScreenshotError();
    };
  }, []);

  const loadInitialData = async () => {
    if (isInitializingRef.current || isLoadedRef.current) {
      return;
    }
    isInitializingRef.current = true;

    try {
      const bridgeConnected = await pywebviewService.waitForBridge(12000);
      if (!bridgeConnected) {
        console.warn('[App] pywebview bridge did not report ready within timeout');
      }

      const s = await pywebviewService.getSettings();
      setSettings(s);
      setAlwaysOnTop(s.always_on_top ?? true);

      // Load default prompt templates from backend
      try {
        const defPrompts = await pywebviewService.getDefaultPrompts();
        if (defPrompts) {
          setDefaultPrompts(defPrompts);
        }
      } catch (err) {
        console.warn('Could not fetch default prompts:', err);
      }

      // Query sessions from database
      const sessList = await pywebviewService.getSessions();
      setSessions(sessList);

      if (sessList && sessList.length > 0) {
        // Priority 1: Restore user's last active chat from localStorage if it exists
        const lastActiveId = localStorage.getItem('companion_active_session_id');
        const matched = lastActiveId ? sessList.find((sess) => sess.id === lastActiveId) : null;

        // Priority 2: Session with content or the newest session in the list
        const sessionToOpen =
          matched ||
          sessList.find((sess) => (sess.notes_preview || '').length > 0) ||
          sessList[0];

        await selectSession(sessionToOpen.id);
      } else if (bridgeConnected) {
        // Only create a brand new session if bridge is verified connected and DB is truly empty
        await createNewSession();
      }

      // Restore and apply saved opacity AFTER sessions have loaded
      const savedOp = localStorage.getItem('companion_opacity');
      const targetOp = savedOp ? parseFloat(savedOp) : (s.window_opacity ?? 1.0);
      const clampedOp = Math.max(0.5, Math.min(1.0, targetOp));
      setOpacity(clampedOp);
      if (clampedOp < 1.0) {
        // Only make the native IPC call if non-default opacity is configured
        pywebviewService.setWindowOpacity(clampedOp);
      }

      isLoadedRef.current = true;
    } catch (e) {
      console.error('Failed to load initial data:', e);
    } finally {
      isInitializingRef.current = false;
      setIsInitializing(false);
    }
  };

  const handleOpacityChange = (val: number) => {
    const clamped = Math.max(0.5, Math.min(1.0, val));
    setOpacity(clamped);
    localStorage.setItem('companion_opacity', String(clamped));
    pywebviewService.setWindowOpacity(clamped);
  };

  const handleChatFontSizeChange = (size: number) => {
    const clamped = Math.max(11, Math.min(22, size));
    setChatFontSize(clamped);
    localStorage.setItem('companion_chat_font_size', String(clamped));
  };

  const handleSidepanelFontSizeChange = (size: number) => {
    const clamped = Math.max(11, Math.min(22, size));
    setSidepanelFontSize(clamped);
    localStorage.setItem('companion_sidepanel_font_size', String(clamped));
  };

  const handleSavePrompts = async (promptHighlight: string, promptImage: string) => {
    if (!activeSession) return;
    const hasCustom = Boolean(promptHighlight.trim() || promptImage.trim());
    const updated: Session = {
      ...activeSession,
      prompt_highlight: promptHighlight,
      prompt_image: promptImage,
      has_custom_prompts: hasCustom,
    };
    setActiveSession(updated);
    setSessions((prev) =>
      prev.map((s) =>
        s.id === updated.id
          ? { ...s, prompt_highlight: promptHighlight, prompt_image: promptImage, has_custom_prompts: hasCustom }
          : s
      )
    );
    await pywebviewService.saveSession(
      updated.id,
      updated.title,
      updated.notes || '',
      messagesRef.current,
      highlightsRef.current,
      promptHighlight,
      promptImage
    );
  };

  const createNewSession = async () => {
    try {
      setIsSidebarOpen(false);
      // Flush-save current note before creating a new session
      if (activeSessionRef.current) {
        await pywebviewService.saveSession(
          activeSessionRef.current.id,
          activeSessionRef.current.title,
          activeSessionRef.current.notes || '',
          messagesRef.current,
          highlightsRef.current,
          activeSessionRef.current.prompt_highlight,
          activeSessionRef.current.prompt_image
        );
      }
      const newSess = await pywebviewService.createSession('New note');
      setSessions((prev) => [newSess, ...prev]);
      setActiveSession(newSess);
      localStorage.setItem('companion_active_session_id', newSess.id);
      setMessages([]);
      setHighlights([]);
      setActiveHighlightForModal(null);
      setActiveScreenshotForModal(null);
      setActiveThreadHighlightId(null);
      setActiveThreadScreenshot(null);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const selectSession = async (id: string) => {
    try {
      setIsSidebarOpen(false);
      if (!id) return;
      if (activeSessionRef.current?.id === id) {
        return; // Already viewing this session
      }

      // Flush-save current active session before switching
      if (activeSessionRef.current) {
        await pywebviewService.saveSession(
          activeSessionRef.current.id,
          activeSessionRef.current.title,
          activeSessionRef.current.notes || '',
          messagesRef.current,
          highlightsRef.current,
          activeSessionRef.current.prompt_highlight,
          activeSessionRef.current.prompt_image
        );
      }

      const sess = await pywebviewService.getSession(id);
      if (sess) {
        setActiveSession(sess);
        localStorage.setItem('companion_active_session_id', id);
        setMessages(sess.messages || []);
        setHighlights(sess.highlights || []);
        setActiveHighlightForModal(null);
        setActiveScreenshotForModal(null);
        setActiveThreadHighlightId(null);
        setActiveThreadScreenshot(null);
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
    pywebviewService.saveSession(
      updated.id,
      newTitle,
      updated.notes || '',
      messages,
      highlightsRef.current,
      updated.prompt_highlight,
      updated.prompt_image
    );
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
    const cleanText = (lastMsg.content || '').replace(/^\[(CALLER|ME)\]:\s*/i, '').trim();
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
  const handleToggleSidepanel = async (forcedOpen?: boolean, resetToDefault = false) => {
    const shouldOpen = forcedOpen !== undefined ? forcedOpen : !isSidepanelOpen;
    setIsSidepanelOpen(shouldOpen);
    if (resetToDefault || !shouldOpen) {
      setSidepanelWidth(DEFAULT_SIDEPANEL_WIDTH);
    }
    const currentW = resetToDefault ? DEFAULT_SIDEPANEL_WIDTH : sidepanelWidth;
    try {
      await pywebviewService.resizeWindow(shouldOpen, shouldOpen ? 540 + currentW : 560);
    } catch (e) {
      console.error('Failed to resize window:', e);
    }
  };

  // Manual text selection highlight from context menu
  const handleManualHighlight = (
    messageId: string,
    text: string,
    speaker: 'caller' | 'me',
    timestamp: number
  ) => {
    const newHighlight: HighlightData = {
      id: `hl_${Date.now()}`,
      messageId,
      text: text.trim(),
      speaker: speaker || 'caller',
      timestamp: timestamp || Date.now() / 1000,
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

  // Click on a highlighted text in chat - ALWAYS prompt with floating actions modal
  const handleHighlightClick = (hl: HighlightData) => {
    setActiveHighlightForModal(hl);
  };

  // Floating Actions: 1. Ask AI about... (opens sidepanel at default width)
  const handleModalAskAi = async (hl: HighlightData) => {
    setActiveHighlightForModal(null);
    setActiveThreadHighlightId(hl.id);
    setActiveThreadScreenshot(null);
    setIsLoadingAi(true);
    await handleToggleSidepanel(true, true);

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

  // Target selection and screenshot handling
  const handleSelectTarget = async (target: CaptureTarget) => {
    setSelectedTarget(target);
    setIsTargetPickerOpen(false);
    try {
      await pywebviewService.setSelectedTarget(target);
    } catch (e) {
      console.error('Failed to set target:', e);
    }
  };

  const handleTakeScreenshot = async () => {
    if (!selectedTarget) {
      setIsTargetPickerOpen(true);
      return;
    }
    try {
      await pywebviewService.captureSelectedTarget(selectedTarget);
    } catch (e) {
      console.error('Failed to capture selected target:', e);
    }
  };

  // Click on a screenshot thumbnail in chat - ALWAYS prompt with floating actions modal
  const handleScreenshotClick = (shot: ScreenshotData) => {
    setActiveScreenshotForModal(shot);
  };

  const handleScreenshotAskAi = async (shot: ScreenshotData) => {
    setActiveScreenshotForModal(null);
    setActiveThreadScreenshot(shot);
    setActiveThreadHighlightId(null);
    setIsLoadingAi(true);
    await handleToggleSidepanel(true, true);

    if (activeSession) {
      await pywebviewService.explainImageWithAi(
        activeSession.id,
        shot.id,
        shot.image_path,
        '',
        shot.target_title
      );
    }
  };

  const handleScreenshotCopy = async (shot: ScreenshotData) => {
    setActiveScreenshotForModal(null);
    await pywebviewService.copyImageToClipboard(shot.image_path);
  };

  const handleScreenshotDelete = async (shot: ScreenshotData) => {
    setActiveScreenshotForModal(null);
    if (activeThreadScreenshot?.id === shot.id) {
      setActiveThreadScreenshot(null);
      handleToggleSidepanel(false);
    }

    setMessages((prev) => {
      const next = prev.filter((m) => !(m.type === 'screenshot' && m.screenshot?.id === shot.id));
      if (activeSessionRef.current) {
        pywebviewService.saveSession(
          activeSessionRef.current.id,
          activeSessionRef.current.title,
          activeSessionRef.current.notes || '',
          next,
          highlightsRef.current,
          activeSessionRef.current.prompt_highlight,
          activeSessionRef.current.prompt_image
        );
      }
      return next;
    });

    try {
      await pywebviewService.deleteScreenshot(shot.id, shot.image_path);
    } catch (e) {
      console.error('Failed to delete screenshot:', e);
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
  const handleDeleteHighlight = async (highlightId: string) => {
    const next = highlights.filter((h) => h.id !== highlightId);
    setHighlights(next);
    if (activeThreadHighlightId === highlightId) {
      setActiveThreadHighlightId(null);
    }
    if (activeSessionRef.current) {
      try {
        await pywebviewService.deleteHighlight(activeSessionRef.current.id, highlightId);
      } catch (e) {
        console.error('Failed to delete highlight:', e);
      }
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
      {/* TitleBar with Opacity Slider */}
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
        opacity={opacity}
        onOpacityChange={handleOpacityChange}
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
          {isInitializing && !activeSession ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3 select-none text-zinc-500">
              <div className="w-7 h-7 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
              <p className="text-xs font-medium text-zinc-400">Loading Ambient Copilot...</p>
            </div>
          ) : (
            <ChatFeed
              title={activeSession?.title || 'New note'}
              onUpdateTitle={handleUpdateTitle}
              messages={messages}
              highlights={highlights}
              onHighlightClick={handleHighlightClick}
              onManualHighlight={handleManualHighlight}
              onScreenshotClick={handleScreenshotClick}
              onUpdateCard={handleUpdateCard}
              isRecording={recordingState.is_recording}
              speechActivity={speechActivity}
              fontSize={chatFontSize}
              onFontSizeChange={handleChatFontSizeChange}
              hasCustomPrompts={Boolean(activeSession?.prompt_highlight?.trim() || activeSession?.prompt_image?.trim())}
              onOpenPromptsModal={() => setIsPromptsModalOpen(true)}
            />
          )}

          {/* Floating Actions Modal (Screenshot) */}
          {activeScreenshotForModal && (
            <FloatingActionsModal
              screenshot={activeScreenshotForModal}
              onAskAi={(item) => handleScreenshotAskAi(item as ScreenshotData)}
              onViewAiThread={(item) => {
                setActiveScreenshotForModal(null);
                setActiveThreadScreenshot(item as ScreenshotData);
                setActiveThreadHighlightId(null);
                handleToggleSidepanel(true, true);
              }}
              onCopy={(item) => handleScreenshotCopy(item as ScreenshotData)}
              onDeleteScreenshot={handleScreenshotDelete}
              onDismiss={() => setActiveScreenshotForModal(null)}
            />
          )}

          {/* Floating Actions Modal (Highlight) */}
          {activeHighlightForModal && (
            <FloatingActionsModal
              highlight={activeHighlightForModal}
              onAskAi={(item) => handleModalAskAi(item as HighlightData)}
              onViewAiThread={(item) => {
                setActiveHighlightForModal(null);
                setActiveThreadHighlightId((item as HighlightData).id);
                setActiveThreadScreenshot(null);
                handleToggleSidepanel(true, true);
              }}
              onCopy={(item) => handleModalCopy(item as HighlightData)}
              onSaveForLater={handleModalSaveForLater}
              onDeselectHighlight={(hl) => {
                setActiveHighlightForModal(null);
                handleDeleteHighlight(hl.id);
              }}
              onDismiss={() => setActiveHighlightForModal(null)}
            />
          )}

          {/* Target Picker Popover */}
          {isTargetPickerOpen && (
            <TargetPickerPopover
              selectedTarget={selectedTarget}
              onSelectTarget={handleSelectTarget}
              onClose={() => setIsTargetPickerOpen(false)}
            />
          )}

          {/* Floating Bottom Control Bar */}
          <ControlBar
            recordingState={recordingState}
            onStartRecord={() => pywebviewService.startRecording(activeSession?.id)}
            onPauseRecord={() => pywebviewService.pauseRecording()}
            onResumeRecord={() => pywebviewService.resumeRecording()}
            onStopRecord={() => pywebviewService.stopRecording()}
            onTriggerHighlight={() => pywebviewService.triggerHighlight()}
            audioHotkey={settings.audio_intent_hotkey}
            visionHotkey={settings.vision_intent_hotkey}
            selectedTarget={selectedTarget}
            onOpenTargetPicker={() => setIsTargetPickerOpen(!isTargetPickerOpen)}
            onTakeScreenshot={handleTakeScreenshot}
          />
        </div>

        {/* Right Sidepanel: Saved Highlights & AI Threads */}
        {isSidepanelOpen && (
          <ThreadSidepanel
            highlights={highlights}
            activeHighlightId={activeThreadHighlightId}
            activeScreenshot={activeThreadScreenshot}
            isLoadingAi={isLoadingAi}
            sessionTitle={activeSession?.title || 'New note'}
            width={sidepanelWidth}
            onResize={(w) => setSidepanelWidth(w)}
            onResizeEnd={(w) => {
              setSidepanelWidth(w);
              pywebviewService.resizeWindow(true, 540 + w);
            }}
            fontSize={sidepanelFontSize}
            onFontSizeChange={handleSidepanelFontSizeChange}
            hasCustomPrompts={Boolean(activeSession?.prompt_highlight?.trim() || activeSession?.prompt_image?.trim())}
            onOpenPromptsModal={() => setIsPromptsModalOpen(true)}
            onSelectHighlight={(hl) => {
              setActiveThreadScreenshot(null);
              setActiveThreadHighlightId(hl.id);
              if (!hl.ai_response && activeSession) {
                setIsLoadingAi(true);
                pywebviewService.askAiAboutHighlight(activeSession.id, hl.id, hl.text);
              }
            }}
            onBackToHighlights={() => {
              setActiveThreadHighlightId(null);
              setActiveThreadScreenshot(null);
            }}
            onClose={() => {
              handleToggleSidepanel(false);
              setActiveThreadScreenshot(null);
            }}
            onJumpToTranscript={handleJumpToTranscript}
            onDeleteHighlight={handleDeleteHighlight}
            onAskVisionFollowup={(shot, prompt) => {
              setIsLoadingAi(true);
              if (activeSession) {
                pywebviewService.explainImageWithAi(
                  activeSession.id,
                  shot.id,
                  shot.image_path,
                  prompt,
                  shot.target_title
                );
              }
            }}
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

      {/* Per-Session AI Prompt Modal */}
      <SessionPromptModal
        isOpen={isPromptsModalOpen}
        onClose={() => setIsPromptsModalOpen(false)}
        session={activeSession}
        onSavePrompts={handleSavePrompts}
        defaultPrompts={defaultPrompts}
      />
    </div>
  );
};

export default App;
