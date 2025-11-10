"""
iep_alignment_pipeline.py
Full pipeline:
- extract text from worksheets (PDF/text)
- normalize IEPs
- compile deterministic prompts
- call local LLM (llama:phi3-mini via llama-cpp-python)
- parse, normalize model output into strict schema
- assemble score matrix and write JSON for API

Usage:
  python iep_alignment_pipeline.py \
    --iep-dir ./ieps \
    --worksheets-dir ./worksheets \
    --out output_scores.json

    python iep_alignment_pipeline.py --iep-dir "../data/students" --worksheets-dir "../data/curriculum/Math 8 Adapted" --out output_scores.json
"""

import argparse
import json
import os
import re
import sys
import tempfile
import logging
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, List, Any, Tuple
from tqdm import tqdm

# PDF & OCR libs
from PyPDF2 import PdfReader
from pdf2image import convert_from_path
import pytesseract
from PIL import Image


from llm import run_llm
from logger import SimpleAppLogger

# LLM bindings
# from llama_cpp import Llama


# ---------- Configuration / Schema ----------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"

MODEL_TEMPERATURE = 0.0
MODEL_MAX_TOKENS = 512
MODEL_TOP_P = 1.0
MODEL_N_CTX = 2048

# Strict response schema expected from model (keys and types)
EXPECTED_KEYS = [
    "understanding_fit",
    "accessibility_fit",
    "accommodation_fit",
    "engagement_fit",
    "overall_alignment",
    "explanation",
]

# ---------- Helpers ----------

LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.getLogger("httpx").setLevel(logging.ERROR)
logger = SimpleAppLogger(str(LOG_DIR), "alignment_pipeline", logging.INFO).get_logger()


def safe_load_json_file(path: Path) -> Dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json_file(obj: Any, path: Path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


# ---------- Text Extraction ----------


def extract_text_from_searchable_pdf(path: Path) -> str:
    """Try to extract text using PyPDF2. Best for searchable PDFs."""
    text_chunks = []
    try:
        reader = PdfReader(str(path))
        for p in reader.pages:
            try:
                txt = p.extract_text() or ""
            except Exception:
                txt = ""
            text_chunks.append(txt)
    except Exception as e:
        logger.warning(f"PyPDF2 failed for {path}: {e}")
    return "\n".join(text_chunks).strip()


def ocr_pdf(path: Path, dpi=300, pages_limit=None) -> str:
    """Perform OCR using pdf2image + pytesseract."""
    text_chunks = []
    try:
        images = convert_from_path(str(path), dpi=dpi)
        if pages_limit:
            images = images[:pages_limit]
        for img in images:
            txt = pytesseract.image_to_string(img)
            text_chunks.append(txt)
    except Exception as e:
        logger.warning(f"OCR failed for {path}: {e}")
    return "\n".join(text_chunks).strip()


def extract_text_from_pdf(path: Path, ocr_if_empty=True, pages_limit=None) -> str:
    text = extract_text_from_searchable_pdf(path)
    if (not text or len(text) < 50) and ocr_if_empty:
        logger.info(f"Performing OCR for (probably scanned) PDF: {path}")
        text = ocr_pdf(path, pages_limit=pages_limit)
    return text


def extract_text_from_file(path: Path) -> str:
    """Generic extractor: support .pdf and .txt"""
    if path.suffix.lower() == ".pdf":
        return extract_text_from_pdf(path)
    else:
        # fallback to read text file
        try:
            return path.read_text(encoding="utf-8")
        except Exception:
            return ""


# ---------- IEP Normalization ----------


@dataclass
class StudentProfile:
    student_name: str
    grade: str
    designation: str
    strengths: str
    challenges: str
    education_goals: Dict[str, str]
    accommodations: Dict[str, str]
    meta: Dict[str, Any]


def normalize_iep(raw: Dict) -> StudentProfile:
    # Extract fields robustly
    stu = raw.get("student", {})
    performance = raw.get("performance_progress", "")
    education_goals = raw.get("education_goals", {})
    accommodations = raw.get("accommodations", {})
    # Compose strengths/challenges from performance
    strengths = []
    challenges = []
    perf = performance or ""
    # crude heuristics: look for words
    # If you want better extraction, add an NLP step
    (
        strengths.append(
            "demonstrates strengths in pattern recognition and problem-solving"
        )
        if "problem" in perf.lower() or "pattern" in perf.lower()
        else None
    )
    (
        strengths.append(
            "strong understanding in math and science when instructions are broken down"
        )
        if "math" in perf.lower() or "science" in perf.lower()
        else None
    )
    if "overwhelm" in perf.lower() or "noise" in perf.lower():
        challenges.append(
            "sensitivity to sensory input and difficulty with unexpected changes"
        )
    if "impulsivity" in perf.lower() or "attention" in perf.lower():
        challenges.append("challenges with attention and impulsivity")
    # fallback: put the raw performance as either strengths or challenges depending on keywords
    if not strengths and perf:
        strengths.append(perf.strip().split(".")[0])
    if not challenges and perf:
        # if it contains 'struggles' or 'challenges' put it as challenge
        if "strug" in perf.lower() or "challeng" in perf.lower():
            challenges.append(perf.strip().split(".")[0])
    strengths_text = " ; ".join([s for s in strengths if s])
    challenges_text = " ; ".join([c for c in challenges if c]) or perf.strip()
    return StudentProfile(
        student_name=stu.get("student_name", "Unknown"),
        grade=stu.get("grade", ""),
        designation=stu.get("designation", ""),
        strengths=strengths_text,
        challenges=challenges_text,
        education_goals=education_goals,
        accommodations=accommodations,
        meta=stu,
    )


# ---------- Prompt Compiler ----------

ALIGNMENT_PROMPT_TEMPLATE = """
You are an expert special education analyst. You will evaluate how well a specific worksheet aligns with a specific student's IEP.
Follow instructions exactly and return only valid JSON.

STUDENT PROFILE (concise summary):
Name: {student_name}
Grade: {grade}
Designation: {designation}
Strengths: {strengths}
Challenges: {challenges}
Top goals: {top_goals}
Key accommodations: {key_accommodations}

WORKSHEET METADATA:
Worksheet ID: {worksheet_id}
Worksheet Title: {worksheet_title}

WORKSHEET FULL TEXT:
{worksheet_text}

TASK:
Evaluate alignment between this worksheet and the student's needs.

You must RETURN a JSON object only with these keys:
- understanding_fit: integer 0-100 (how well the worksheet supports student's academic understanding goals)
- accessibility_fit: integer 0-100 (how accessible is the worksheet given student's challenges)
- accommodation_fit: integer 0-100 (how well accommodations listed would allow success)
- engagement_fit: integer 0-100 (how engaging / motivating the worksheet is for the student)
- overall_alignment: integer 0-100 (summary alignment)
- explanation: short string (1-3 brief sentences explaining top reasons behind the scores)

SCORING RULES:
- Use 0-100 integer values.
- overall_alignment should be close to the average of the four numeric scores (allow 5 points tolerance).
- explanation must be concise.
- Do not output ANY extra text outside the JSON.
- Do not add ANY comments on individual JSON entries.

Produce the JSON now.
"""


def compile_alignment_prompt(
    student: StudentProfile,
    worksheet_text: str,
    worksheet_id: str,
    worksheet_title: str = "",
) -> str:
    # Prepare concise pieces
    top_goals = "; ".join(
        [f"{k}: {v}" for k, v in list(student.education_goals.items())[:3]]
    )
    key_accommodations = "; ".join(
        [f"{k}: {v}" for k, v in list(student.accommodations.items())[:3]]
    )

    prompt = ALIGNMENT_PROMPT_TEMPLATE.format(
        student_name=student.student_name,
        grade=student.grade,
        designation=student.designation,
        strengths=student.strengths or "N/A",
        challenges=student.challenges or "N/A",
        top_goals=top_goals or "N/A",
        key_accommodations=key_accommodations or "N/A",
        worksheet_id=worksheet_id,
        worksheet_title=worksheet_title or "N/A",
        worksheet_text=worksheet_text[:2500],  # keep prompt size bounded
    )
    return prompt


# ---------- Response Parsing & Normalization ----------


def extract_json_from_text(s: str) -> Tuple[Dict, str]:
    """
    Try to extract the first JSON object from text.
    Returns (json_obj_or_empty, raw_json_string_or_empty)
    """
    # find first { ... } balanced - naive approach
    s = s.strip()
    # attempt direct load first
    try:
        j = json.loads(s)
        return j, s
    except Exception:
        pass
    # regex to find braces - this may fail on nested braces inside strings, but it's robust enough for LLM outputs that print JSON
    brace_stack = []
    start = None
    for i, ch in enumerate(s):
        if ch == "{":
            if start is None:
                start = i
            brace_stack.append(i)
        elif ch == "}":
            if brace_stack:
                brace_stack.pop()
                if not brace_stack and start is not None:
                    candidate = s[start : i + 1]
                    try:
                        j = json.loads(candidate)
                        return j, candidate
                    except Exception:
                        start = None
                        continue
    return {}, ""


def enforce_schema_and_normalize(raw: Dict) -> Dict:
    """Ensure all expected keys exist and numeric values are ints between 0 and 100"""
    out = {}
    for k in EXPECTED_KEYS:
        if k in raw:
            if k != "explanation":
                # coerce numeric
                try:
                    v = int(round(float(raw[k])))
                except Exception:
                    # attempt to extract digits
                    digits = re.findall(r"\d+", str(raw[k]))
                    v = int(digits[0]) if digits else 0
                v = max(0, min(100, v))
                out[k] = v
            else:
                # explanation: sanitize to short string
                ex = str(raw[k]).strip()
                # truncate to ~260 chars
                out[k] = (" ".join(ex.split()))[:260]
        else:
            # default missing
            out[k] = 0 if k != "explanation" else ""
    # sanity check overall_alignment close to average
    avg = int(
        round(
            (
                out["understanding_fit"]
                + out["accessibility_fit"]
                + out["accommodation_fit"]
                + out["engagement_fit"]
            )
            / 4.0
        )
    )
    if abs(out["overall_alignment"] - avg) > 6:
        # adjust to be avg
        out["overall_alignment"] = avg
    return out


# ---------- Pipeline: single worksheet x single student ----------


def evaluate_alignment_for_pair(
    student: StudentProfile,
    worksheet_text: str,
    worksheet_id: str,
    worksheet_title: str = "",
) -> Dict:
    prompt = compile_alignment_prompt(
        student, worksheet_text, worksheet_id, worksheet_title
    )
    raw_output = run_llm(prompt=prompt)
    cleaned_output = raw_output.strip("```json").strip().replace("\n", "")
    # print(raw_output)
    logger.info(
        f"LLM Output for {student.student_name}, {worksheet_title}: {cleaned_output[:150]}"
    )
    try:
        parsed_json = json.loads(cleaned_output)
    except Exception as e:
        logger.warning(f"Failed to parse JSON from LLM: {e}")
        parsed_json = None

    if not parsed_json or set(parsed_json.keys()) != EXPECTED_KEYS:
        normalized = evaluate_alignment_for_pair(
            student, worksheet_text, worksheet_id, worksheet_title
        )
    else:
        normalized = enforce_schema_and_normalize(parsed_json)
    return normalized


# ---------- Assemble score table ----------


def assemble_score_matrix(
    results: Dict[str, Dict[str, int]], students: List[str], worksheets: List[str]
) -> Dict:
    """
    results: mapping worksheet_id -> mapping student_name -> score (overall_alignment)
    """
    matrix = []
    for wid in worksheets:
        row = []
        for s in students:
            row.append(results.get(wid, {}).get(s, 0))
        matrix.append(row)
    return {"students": students, "worksheets": worksheets, "matrix": matrix}


# ---------- High level run ----------


def collect_worksheets_texts(worksheets_dir: Path) -> Dict[str, Dict]:
    """
    Walk worksheets_dir; expects structure optionally with units:
    e.g.
      worksheets_dir/unit1/worksheet1.pdf
      worksheets_dir/unit1/worksheet2.pdf
    If no subdirs, all files are treated as worksheets.
    Returns dict worksheet_id -> {"text":..., "title":..., "path":...}
    """
    worksheets = {}
    for root, dirs, files in os.walk(str(worksheets_dir)):
        for fname in files:
            if not fname.lower().endswith((".pdf", ".txt")):
                continue
            fpath = Path(root) / fname
            rel = (
                Path(root).relative_to(worksheets_dir)
                if Path(root) != worksheets_dir
                else Path(".")
            )
            # create id
            worksheet_id = f"{rel.as_posix().replace('/', '_')}_{fname}".strip("_")
            title = fname
            try:
                text = extract_text_from_file(fpath)
                if not text:
                    logger.warning(f"No text found in {fpath}")
            except Exception as e:
                logger.warning(f"Failed to extract text from {fpath}: {e}")
                text = ""
            worksheets[worksheet_id] = {
                "text": text,
                "title": title,
                "path": str(fpath),
            }
    return worksheets


def load_ieps_from_dir(iep_dir: Path) -> List[StudentProfile]:
    profiles = []
    for p in sorted(iep_dir.iterdir()):
        # print(p.name)
        if p.suffix.lower() != ".json" or p.name == "index.json":
            continue
        raw = safe_load_json_file(p)
        profiles.append(normalize_iep(raw))
    return profiles


def run_pipeline(iep_dir: str, worksheets_dir: str, out_path: str):
    iep_dir_p = Path(iep_dir)
    worksheets_dir_p = Path(worksheets_dir)
    out_p = Path(out_path)

    # Load IEPs
    students = load_ieps_from_dir(iep_dir_p)
    student_names = [s.student_name for s in students]
    logger.info(f"Loaded {len(students)} student profiles: {student_names}")

    # Extract worksheets
    worksheets = collect_worksheets_texts(worksheets_dir_p)
    worksheet_ids = list(worksheets.keys())
    logger.info(f"Found {len(worksheets)} worksheet files")

    # Results map: worksheet_id -> student -> overall score
    results_overall = {wid: {} for wid in worksheet_ids}
    # And store per-metric details as well
    full_results = {wid: {} for wid in worksheet_ids}

    # For each worksheet and each student
    for wid in tqdm(worksheet_ids, desc="Worksheets"):
        wtext = worksheets[wid]["text"] or ""
        wtitle = worksheets[wid]["title"]
        for s in students:
            eval_result = evaluate_alignment_for_pair(
                s, wtext, worksheet_id=wid, worksheet_title=wtitle
            )
            # store overall
            results_overall[wid][s.student_name] = int(eval_result["overall_alignment"])
            full_results[wid][s.student_name] = eval_result

    # Build matrix
    matrix_json = assemble_score_matrix(results_overall, student_names, worksheet_ids)
    # Save outputs
    api_payload = {
        "meta": {
            "students": student_names,
            "worksheets": worksheet_ids,
            "generated_by": "iep_alignment_pipeline.py",
        },
        "matrix": matrix_json,
        "details": full_results,
    }
    write_json_file(api_payload, out_p)
    logger.info(f"[info] Wrote results to {out_p}")


# ---------- CLI ----------


def parse_args():
    p = argparse.ArgumentParser(description="IEP Alignment Pipeline")
    p.add_argument(
        "--iep-dir", required=True, help="Directory containing IEP JSON files"
    )
    p.add_argument(
        "--worksheets-dir",
        required=True,
        help="Directory containing worksheets (PDF/TXT). Subdirs retained as units.",
    )
    p.add_argument("--out", required=True, help="Path to output JSON file")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    run_pipeline(args.iep_dir, args.worksheets_dir, args.out)


# OUTPUT:
# model='phi3' created_at='2025-11-10T01:43:13.0348531Z' done=True done_reason='stop' total_duration=3825816000 load_duration=1180650700 prompt_eval_count=1960 prompt_eval_duration=531637000 eval_count=164 eval_duration=2039309500 message=Message(role='assistant', content='```json\n{\n  "understanding_fit": 80,\n  "accessibility_fit": 95,\n  "accommodation_fit": 90,\n  "engagement_fit": 75,\n  "overall_alignment": 85,\n  "explanation": "The worksheet meets Maya\'s academic understanding goals by focusing on ratios and proportions within visual context. Accessibility is high due to clear instructions and choice in demonstrating learning that align with sensory needs. The provided accommodations are appropriate for her challenges, ensuring success potential. However, the engagement could be enhanced by integrating Maya\'s interests more directly into tasks."\n}\n```', thinking=None, images=None, tool_name=None, tool_calls=None)
