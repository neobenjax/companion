import os
import re
import time
from typing import Dict, Any, List, Optional
from backend.agent.tools import execute_math, execute_tool
from backend.agent.presets import MultiSourceSecurityGuardrail

DEFAULT_HIGHLIGHT_SYSTEM_INSTRUCTION = (
    "You are an ambient Copilot embedded in a live meeting (like Granola and Antigravity).\n"
    "Tone & Style:\n"
    "- Casual, clear, and friendly.\n"
    "- Explain any technical words or concepts in simple layman's terms so any reader can understand.\n"
    "Formatting:\n"
    "- Summarize the key information using clear bullet points.\n"
    "- Straight to the point without conversational filler, long dashes (like --- or —), or decorators.\n"
    "- Provide complete, well-formed, and comprehensive explanations."
)

DEFAULT_VISION_SYSTEM_INSTRUCTION = (
    "You are an ambient multimodal Windows Copilot companion.\n"
    "Analyze the provided screenshot with high precision.\n"
    "RULES:\n"
    "- Summary First: Begin with 1-2 concise sentences stating the purpose of what the user is doing or needs to know from the image.\n"
    "- Highlights: Use short bullet points to highlight only the most critical parts (active window, key content, errors, code, or data).\n"
    "- Tone: Casual and plain English. If technical terms are present, explain what they mean simply in layman's terms.\n"
    "- Formatting: No decorators, no long dashes (like --- or —). Provide a complete and well-structured breakdown."
)


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
                    model_type="gemini-3.8-flash",
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

    def analyze_intent(
        self,
        text_excerpt: str,
        is_hotkey: bool = True,
        segment_ids: Optional[List[str]] = None,
        custom_system_instruction: Optional[str] = None,
        custom_user_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
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
                custom_clean = (custom_system_instruction or "").strip()
                if custom_clean:
                    base_instruction = custom_clean
                    instruction_mode = "Custom Session Persona"
                else:
                    base_instruction = DEFAULT_HIGHLIGHT_SYSTEM_INSTRUCTION
                    instruction_mode = "Default Ambient Copilot"

                # Apply Multi-Source Security Guardrail envelope
                system_instruction = MultiSourceSecurityGuardrail.build_guarded_system_instruction(base_instruction)

                # Determine prompt payload: custom user prompt template vs default meeting prompt
                if custom_user_prompt and custom_user_prompt.strip():
                    user_message_text = custom_user_prompt.strip()
                else:
                    user_message_text = f"Explain or answer this meeting topic:\n{text_excerpt}"

                print("\n" + "=" * 70, flush=True)
                print(">>> [AI AGENT REQUEST: TEXT INTENT] >>>", flush=True)
                print(f"  Model: gemini-3.8-flash", flush=True)
                print(f"  Topic / Query: {text_excerpt}", flush=True)
                print(f"  Instruction Source: {instruction_mode} (Guarded)", flush=True)
                print(f"  Parameters: temperature=0.3", flush=True)
                print(f"  System Instruction:\n    {system_instruction.replace(chr(10), chr(10) + '    ')}", flush=True)
                print("=" * 70, flush=True)

                # Try calling SDK using Chat interface to eliminate AFC warning
                if hasattr(self._sdk_agent, "chats"):
                    from google.genai import types
                    chat = self._sdk_agent.chats.create(
                        model="gemini-3.8-flash",
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.3,
                        ),
                    )
                    resp = chat.send_message(user_message_text)
                    content = resp.text
                elif hasattr(self._sdk_agent, "generate_content"):
                    resp = self._sdk_agent.generate_content(
                        model="gemini-3.8-flash",
                        contents=f"{system_instruction}\n\n{user_message_text}",
                    )
                    content = resp.text
                elif hasattr(self._sdk_agent, "models"):
                    resp = self._sdk_agent.models.generate_content(
                        model="gemini-3.8-flash",
                        contents=f"{system_instruction}\n\n{user_message_text}",
                    )
                    content = resp.text
                else:
                    content = str(self._sdk_agent)
                    resp = None

                # Traceability logging for received response and metadata
                usage = getattr(resp, "usage_metadata", None) if resp else None
                candidates = getattr(resp, "candidates", None) if resp else None
                finish_reason = candidates[0].finish_reason if (candidates and len(candidates) > 0) else "N/A"
                prompt_tokens = getattr(usage, "prompt_token_count", "N/A") if usage else "N/A"
                candidates_tokens = getattr(usage, "candidates_token_count", "N/A") if usage else "N/A"
                thoughts_tokens = getattr(usage, "thoughts_token_count", "N/A") if usage else "N/A"
                total_tokens = getattr(usage, "total_token_count", "N/A") if usage else "N/A"

                print("\n" + "=" * 70, flush=True)
                print("<<< [AI AGENT RESPONSE: TEXT INTENT] <<<", flush=True)
                print(f"  Finish Reason: {finish_reason}", flush=True)
                print(f"  Token Metadata: Prompt={prompt_tokens}, Candidates={candidates_tokens}, Thoughts={thoughts_tokens}, Total={total_tokens}", flush=True)
                print(f"  Response Word Count: {len(content.split())} words", flush=True)
                print(f"  Response Content:\n{content}", flush=True)
                print("=" * 70 + "\n", flush=True)

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
                print(f"[AgentOrchestrator] Error invoking cloud agent: {e}. Using local heuristic.", flush=True)

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

    def analyze_vision(
        self,
        image_path: str,
        prompt: str = "",
        target_title: str = "",
        custom_system_instruction: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyzes a high-resolution screenshot using Gemini Multimodal Vision API or offline sandbox fallback.
        """
        if not prompt:
            prompt = "Analyze this screenshot in detail, extract any visible text, code, or UI elements, and explain what is happening."

        target_name = target_title or "Target Window"

        if self.api_key and os.path.exists(image_path):
            try:
                from PIL import Image
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=self.api_key)
                img = Image.open(image_path)

                # In-memory thumbnail optimization strictly for AI query payload (max 1280px)
                # This drastically reduces multimodal token consumption to protect pre-paid billing budget.
                # The original full-res disk file and Windows clipboard remain 100% untouched.
                ai_img = img.copy()
                max_dim = 1280
                if ai_img.width > max_dim or ai_img.height > max_dim:
                    ai_img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

                custom_clean = (custom_system_instruction or "").strip()
                if custom_clean:
                    base_instruction = custom_clean
                    instruction_mode = "Custom Session Persona"
                else:
                    base_instruction = DEFAULT_VISION_SYSTEM_INSTRUCTION
                    instruction_mode = "Default Ambient Multimodal"

                vision_instruction = MultiSourceSecurityGuardrail.build_guarded_system_instruction(base_instruction)

                print("\n" + "=" * 70, flush=True)
                print(">>> [AI AGENT REQUEST: VISION ANALYSIS] >>>", flush=True)
                print(f"  Model: gemini-3.8-flash", flush=True)
                print(f"  Target: {target_name}", flush=True)
                print(f"  Image: {image_path} (Optimized Payload: {ai_img.width}x{ai_img.height})", flush=True)
                print(f"  User Prompt: {prompt if prompt else 'Default analysis'}", flush=True)
                print(f"  Instruction Source: {instruction_mode} (Guarded)", flush=True)
                print(f"  Parameters: temperature=0.3", flush=True)
                print(f"  System Instruction:\n    {vision_instruction.replace(chr(10), chr(10) + '    ')}", flush=True)
                print("=" * 70, flush=True)

                chat = client.chats.create(
                    model="gemini-3.8-flash",
                    config=types.GenerateContentConfig(
                        system_instruction=vision_instruction,
                        temperature=0.3,
                    ),
                )
                user_msg = [ai_img, prompt if prompt else f"What is happening in this '{target_name}' snapshot?"]
                resp = chat.send_message(user_msg)
                content = resp.text

                # Traceability logging for received response and metadata
                usage = getattr(resp, "usage_metadata", None)
                candidates = getattr(resp, "candidates", None)
                finish_reason = candidates[0].finish_reason if (candidates and len(candidates) > 0) else "N/A"
                prompt_tokens = getattr(usage, "prompt_token_count", "N/A") if usage else "N/A"
                candidates_tokens = getattr(usage, "candidates_token_count", "N/A") if usage else "N/A"
                thoughts_tokens = getattr(usage, "thoughts_token_count", "N/A") if usage else "N/A"
                total_tokens = getattr(usage, "total_token_count", "N/A") if usage else "N/A"

                print("\n" + "=" * 70, flush=True)
                print("<<< [AI AGENT RESPONSE: VISION ANALYSIS] <<<", flush=True)
                print(f"  Finish Reason: {finish_reason}", flush=True)
                print(f"  Token Metadata: Prompt={prompt_tokens}, Candidates={candidates_tokens}, Thoughts={thoughts_tokens}, Total={total_tokens}", flush=True)
                print(f"  Response Word Count: {len(content.split())} words", flush=True)
                print(f"  Response Content:\n{content}", flush=True)
                print("=" * 70 + "\n", flush=True)

                return {
                    "thought": f"Analyzed screenshot with Gemini 3.8 Flash (payload optimized to {ai_img.width}x{ai_img.height} for token economy). Extracted visual layout and elements from '{target_name}'.",
                    "content": content,
                }
            except Exception as e:
                print(f"[AgentOrchestrator] Error calling Gemini vision API: {e}", flush=True)
                return {
                    "thought": f"Gemini API Error: {e}",
                    "content": f"### Gemini Vision API Error\n\nCould not analyze `{target_name}` with **Gemini 3.8 Flash**:\n\n> *{e}*\n\nPlease verify your API key, billing quota, or network connection in **Settings**.",
                }

        # Offline Sandbox response
        return {
            "thought": f"Sandbox Mode: Visual snapshot of '{target_name}' processed locally. High-resolution buffer saved.",
            "content": (
                f"**Purpose:** Viewing target `{target_name}` with offline sandbox mode active.\n\n"
                f"* **Captured Window:** `{target_name}` ({os.path.basename(image_path)})\n"
                f"* **Status:** High-resolution image saved to local storage\n"
                f"* **Action:** Add your Gemini API key in Settings (⚙️ icon) to enable live visual explanations"
            ),
        }
