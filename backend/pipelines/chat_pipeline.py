import argparse
import json
import os
import re
import sys
import subprocess
from typing import List, Optional, Tuple

# Local import of your LLM wrapper
from llm import run_llm

# Optional colors
try:
    from colorama import init as colorama_init, Fore, Style

    colorama_init()
    C_INFO = Fore.CYAN
    C_USER = Fore.GREEN
    C_BOT = Fore.MAGENTA
    C_WARN = Fore.YELLOW
    C_ERR = Fore.RED
    C_OK = Fore.BLUE
    C_RST = Style.RESET_ALL
except Exception:
    C_INFO = C_USER = C_BOT = C_WARN = C_ERR = C_OK = C_RST = ""

INTRO_MESSAGE = (
    f"{C_INFO}Report Directive Intake Bot{C_RST}\n"
    "- Describe changes you want in the report.\n"
    "- I will propose a directive and ask you to confirm it.\n"
    "- Reply 'yes' to accept, 'no' to reject, or provide a correction.\n"
    "- Commands: help, list, undo, accept, reject, add <text>, edit <text>, review, retry, save [path], copy, done\n"
)

LLM_INSTRUCTIONS = """You are an assistant helping collect and confirm actionable report revision directives.

Behavior:
- When the user provides feedback or asks for a change, propose a single concise directive capturing the change.
- Output exactly one directive per turn if a new directive is present.
- Format MUST include a line that starts with: PROPOSED DIRECTIVE: <one-line concise directive>
- After proposing, ask for confirmation with a short yes/no question. If the user's prior message is only clarifying or rejecting without a new directive, ask a brief follow-up question to clarify.
- If no directive is present in the user's message, provide a brief helpful response and ask if there are any changes to the report.

Constraints:
- The 'PROPOSED DIRECTIVE:' line must appear at most once per reply.
- Keep the directive concise and actionable (what to change, where, and how, if applicable).
- Avoid repeating previously confirmed directives.
"""

YES_SET = {
    "y",
    "yes",
    "yep",
    "yeah",
    "yup",
    "sure",
    "ok",
    "okay",
    "correct",
    "affirmative",
    "sounds good",
    "looks good",
    "sgtm",
    "👍",
    "✅",
    "approve",
    "accept",
    "confirmed",
}
NO_SET = {
    "n",
    "no",
    "nope",
    "nah",
    "negative",
    "not quite",
    "incorrect",
    "that's wrong",
    "reject",
    "deny",
    "👎",
}


def is_yes(text: str) -> bool:
    t = text.strip().lower()
    return t in YES_SET


def is_no(text: str) -> bool:
    t = text.strip().lower()
    return t in NO_SET


def build_prompt(
    user_message: str,
    confirmed_directives: List[str],
    recent_transcript: List[Tuple[str, str]],
    context_report: Optional[str] = None,
) -> str:
    directives_section = (
        "None yet."
        if not confirmed_directives
        else "\n".join(f"- {d}" for d in confirmed_directives)
    )

    transcript_lines = []
    for role, msg in recent_transcript[-6:]:
        transcript_lines.append(f"{role.upper()}: {msg}")

    report_section = ""
    if context_report:
        snippet = context_report.strip()
        if len(snippet) > 4000:
            snippet = snippet[:4000] + "\n...[truncated]..."
        report_section = f"\nPrevious Report Context (optional):\n{snippet}\n"

    prompt = f"""{LLM_INSTRUCTIONS}

Confirmed directives so far:
{directives_section}
{report_section}
Recent conversation:
{chr(10).join(transcript_lines)}

User message to process:
{user_message}

Respond with:
- If a new directive is present: one brief paragraph (optional), then a single line starting with EXACTLY 'PROPOSED DIRECTIVE: ' followed by the directive, then a short yes/no confirmation question.
- If no directive present: a brief helpful response and ask if there are any changes."""
    return prompt


def extract_proposed_directive(text: str) -> Optional[str]:
    match = re.search(r"(?im)^\s*PROPOSED\s+DIRECTIVE\s*:\s*(.+)$", text)
    if not match:
        return None
    directive = match.group(1).strip().rstrip(" .")
    return directive if directive else None


def normalize_directive(d: str) -> str:
    return re.sub(r"\s+", " ", d.strip().lower())


def save_directives(path: str, directives: List[str]) -> bool:
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"directives": directives}, f, ensure_ascii=False, indent=2)
        print(f"{C_OK}Saved directives to: {path}{C_RST}")
        return True
    except Exception as e:
        print(f"{C_ERR}Failed to save directives: {e}{C_RST}")
        return False


def copy_to_clipboard(directives: List[str]) -> None:
    try:
        text = "\n".join(directives) if directives else ""
        subprocess.run(["clip"], input=text, text=True, check=False)
        print(f"{C_OK}Copied directives to clipboard.{C_RST}")
    except Exception as e:
        print(f"{C_ERR}Clipboard copy failed: {e}{C_RST}")


def print_help():
    print(
        f"""{C_INFO}Commands:{C_RST}
- help                    Show this help
- list                    Show confirmed directives
- undo                    Remove the last confirmed directive
- review                  Show the current pending directive (if any)
- accept | yes            Accept the pending directive
- reject | no             Reject the pending directive
- add <text>              Add a directive directly (skip LLM)
- edit <text>             Replace the pending directive with your text, then confirm
- retry                   Ask the bot to re-propose the directive for your last message
- save [path]             Save directives to JSON (default: directives.json)
- copy                    Copy confirmed directives to clipboard (Windows 'clip')
- done | exit | quit      Finish and print final directives
"""
    )


def banner():
    print(INTRO_MESSAGE)


def chat_loop(
    model: str, report_path: Optional[str] = None, autosave: Optional[str] = None
) -> List[str]:
    confirmed_directives: List[str] = []
    directive_keys = set()
    pending_directive: Optional[str] = None
    awaiting_confirmation = False
    transcript: List[Tuple[str, str]] = []
    last_llm_user_message: Optional[str] = None

    report_text = None
    if report_path and os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                report_text = f.read()
        except Exception:
            report_text = None

    banner()
    if report_text:
        print(f"{C_INFO}(Loaded report context from: {report_path}){C_RST}")

    def add_confirmed(d: str):
        key = normalize_directive(d)
        if key in directive_keys:
            print(f"{C_WARN}Duplicate directive ignored: {d}{C_RST}")
            return
        confirmed_directives.append(d)
        directive_keys.add(key)
        print(f"{C_OK}Added directive:{C_RST} {d}")
        if autosave:
            save_directives(autosave, confirmed_directives)

    while True:
        try:
            user_msg = input(f"\n{C_USER}You:{C_RST} ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting...")
            break

        if not user_msg:
            continue

        lower = user_msg.lower()

        # Exits
        if lower in ("quit", "exit", "done"):
            break

        # Built-in commands
        if lower == "help":
            print_help()
            continue

        if lower == "list":
            if confirmed_directives:
                print(f"\n{C_INFO}Confirmed directives:{C_RST}")
                for i, d in enumerate(confirmed_directives, 1):
                    print(f"{i}. {d}")
            else:
                print(f"\n{C_WARN}No confirmed directives yet.{C_RST}")
            continue

        if lower == "undo":
            if confirmed_directives:
                removed = confirmed_directives.pop()
                directive_keys.discard(normalize_directive(removed))
                print(f"{C_WARN}Removed:{C_RST} {removed}")
                if autosave:
                    save_directives(autosave, confirmed_directives)
            else:
                print(f"{C_WARN}Nothing to undo.{C_RST}")
            continue

        if lower == "review":
            if pending_directive:
                print(
                    f"{C_INFO}Pending directive:{C_RST} {pending_directive}\n"
                    f"{C_INFO}Reply 'yes' to accept, 'no' to reject, or 'edit <text>'.{C_RST}"
                )
            else:
                print(f"{C_WARN}No pending directive right now.{C_RST}")
            continue

        if lower.startswith("save"):
            parts = user_msg.split(maxsplit=1)
            path = parts[1] if len(parts) > 1 else "directives.json"
            save_directives(path, confirmed_directives)
            continue

        if lower == "copy":
            copy_to_clipboard(confirmed_directives)
            continue

        if lower == "retry":
            if last_llm_user_message:
                # Force a re-proposal using last user message
                prompt = build_prompt(
                    user_message=last_llm_user_message
                    + "\nPlease rephrase the directive more precisely.",
                    confirmed_directives=confirmed_directives,
                    recent_transcript=transcript,
                    context_report=report_text,
                )
                try:
                    bot_reply = run_llm(prompt=prompt, model=model)
                except Exception as e:
                    print(f"{C_ERR}[Error calling LLM: {e}]{C_RST}")
                    bot_reply = "I couldn't reach the language model. Please try again or check your Ollama server."
                transcript.append(("user", "[retry]"))
                transcript.append(("assistant", bot_reply))
                print(f"\n{C_BOT}Bot:{C_RST} {bot_reply}")
                proposed = extract_proposed_directive(bot_reply)
                if proposed:
                    pending_directive = proposed
                    awaiting_confirmation = True
                    if not re.search(r"(?i)\b(yes|no)\b", bot_reply):
                        print(
                            f"\n{C_BOT}Bot:{C_RST} Did I understand that directive correctly? Reply yes/no, or 'edit <text>'."
                        )
                else:
                    awaiting_confirmation = False
                    pending_directive = None
            else:
                print(f"{C_WARN}No previous message to retry.{C_RST}")
            continue

        # Direct accept/reject
        if (
            awaiting_confirmation
            and pending_directive
            and (is_yes(lower) or lower in ("accept",))
        ):
            add_confirmed(pending_directive)
            pending_directive = None
            awaiting_confirmation = False
            print(f"{C_BOT}Bot:{C_RST} Any other changes to the report?")
            transcript.append(("user", user_msg))
            transcript.append(
                ("assistant", "Confirmed. Any other changes to the report?")
            )
            continue

        if (
            awaiting_confirmation
            and pending_directive
            and (is_no(lower) or lower in ("reject",))
        ):
            print(
                f"{C_INFO}Okay. You can:{C_RST} 'edit <your directive>' or type 'retry' to get a new proposal."
            )
            transcript.append(("user", user_msg))
            # keep awaiting; user can edit or retry
            continue

        # Manual add or edit commands
        if lower.startswith("add "):
            directive = user_msg[4:].strip()
            if directive:
                # Confirm quickly
                print(f"{C_INFO}Add this directive?{C_RST} {directive} (yes/no)")
                pending_directive = directive
                awaiting_confirmation = True
            else:
                print(f"{C_WARN}Nothing to add. Usage: add <directive>{C_RST}")
            continue

        if lower.startswith("edit "):
            new_text = user_msg[5:].strip()
            if not new_text:
                print(f"{C_WARN}Usage: edit <directive text>{C_RST}")
                continue
            pending_directive = new_text
            awaiting_confirmation = True
            print(
                f"{C_INFO}Updated pending directive:{C_RST} {pending_directive}\nConfirm? (yes/no)"
            )
            continue

        # If awaiting confirmation and user provided free-form text,
        # treat it as a corrected directive to be confirmed.
        if awaiting_confirmation and pending_directive:
            # User typed something other than simple yes/no/commands; treat as correction
            pending_directive = user_msg.strip()
            print(
                f"{C_INFO}Got it. Confirm this directive?{C_RST} {pending_directive} (yes/no)"
            )
            continue

        # Regular flow: build prompt and call LLM
        prompt = build_prompt(
            user_message=user_msg,
            confirmed_directives=confirmed_directives,
            recent_transcript=transcript,
            context_report=report_text,
        )
        try:
            bot_reply = run_llm(prompt=prompt, model=model)
        except Exception as e:
            print(f"{C_ERR}[Error calling LLM: {e}]{C_RST}")
            bot_reply = "I couldn't reach the language model. Please try again or check your Ollama server."

        transcript.append(("user", user_msg))
        transcript.append(("assistant", bot_reply))
        last_llm_user_message = user_msg

        print(f"\n{C_BOT}Bot:{C_RST} {bot_reply}")

        proposed = extract_proposed_directive(bot_reply)
        if proposed:
            pending_directive = proposed
            awaiting_confirmation = True
            if not re.search(r"(?i)\b(yes|no)\b", bot_reply):
                print(
                    f"\n{C_BOT}Bot:{C_RST} Did I understand that directive correctly? Please reply yes/no, or 'edit <text>'."
                )
        else:
            awaiting_confirmation = False
            pending_directive = None

    # End of conversation
    if confirmed_directives:
        print(f"\n{C_INFO}Final confirmed directives:{C_RST}")
        for i, d in enumerate(confirmed_directives, 1):
            print(f"{i}. {d}")
    else:
        print(f"\n{C_WARN}No directives were confirmed.{C_RST}")

    return confirmed_directives


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Report Directive Intake Chat Bot (Ollama)"
    )
    parser.add_argument(
        "--model", default="phi3", help="Ollama model name (default: phi3)"
    )
    parser.add_argument(
        "--report", dest="report_path", help="Path to previous report text for context"
    )
    parser.add_argument(
        "--out",
        dest="out_path",
        help="Path to write confirmed directives as JSON on exit",
    )
    parser.add_argument(
        "--autosave",
        dest="autosave_path",
        help="Autosave to JSON after each confirmation",
    )
    args = parser.parse_args(argv)

    directives = chat_loop(
        model=args.model, report_path=args.report_path, autosave=args.autosave_path
    )

    if args.out_path:
        save_directives(args.out_path, directives)

    return 0


if __name__ == "__main__":
    sys.exit(main())
