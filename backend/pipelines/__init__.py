import iep_alignment_pipeline


def run_iep_alignment(iep_dir: str, worksheets_dir: str):
    """"""
    alignment_results = iep_alignment_pipeline.run_pipeline(iep_dir, worksheets_dir)
    mat = alignment_results["matrix"]
    alignment_results["row_averages"] = [
        round(sum(row) / len(row), 2) for row in mat
    ]  # per course (rows)
    alignment_results["column_averages"] = [
        round(sum(mat[r][c] for r in range(len(mat))) / len(mat), 2)
        for c in range(len(mat[0]))
    ]  # per student (columns)
    return alignment_results
