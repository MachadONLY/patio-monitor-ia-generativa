"""Measure retrieval and local LLM configurations against a fixed answer key."""

import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
from statistics import median
import sys
from time import perf_counter
import unicodedata

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "services" / "api"))

from app.assistant import (  # noqa: E402
    CASE_WORDS, MIN_SCORE, MODEL_THREADS, CaseContext, ModelOutput, load_model, retrieve, run_query,
)
from pydantic import ValidationError  # noqa: E402

MODES = ("baseline", "rag", "rag_agent")


def folded(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value.casefold()) if not unicodedata.combining(c))


def read(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def retrieval_metrics(samples):
    with_source = [item for item in samples if item["expected_sources"]]
    ranked = [(row, retrieve(CASE_WORDS[row["context"]["reason"]] if "context" in row else row["question"]))
              for row in samples]
    recalls = {}
    for limit in (1, 3):
        recalls[f"recall_at_{limit}"] = sum(
            len(set(row["expected_sources"]) & {chunk.id for chunk, _ in top[:limit]}) / len(row["expected_sources"])
            for row, top in ranked if row["expected_sources"]) / len(with_source)
    thresholds = [round(value / 100, 2) for value in range(10, 61, 2)]
    scores = []
    for threshold in thresholds:
        known_ok = sum(bool(top and top[0][1] >= threshold) for row, top in ranked if row["expected_sources"])
        unknown_ok = sum(not top or top[0][1] < threshold for row, top in ranked if not row["expected_sources"])
        scores.append({"threshold": threshold, "answerable_pass": known_ok, "unknown_blocked": unknown_ok})
    return {**recalls, "n": len(samples), "answerable": len(with_source), "threshold_sweep": scores,
            "ranked": [{"id": row.get("id", row["question"]), "expected_sources": row["expected_sources"],
                        "scores": [[doc.id, round(score, 4)] for doc, score in top]} for row, top in ranked]}


def evaluate(out, modes=MODES):
    model = load_model()
    gold_set = read("gold.json")
    calibration = retrieval_metrics(read("calibration.json"))
    retrieval = retrieval_metrics(gold_set)
    results = []
    for mode in modes:
        for row in gold_set:
            context = CaseContext.model_validate(row["context"]) if "context" in row else None
            start = perf_counter()
            response, trace = run_query(model, row["question"], mode, context)
            elapsed = perf_counter() - start
            expected = set(row["expected_sources"])
            canon = folded(response.answer)
            correct = (not response.refused and all(any(folded(term) in canon for term in alternatives)
                       for alternatives in row["accept"])) if expected else response.refused
            ids = {item.id for item in response.citations}
            relevant = bool(ids & expected) if expected and not response.refused else not ids
            try:
                valid_model_json = bool(ModelOutput.model_validate_json(trace["raw"])) if trace["raw"] else None
            except ValidationError:
                valid_model_json = False
            results.append({
                "mode": mode, "id": row["id"], "question": row["question"], "expected": row["answer"],
                "expected_sources": sorted(expected), "answer": response.model_dump(), "correct": correct,
                "citation_relevant": relevant, "raw_model_json_valid": valid_model_json,
                "seconds": round(elapsed, 3), **trace,
            })
            print(mode, row["id"], correct, round(elapsed, 2), response.answer, flush=True)
    scoreboard = {}
    for mode in modes:
        runs = [item for item in results if item["mode"] == mode]
        known = [item for item in runs if item["expected_sources"]]
        unknown = [item for item in runs if not item["expected_sources"]]
        raw_validity = Counter(item["raw_model_json_valid"] for item in runs)
        scoreboard[mode] = {
            "correct_total": sum(item["correct"] for item in runs),
            "correct_answerable": sum(item["correct"] for item in known),
            "correct_refusals": sum(item["correct"] for item in unknown),
            "correct_with_relevant_citation": sum(item["correct"] and item["citation_relevant"] for item in known),
            "raw_model_json_valid": raw_validity[True],
            "raw_model_calls": raw_validity[True] + raw_validity[False],
            "api_json_valid": len(runs),
            "median_seconds": round(median(item["seconds"] for item in runs), 3),
        }
    model_path = Path(os.environ["PATIO_LLM_MODEL_PATH"])
    with model_path.open("rb") as infile:
        sha = hashlib.file_digest(infile, "sha256").hexdigest()
    output = {
        "model_name": model.metadata.get("general.name"), "n_gpu_layers": 0, "threads": MODEL_THREADS,
        "temperature": 0, "seed": 42, "model_sha256": sha, "threshold": MIN_SCORE,
        "calibration": calibration, "retrieval": retrieval, "scoreboard": scoreboard, "results": results,
    }
    out.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(scoreboard, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=HERE / "evaluation.json")
    parser.add_argument("--retrieval-only", action="store_true")
    parser.add_argument("--mode", choices=MODES)
    parser.add_argument("--merge", type=Path, nargs="+")
    args = parser.parse_args()
    if args.merge:
        outputs = [json.loads(path.read_text(encoding="utf-8")) for path in args.merge]
        merged = outputs[0]
        for other in outputs[1:]:
            for key in ("model_sha256", "temperature", "seed", "threshold", "threads", "retrieval"):
                if other[key] != merged[key]:
                    raise ValueError(f"Incompatible benchmark key: {key}")
            if merged["scoreboard"].keys() & other["scoreboard"].keys():
                raise ValueError("Duplicate benchmark mode")
            merged["scoreboard"].update(other["scoreboard"])
            merged["results"].extend(other["results"])
        args.out.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    elif args.retrieval_only:
        print(json.dumps(retrieval_metrics(read("calibration.json")), ensure_ascii=False, indent=2))
    else:
        evaluate(args.out, (args.mode,) if args.mode else MODES)
