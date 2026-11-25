import { useCallback, useEffect, useState } from 'react';

export interface ExecResult { kind: string; title: string; detail: string; rows?: { label: string; value: string }[] }

export interface SessionEntry {
  prompt: string;
  reply: string;
  offline: boolean;
  results: ExecResult[];
  timestamp: number;
}

export interface ConversationSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  entries: SessionEntry[];
}

const STORAGE_KEY = 'cadence-sessions-v1';

function loadSessions(): ConversationSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ConversationSession[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

function saveSessions(sessions: ConversationSession[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); } catch { /* ignore */ }
}

function makeId(): string {
  return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function makeTitle(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 40) return trimmed;
  return trimmed.slice(0, 37) + '...';
}

export function useSessions() {
  const [sessions, setSessions] = useState<ConversationSession[]>(() => loadSessions());
  const [activeId, setActiveId] = useState<string | null>(() => {
    const loaded = loadSessions();
    return loaded.length > 0 ? loaded[0].id : null;
  });

  useEffect(() => { saveSessions(sessions); }, [sessions]);

  const createSession = useCallback((): string => {
    const id = makeId();
    const now = Date.now();
    const session: ConversationSession = { id, title: 'New conversation', createdAt: now, updatedAt: now, entries: [] };
    setSessions((prev) => [session, ...prev]);
    setActiveId(id);
    return id;
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveId((cur) => cur === id ? (next[0]?.id ?? null) : cur);
      return next;
    });
  }, []);

  const appendEntry = useCallback((id: string, entry: SessionEntry) => {
    setSessions((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const isFirst = s.entries.length === 0;
      return {
        ...s,
        title: isFirst ? makeTitle(entry.prompt) : s.title,
        entries: [...s.entries, entry],
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  return { sessions, activeId, activeSession, setActiveId, createSession, deleteSession, appendEntry };
}

export function exportSessionJSON(session: ConversationSession) {
  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cadence-session-${session.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
