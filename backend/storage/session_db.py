import os
import json
import sqlite3
import time
from pathlib import Path
from typing import List, Dict, Any, Optional

DB_FILE = Path.home() / ".ambient_copilot" / "sessions.db"


def init_db():
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_FILE) as conn:
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
        conn.commit()


class SessionStorage:
    def __init__(self):
        init_db()

    def create_session(self, title: str = "New note") -> Dict[str, Any]:
        session_id = f"sess_{int(time.time() * 1000)}"
        now = time.time()
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO sessions (id, title, created_at, updated_at, notes, messages_json, highlights_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (session_id, title, now, now, "", json.dumps([]), json.dumps([])),
            )
            conn.commit()
        return {
            "id": session_id,
            "title": title,
            "created_at": now,
            "updated_at": now,
            "notes": "",
            "messages": [],
            "highlights": [],
        }

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, title, created_at, updated_at, notes, messages_json, highlights_json FROM sessions WHERE id = ?",
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
            }

    def list_sessions(self) -> List[Dict[str, Any]]:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, title, created_at, updated_at, notes FROM sessions ORDER BY created_at DESC"
            )
            rows = cursor.fetchall()
            return [
                {
                    "id": r[0],
                    "title": r[1],
                    "created_at": r[2],
                    "updated_at": r[3],
                    "notes_preview": (r[4] or "")[:80],
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
        params.append(session_id)

        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            query = f"UPDATE sessions SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(query, params)
            conn.commit()
            return cursor.rowcount > 0

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

    def get_highlights(self, session_id: str) -> List[Dict[str, Any]]:
        sess = self.get_session(session_id)
        if not sess:
            return []
        return sess.get("highlights", [])

    def delete_session(self, session_id: str) -> bool:
        with sqlite3.connect(DB_FILE) as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            conn.commit()
            return cursor.rowcount > 0
