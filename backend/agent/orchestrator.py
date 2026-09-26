import os
import re
import time
from typing import Dict, Any, List, Optional
from backend.agent.tools import execute_math, execute_tool


class AgentOrchestrator:
    def __init__(self, api_key: str = ""):
        self.api_key = api_key
        self._sdk_agent = None
        self._init_sdk_agent()

    def set_api_key(self, api_key: str):
        self.api_key = api_key
        self._init_sdk_agent()

    def _init_sdk_agent(self):
        if not self.api_key:
            self._sdk_agent = None
            return

        try:
            from google import antigravity
            print("[AgentOrchestrator] Initializing Google Antigravity Agent...")
            # Configure Antigravity Agent
            endpoint = antigravity.GeminiAPIEndpoint(api_key=self.api_key)
            config = antigravity.AgentConfig(
                model=antigravity.ModelTarget(
                    endpoint=endpoint,
                    model_type="gemini-2.5-flash",
                ),
                system_instructions="You are an ambient multimodal Windows Copilot companion inspired by Granola and Antigravity 2.0. "
                                    "When given an excerpt of speech or user text, answer the explicit question, math calculation, "
                                    "or action item concisely and directly. If the query involves a calculation, web search, or task, "
                                    "provide clear answers and suggest action proposals.",
            )
            self._sdk_agent = antigravity.Agent(config)
            print("[AgentOrchestrator] Google Antigravity Agent initialized.")
        except Exception as e:
            print(f"[AgentOrchestrator] Could not init Antigravity SDK: {e}. Falling back to GenAI/Local.")
            try:
                from google import genai
                self._sdk_agent = genai.Client(api_key=self.api_key)
            except Exception as ge:
                print(f"[AgentOrchestrator] GenAI fallback failed: {ge}")
                self._sdk_agent = None

    def analyze_intent(self, text_excerpt: str, is_hotkey: bool = True, segment_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Processes either an audio lookback excerpt or a direct user text prompt.
        Returns:
            - thought: Reasoning trace (Antigravity 2.0 style)
            - content: Final assistant response in markdown
            - action_cards: List of actionable proposal cards
            - highlight_segment_ids: IDs of transcript segments to highlight in UI
        """
        now = time.time()
        action_cards = []
        thought = ""
        content = ""

        # Check for math or calculation intent first for ultra-fast response
        math_match = re.search(r"(\d+[\s\.\d]*)\s*(times|x|\*|\+|\-|\/|divided by|plus|minus)\s*(\d+[\s\.\d]*)", text_excerpt, re.IGNORECASE)
        
        if math_match:
            op_str = math_match.group(2).lower()
            op_map = {"times": "*", "x": "*", "plus": "+", "minus": "-", "divided by": "/"}
            clean_op = op_map.get(op_str, op_str)
            expr = f"{math_match.group(1)} {clean_op} {math_match.group(3)}"
            math_res = execute_math(expr)
            if "result" in math_res:
                ans = math_res["result"]
                # Format integer if float is whole
                if isinstance(ans, float) and ans.is_integer():
                    ans = int(ans)
                thought = f"Identified mathematical computation in transcript: '{expr}'. Computed result = {ans}."
                content = f"**Calculation Result:**\n\n$$\\mathbf{{{expr.replace('*', r'\times')}}} = \\mathbf{{{ans}}}$$"
                action_cards.append({
                    "actionId": f"act_{int(now * 1000)}_1",
                    "title": f"Copy Result ({ans})",
                    "description": f"Copy calculated value {ans} to Windows clipboard",
                    "toolName": "copy_clipboard",
                    "parameters": {"text": str(ans)},
                    "status": "pending",
                })
                action_cards.append({
                    "actionId": f"act_{int(now * 1000)}_2",
                    "title": "Insert into Note",
                    "description": f"Append '{expr} = {ans}' to active session notes",
                    "toolName": "insert_note",
                    "parameters": {"text": f"{expr} = {ans}"},
                    "status": "pending",
                })
                return {
                    "thought": thought,
                    "content": content,
                    "action_cards": action_cards,
                    "highlight_segment_ids": segment_ids or [],
                }

        # If Antigravity SDK or Gemini API is available
        if self._sdk_agent:
            try:
                thought = "Analyzing speech context via Google Antigravity Agent..."
                prompt = (
                    "You are an ambient Copilot embedded in a live meeting (like Granola and Antigravity 2.0).\n"
                    "The user triggered an intent on the following conversation excerpt:\n"
                    f'"""\n{text_excerpt}\n"""\n\n'
                    "TASK:\n"
                    "1. Detect the core question, query, confusion, calculation, or task in the excerpt (especially from the latest speaker).\n"
                    "2. Answer directly and concisely in markdown. Explain terms, solve calculations, or clarify concepts immediately.\n"
                    "3. Do NOT repeat the full transcript. Start directly with the answer/explanation."
                )

                # Try calling SDK
                if hasattr(self._sdk_agent, "generate_content"):
                    resp = self._sdk_agent.generate_content(
                        model="gemini-2.5-flash",
                        contents=prompt,
                    )
                    content = resp.text
                elif hasattr(self._sdk_agent, "models"):
                    resp = self._sdk_agent.models.generate_content(
                        model="gemini-2.5-flash",
                        contents=prompt,
                    )
                    content = resp.text
                else:
                    content = str(self._sdk_agent)

                action_cards.append({
                    "actionId": f"act_{int(now * 1000)}_copy",
                    "title": "Copy Answer",
                    "description": "Copy agent response to clipboard",
                    "toolName": "copy_clipboard",
                    "parameters": {"text": content},
                    "status": "pending",
                })
                return {
                    "thought": thought,
                    "content": content,
                    "action_cards": action_cards,
                    "highlight_segment_ids": segment_ids or [],
                }
            except Exception as e:
                print(f"[AgentOrchestrator] Error invoking cloud agent: {e}. Using local heuristic.")

        # Local intelligent heuristic fallback (works 100% offline!)
        thought = "Processed conversation intent locally. Identified key topic."
        clean_prompt = text_excerpt.strip()
        lower_prompt = clean_prompt.lower()

        # Check for common meeting terms / questions
        if any(term in lower_prompt for term in ["tldr", "tld our", "eldr", "l d r"]):
            thought = "Identified question regarding 'TL;DR' in recent conversation."
            content = (
                "### Answer: What does TL;DR mean?\n\n"
                "**TL;DR** stands for **\"Too Long; Didn't Read\"**.\n\n"
                "- In software, notes, and documentation, a **TL;DR function** produces a concise executive summary "
                "distilling lengthy material (like Asimov's Laws of Robotics) into essential takeaways.\n"
                "- In conversation, it is used to give the quick bottom line upfront."
            )
            action_cards.append({
                "actionId": f"act_{int(now * 1000)}_search",
                "title": "Search TL;DR Definition",
                "description": "Search web for TL;DR summary examples",
                "toolName": "web_search",
                "parameters": {"query": "TLDR meaning software summary"},
                "status": "pending",
            })
        elif "?" in clean_prompt or any(w in lower_prompt for w in ["what", "how", "when", "where", "why", "who", "can you"]):
            thought = "Detected question from recent audio stream."
            # Extract last question sentence if possible
            sentences = [s.strip() for s in re.split(r"[.\n?!]", clean_prompt) if s.strip()]
            q_sentence = sentences[-1] if sentences else clean_prompt
            content = f"### Detected Question from Audio\n\n> *\"{clean_prompt}\"*\n\nLooking up details for: **{q_sentence}**"
            action_cards.append({
                "actionId": f"act_{int(now * 1000)}_search",
                "title": f"Search Web",
                "description": f"Look up answer for: '{q_sentence[:50]}'",
                "toolName": "web_search",
                "parameters": {"query": q_sentence},
                "status": "pending",
            })
        else:
            content = f"### Ambient Excerpt Summary\n\n> *\"{clean_prompt}\"*\n\nIdentified key discussion point from meeting transcript."
            action_cards.append({
                "actionId": f"act_{int(now * 1000)}_note",
                "title": "Save as Action Item",
                "description": "Add this topic to the meeting action items list",
                "toolName": "save_todo",
                "parameters": {"task": clean_prompt},
                "status": "pending",
            })

        action_cards.append({
            "actionId": f"act_{int(now * 1000)}_copy",
            "title": "Copy to Clipboard",
            "description": "Copy raw transcript excerpt",
            "toolName": "copy_clipboard",
            "parameters": {"text": clean_prompt},
            "status": "pending",
        })

        return {
            "thought": thought,
            "content": content,
            "action_cards": action_cards,
            "highlight_segment_ids": segment_ids or [],
        }
