from pathlib import Path
from typing import Any, Dict, List, Tuple, Iterable

from . import iep_alignment_pipeline
from . import cc_alignment_pipeline

__all__ = ["run_iep_alignment_selected"]

def run_iep_alignment(iep_dir: str, worksheets_dir: str):
    """Run IEPs alignment scores on ALL students in iep_dir and ALL worksheets in worksheets_dir."""
    alignment_results = iep_alignment_pipeline.run_pipeline(iep_dir, worksheets_dir)
    mat = alignment_results["matrix"]["matrix"]
    alignment_results["row_averages"] = [
        round(sum(row) / len(row), 2) for row in mat
    ]
    alignment_results["column_averages"] = [
        round(sum(mat[r][c] for r in range(len(mat))) / len(mat), 2)
        for c in range(len(mat[0]))
    ]
    return alignment_results


def run_cc_alignment(cc_file: str, worksheets_dir: str, grade_band: str):
    """Run core competencies alignment scores on ALL worksheets in worksheets_dir."""
    alignment_results = cc_alignment_pipeline.run_pipeline(
        cc_file, worksheets_dir, grade_band
    )
    mat = alignment_results["matrix"]["matrix"]
    alignment_results["row_averages"] = [
        round(sum(row) / len(row), 2) for row in mat
    ]
    alignment_results["column_averages"] = [
        round(sum(mat[r][c] for r in range(len(mat))) / len(mat), 2)
        for c in range(len(mat[0]))
    ]
    return alignment_results


# =========================
# UNTESTED selection-based IEP
# =========================

def _load_ieps_by_names(students_dir: Path, names: Iterable[str]):
    """Load only IEP JSONs whose student.student_name is in names (case-insensitive)."""
    want = {n.strip().lower() for n in names if str(n).strip()}
    profiles = []
    if not want:
        return profiles

    for p in sorted(students_dir.glob("*.json")):
        if p.name.lower() == "index.json":
            continue
        try:
            raw = iep_alignment_pipeline.safe_load_json_file(p)
        except Exception:
            continue
        stu = (raw.get("student", {}) or {})
        sname = str(stu.get("student_name", "")).strip()
        if sname.lower() in want:
            profiles.append(iep_alignment_pipeline.normalize_iep(raw))
    return profiles


def _collect_worksheets_for_selection(curriculum_root: Path, selection: Dict[str, List[str]]):
    """
    Build a merged worksheets dict for selected {course: [units...]}.
    Uses the pipeline's text extraction for each unit dir.
    Returns (worksheets_dict, worksheet_ids_in_order)
    """
    merged: Dict[str, Dict] = {}
    ordered_ids: List[str] = []

    for course, units in (selection or {}).items():
        course_dir = curriculum_root / course
        if not course_dir.exists():
            continue
        for unit in units or []:
            unit_dir = course_dir / unit
            if not unit_dir.exists():
                continue
            # collect from this unit
            unit_ws = iep_alignment_pipeline.collect_worksheets_texts(unit_dir)
            # Keep stable order by filename
            for wid in sorted(unit_ws.keys()):
                if wid not in merged:
                    merged[wid] = unit_ws[wid]
                    ordered_ids.append(wid)
    return merged, ordered_ids


def _collect_worksheets_from_paths(paths: List[str]):
    """
    Accepts a mixed list of files or directories and merges them.
    Returns (worksheets_dict, worksheet_ids_in_order)
    """
    merged: Dict[str, Dict] = {}
    ordered_ids: List[str] = []
    for pth in paths or []:
        root = Path(pth)
        if not root.exists():
            continue
        unit_ws = iep_alignment_pipeline.collect_worksheets_texts(root)
        for wid in sorted(unit_ws.keys()):
            if wid not in merged:
                merged[wid] = unit_ws[wid]
                ordered_ids.append(wid)
    return merged, ordered_ids


def run_iep_alignment_selected(
    student_names: List[str],
    base_students_dir: str,
    selection: Dict[str, List[str]],
    base_curriculum_dir: str,
):
    """
    Run alignment for an explicit subset:
      - student_names: list of exact student names (as in each IEP's student.student_name)
      - selection: { "<course>": ["<unit>", ...], ... }
      - base_students_dir: path to /data/students
      - base_curriculum_dir: path to /data/curriculum

    Returns the same JSON shape as run_iep_alignment() with row/column averages added.
    """
    students_dir = Path(base_students_dir)
    curriculum_root = Path(base_curriculum_dir)

    # 1) Load only requested students
    students = _load_ieps_by_names(students_dir, student_names)
    if not students:
        return {
            "meta": {"students": [], "worksheets": []},
            "matrix": {"students": [], "worksheets": [], "matrix": []},
            "details": {},
            "row_averages": [],
            "column_averages": [],
        }
    student_labels = [s.student_name for s in students]

    # 2) Collect only requested worksheets
    worksheets, worksheet_ids = _collect_worksheets_for_selection(curriculum_root, selection)
    if not worksheet_ids:
        return {
            "meta": {"students": student_labels, "worksheets": []},
            "matrix": {"students": student_labels, "worksheets": [], "matrix": []},
            "details": {},
            "row_averages": [],
            "column_averages": [0 for _ in student_labels],
        }

    # 3) Evaluate pairs (same logic as pipeline.run_pipeline but filtered)
    results_overall: Dict[str, Dict[str, int]] = {wid: {} for wid in worksheet_ids}
    full_results: Dict[str, Dict[str, Dict[str, Any]]] = {wid: {} for wid in worksheet_ids}

    for wid in worksheet_ids:
        wtext = worksheets[wid].get("text") or ""
        wtitle = worksheets[wid].get("title") or ""
        for s in students:
            eval_result = iep_alignment_pipeline.evaluate_alignment_for_pair(
                s, wtext, worksheet_id=wid, worksheet_title=wtitle
            )
            results_overall[wid][s.student_name] = int(eval_result["overall_alignment"])
            full_results[wid][s.student_name] = eval_result

    matrix_json = iep_alignment_pipeline.assemble_score_matrix(
        results_overall, student_labels, worksheet_ids
    )

    payload = {
        "meta": {"students": student_labels, "worksheets": worksheet_ids},
        "matrix": matrix_json,
        "details": full_results,
    }

    # Averages
    mat = payload["matrix"]["matrix"]
    payload["row_averages"] = [round(sum(row) / len(row), 2) if row else 0 for row in mat]
    payload["column_averages"] = (
        [
            round(sum(mat[r][c] for r in range(len(mat))) / len(mat), 2)
            for c in range(len(mat[0]))
        ]
        if mat and mat[0]
        else [0 for _ in student_labels]
    )

    return payload


def run_iep_alignment_by_files(
    student_json_files: List[str],
    worksheet_paths: List[str],
):
    """
    Lower-level variant:
      - student_json_files: explicit list of student .json files
      - worksheet_paths: list of files/dirs to include (merged)

    Returns the same shape as other functions.
    """
    # Students
    students = []
    for p in student_json_files or []:
        try:
            raw = iep_alignment_pipeline.safe_load_json_file(Path(p))
            students.append(iep_alignment_pipeline.normalize_iep(raw))
        except Exception:
            continue
    if not students:
        return {
            "meta": {"students": [], "worksheets": []},
            "matrix": {"students": [], "worksheets": [], "matrix": []},
            "details": {},
            "row_averages": [],
            "column_averages": [],
        }
    student_labels = [s.student_name for s in students]

    # Worksheets
    worksheets, worksheet_ids = _collect_worksheets_from_paths(worksheet_paths)
    if not worksheet_ids:
        return {
            "meta": {"students": student_labels, "worksheets": []},
            "matrix": {"students": student_labels, "worksheets": [], "matrix": []},
            "details": {},
            "row_averages": [],
            "column_averages": [0 for _ in student_labels],
        }

    # Evaluate
    results_overall: Dict[str, Dict[str, int]] = {wid: {} for wid in worksheet_ids}
    full_results: Dict[str, Dict[str, Dict[str, Any]]] = {wid: {} for wid in worksheet_ids}

    for wid in worksheet_ids:
        wtext = worksheets[wid].get("text") or ""
        wtitle = worksheets[wid].get("title") or ""
        for s in students:
            eval_result = iep_alignment_pipeline.evaluate_alignment_for_pair(
                s, wtext, worksheet_id=wid, worksheet_title=wtitle
            )
            results_overall[wid][s.student_name] = int(eval_result["overall_alignment"])
            full_results[wid][s.student_name] = eval_result

    matrix_json = iep_alignment_pipeline.assemble_score_matrix(
        results_overall, student_labels, worksheet_ids
    )

    payload = {
        "meta": {"students": student_labels, "worksheets": worksheet_ids},
        "matrix": matrix_json,
        "details": full_results,
    }

    # Averages
    mat = payload["matrix"]["matrix"]
    payload["row_averages"] = [round(sum(row) / len(row), 2) if row else 0 for row in mat]
    payload["column_averages"] = (
        [
            round(sum(mat[r][c] for r in range(len(mat))) / len(mat), 2)
            for c in range(len(mat[0]))
        ]
        if mat and mat[0]
        else [0 for _ in student_labels]
    )

    return payload
