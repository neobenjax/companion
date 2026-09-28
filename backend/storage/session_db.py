import os
import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_FILE = Path.home() / ".ambient_copilot" / "sessions.db"
BACKUP_DIR = Path.home() / ".ambient_copilot" / "backups"
BACKUP_FILE = BACKUP_DIR / "sessions_backup.json"


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_FILE, timeout=30.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=30000;")
    return conn


def init_db():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL,
                notes TEXT DEFAULT '',
                messages_json TEXT DEFAULT '[]',
                highlights_json TEXT DEFAULT '[]'
            )
        """)
        # Ensure highlights_json exists for previously created databases
        try:
            cursor.execute("ALTER TABLE sessions ADD COLUMN highlights_json TEXT DEFAULT '[]'")
        except sqlite3.OperationalError:
            pass  # already exists
        # Ensure per-session prompt fields exist
        try:
            cursor.execute("ALTER TABLE sessions ADD COLUMN prompt_highlight TEXT DEFAULT NULL")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE sessions ADD COLUMN prompt_image TEXT DEFAULT NULL")
        except sqlite3.OperationalError:
            pass
        conn.commit()


_SENTINEL = object()


class SessionStorage:
    def __init__(self):
        self._lock = threading.Lock()
        self._backup_lock = threading.Lock()
        self._backup_timer: Optional[threading.Timer] = None
        init_db()

    def schedule_backup(self):
        """Debounces JSON backup in a background thread to prevent blocking writes."""
        with self._backup_lock:
            if self._backup_timer:
                self._backup_timer.cancel()
            self._backup_timer = threading.Timer(2.0, self._run_backup_async)
            self._backup_timer.daemon = True
            self._backup_timer.start()

    def _run_backup_async(self):
        try:
            self.backup_to_json()
        except Exception as e:
            print(f"[SessionStorage] Async backup note: {e}")

    def backup_to_json(self):
        """Creates a readable JSON backup of all sessions and messages."""
        try:
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, title, created_at, updated_at, notes, messages_json, highlights_json, prompt_highlight, prompt_image FROM sessions ORDER BY created_at DESC"
                )
                rows = cursor.fetchall()
                data = [
                    {
                        "id": r[0],
                        "title": r[1],
                        "created_at": r[2],
                        "updated_at": r[3],
                        "notes": r[4],
                        "messages": json.loads(r[5] or "[]"),
                        "highlights": json.loads(r[6] or "[]"),
                        "prompt_highlight": r[7] if len(r) > 7 else None,
                        "prompt_image": r[8] if len(r) > 8 else None,
                    }
                    for r in rows
                ]
            tmp_file = BACKUP_FILE.with_suffix(".tmp")
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            tmp_file.replace(BACKUP_FILE)
        except Exception as e:
            print(f"[SessionStorage] Warning: Failed to backup sessions to JSON: {e}")

    def create_session(
        self,
        title: str = "New note",
        prompt_highlight: Optional[str] = None,
        prompt_image: Optional[str] = None,
    ) -> Dict[str, Any]:
        session_id = f"sess_{int(time.time() * 1000)}"
        now = time.time()
        with self._lock:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO sessions (id, title, created_at, updated_at, notes, messages_json, highlights_json, prompt_highlight, prompt_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (session_id, title, now, now, "", json.dumps([]), json.dumps([]), prompt_highlight, prompt_image),
                )
                conn.commit()
        self.backup_to_json()
        return {
            "id": session_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "notes": "",
            "messages": [],
            "highlights": [],
            "prompt_highlight": prompt_highlight,
            "prompt_image": prompt_image,
        }

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, title, created_at, updated_at, notes, messages_json, highlights_json, prompt_highlight, prompt_image FROM sessions WHERE id = ?",
                (session_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "id": row[0],
                "title": row[1],
                "created_at": row[2],
                "updated_at": row[3],
                "notes": row[4],
                "messages": json.loads(row[5] or "[]"),
                "highlights": json.loads(row[6] or "[]"),
                "prompt_highlight": row[7] if len(row) > 7 and row[7] is not None else "",
                "prompt_image": row[8] if len(row) > 8 and row[8] is not None else "",
            }

    def list_sessions(self) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, title, created_at, updated_at, notes, prompt_highlight, prompt_image FROM sessions ORDER BY updated_at DESC, created_at DESC"
            )
            rows = cursor.fetchall()
            return [
                {
                    "id": r[0],
                    "title": r[1],
                    "created_at": r[2],
                    "updated_at": r[3],
                    "notes_preview": (r[4] or "")[:80],
                    "has_custom_prompts": bool((r[5] and r[5].strip()) or (r[6] and r[6].strip())),
                }
                for r in rows
            ]

    def update_session(
        self,
        session_id: str,
        title: Optional[str] = None,
        notes: Optional[str] = None,
        messages: Optional[List[Dict[str, Any]]] = None,
        highlights: Optional[List[Dict[str, Any]]] = None,
        prompt_highlight: Any = _SENTINEL,
        prompt_image: Any = _SENTINEL,
    ) -> bool:
        now = time.time()
        updates = ["updated_at = ?"]
        params = [now]
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if notes is not None:
            updates.append("notes = ?")
            params.append(notes)
        if messages is not None:
            updates.append("messages_json = ?")
            params.append(json.dumps(messages))
        if highlights is not None:
            updates.append("highlights_json = ?")
            params.append(json.dumps(highlights))
        if prompt_highlight is not _SENTINEL:
            updates.append("prompt_highlight = ?")
            params.append(prompt_highlight)
        if prompt_image is not _SENTINEL:
            updates.append("prompt_image = ?")
            params.append(prompt_image)
        params.append(session_id)

        with self._lock:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                query = f"UPDATE sessions SET {', '.join(updates)} WHERE id = ?"
                cursor.execute(query, params)
                conn.commit()
                success = cursor.rowcount > 0
        if success:
            self.backup_to_json()
        return success

    def add_or_update_highlight(self, session_id: str, highlight: Dict[str, Any]) -> List[Dict[str, Any]]:
        sess = self.get_session(session_id)
        if not sess:
            return []
        current = sess.get("highlights", [])
        h_id = highlight.get("id")
        replaced = False
        for idx, h in enumerate(current):
            if h.get("id") == h_id:
                current[idx] = {**h, **highlight}
                replaced = True
                break
        if not replaced:
            current.append(highlight)
        self.update_session(session_id, highlights=current)
        return current

    def delete_highlight(self, session_id: str, highlight_id: str) -> List[Dict[str, Any]]:
        sess = self.get_session(session_id)
        if not sess:
            return []
        current = sess.get("highlights", [])
        updated = [h for h in current if h.get("id") != highlight_id]
        self.update_session(session_id, highlights=updated)
        return updated

    def get_highlights(self, session_id: str) -> List[Dict[str, Any]]:
        sess = self.get_session(session_id)
        if not sess:
            return []
        return sess.get("highlights", [])

    def delete_session(self, session_id: str) -> bool:
        with self._lock:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
                conn.commit()
                success = cursor.rowcount > 0
        if success:
            self.backup_to_json()
        return success
