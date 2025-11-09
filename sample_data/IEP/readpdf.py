import re
import json
import os
import sys
from typing import List, Dict, Any
import pdfplumber 

def extract_text_from_pdf(path: str) -> str:
    """Extract raw text from all pages of a text-based PDF."""
    with pdfplumber.open(path) as pdf:
        pages_text = []
        for page in pdf.pages:
            t = page.extract_text() or ""
            pages_text.append(t)
    return "\n".join(pages_text)


def normalize_lines(text: str) -> List[str]:
    """
    Normalize whitespace & drop empty lines.
    Keeps things robust to wrapping and extra spaces.
    """
    lines = []
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if line:
            lines.append(line)
    return lines


# ------------ FIELD EXTRACTORS ------------

def extract_scalar(lines: List[str], key: str, used_idxs=None) -> str:
    """
    Extract values like:
      KEY: value
      KEY:
      value (on next non-empty line)
    Tracks used lines so duplicates (e.g. second IEP DATE) can be ignored.
    """
    if used_idxs is None:
        used_idxs = set()

    key_upper = key.upper()
    for i, line in enumerate(lines):
        if i in used_idxs:
            continue

        if line.upper().startswith(key_upper + ":"):
            parts = line.split(":", 1)

            # Case 1: value on same line
            if len(parts) > 1 and parts[1].strip():
                used_idxs.add(i)
                return parts[1].strip()

            # Case 2: value on following non-empty line
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines):
                used_idxs.add(i)
                used_idxs.add(j)
                return lines[j].strip()

    return ""


def extract_block(lines: List[str], header: str, stop_headers: List[str]) -> str:
    """
    Grab all text between HEADER and the next stop-header.
    Case-insensitive; ignores spaces in headers.
    """
    norm = lambda s: s.replace(" ", "").upper()

    target = norm(header)
    stop_set = {norm(h) for h in stop_headers}

    start_idx = None
    for i, line in enumerate(lines):
        if norm(line) == target:
            start_idx = i
            break

    if start_idx is None:
        return ""

    end_idx = len(lines)
    for j in range(start_idx + 1, len(lines)):
        if norm(lines[j]) in stop_set:
            end_idx = j
            break

    block_lines = lines[start_idx + 1:end_idx]
    return "\n".join(block_lines).strip()


def extract_labeled_subfields(block_text: str, labels: List[str]) -> Dict[str, str]:
    """
    Inside a section (like EDUCATION_GOALS / ACCOMMODATIONS),
    extract sub-blocks under headers like ACADEMIC:, SOCIAL:, etc.
    Returns dict with label.lower() as keys.
    """
    result = {label.lower(): "" for label in labels}
    if not block_text.strip():
        return result

    lines = block_text.splitlines()
    current = None
    buffer: List[str] = []

    label_set = {label.upper() for label in labels}

    def flush():
        nonlocal buffer, current
        if current is not None:
            text = "\n".join(buffer).strip()
            result[current] = text
        buffer = []

    for line in lines:
        stripped = line.strip()
        upper = stripped.rstrip(":").upper()
        if upper in label_set:
            flush()
            current = upper.lower()
        else:
            if current is not None:
                buffer.append(stripped)

    flush()
    return result


def parse_participants(block_text: str) -> List[Dict[str, str]]:
    """
    Parse participants in the format:
      Name - Role
    One per line.
    """
    participants = []
    for line in block_text.splitlines():
        if "-" in line:
            name, role = line.split("-", 1)
            name = name.strip()
            role = role.strip()
            if name:
                participants.append({"name": name, "role": role})
    return participants


# ------------ MAIN PARSE LOGIC ------------

def parse_iep_text(text: str) -> Dict[str, Any]:
    lines = normalize_lines(text)
    used = set()

    # Student fields
    student = {
        "student_name": extract_scalar(lines, "STUDENT NAME", used),
        "grade": extract_scalar(lines, "GRADE", used),
        "date_of_birth": extract_scalar(lines, "DATE OF BIRTH", used),
        "teacher": extract_scalar(lines, "TEACHER", used),
        "pen": extract_scalar(lines, "PEN", used),
        "school": extract_scalar(lines, "SCHOOL", used),
        "designation": extract_scalar(lines, "DESIGNATION", used),
        "iep_date": extract_scalar(lines, "IEP DATE", used),
    }

    major_headers = [
        "PERFORMANCE_PROGRESS",
        "EDUCATION_GOALS",
        "ACCOMMODATIONS",
        "ASSESSMENTS",
        "TRANSITION_GOALS",
        "PARTICIPANTS",
    ]

    # PERFORMANCE_PROGRESS
    performance_progress = extract_block(
        lines,
        "PERFORMANCE_PROGRESS",
        [h for h in major_headers if h != "PERFORMANCE_PROGRESS"],
    )

    # EDUCATION_GOALS
    edu_block = extract_block(
        lines,
        "EDUCATION_GOALS",
        [h for h in major_headers if h != "EDUCATION_GOALS"],
    )
    education_goals = extract_labeled_subfields(
        edu_block,
        ["ACADEMIC", "SOCIAL", "BEHAVIOURAL", "COMMUNICATIVE", "PHYSICAL"],
    )

    # ACCOMMODATIONS
    accom_block = extract_block(
        lines,
        "ACCOMMODATIONS",
        [h for h in major_headers if h != "ACCOMMODATIONS"],
    )
    accommodations = extract_labeled_subfields(
        accom_block,
        ["INSTRUCTIONAL", "ENVIRONMENTAL", "ASSESSMENT", "TECHNOLOGY"],
    )

    # ASSESSMENTS
    assessments = extract_block(
        lines,
        "ASSESSMENTS",
        [h for h in major_headers if h != "ASSESSMENTS"],
    )

    # TRANSITION_GOALS
    transition_goals = extract_block(
        lines,
        "TRANSITION_GOALS",
        [h for h in major_headers if h != "TRANSITION_GOALS"],
    )

    # PARTICIPANTS
    participants_block = extract_block(
        lines,
        "PARTICIPANTS",
        [h for h in major_headers if h != "PARTICIPANTS"],
    )
    participants = parse_participants(participants_block)

    iep = {
        "student": student,
        "performance_progress": performance_progress,
        "education_goals": education_goals,
        "accommodations": accommodations,
        "assessments": assessments,
        "transition_goals": transition_goals,
        "participants": participants,
    }

    return iep


def parse_iep_pdf(path: str) -> Dict[str, Any]:
    """Public entry: PDF path -> structured IEP dict."""
    text = extract_text_from_pdf(path)
    return parse_iep_text(text)


# ------------ TERMINAL / CLI WRAPPER ------------
# This section is safe to delete in production and is only for hackathon / local use.

if __name__ == "__main__":
    # Usage:
    #   python iep_parser.py sample_iep_input.pdf
    #
    # Outputs:
    #   ./output_json/<basename>.json

    if len(sys.argv) < 2:
        print("Usage: python iep_parser.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.isfile(pdf_path):
        print(f"Error: file not found: {pdf_path}")
        sys.exit(1)

    iep_data = parse_iep_pdf(pdf_path)

    out_dir = "output_json"
    os.makedirs(out_dir, exist_ok=True)

    base = os.path.splitext(os.path.basename(pdf_path))[0]
    out_path = os.path.join(out_dir, base + ".json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(iep_data, f, indent=2, ensure_ascii=False)

    print(f"Parsed IEP JSON written to: {out_path}")
