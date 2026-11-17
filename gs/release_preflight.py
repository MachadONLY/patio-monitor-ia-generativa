"""Release preflight for the two graded disciplines and their common platform."""
from hashlib import sha256
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]

def raw(path):
    return (ROOT / path).read_bytes()

def json_at(path):
    return json.loads(raw(path))

def verify(condition, message):
    if not condition:
        raise AssertionError(message)
    print("PASS:", message)

def word_count(text):
    return len(re.findall(r"[\w]+(?:[–-][\w]+)*", text, flags=re.UNICODE))

def main():
    content = json_at("docs/gs/cv/relatorio-conteudo.json")
    verify(word_count(content["resumo"]) == 250, "250-word Computer Vision abstract")
    verify(word_count(content["objetivo"]) == 50, "50-word Computer Vision objective")
    pdf = raw("docs/gs/cv/Patio-Monitor-Applied-Computer-Vision.pdf")
    verify(pdf.startswith(b"%PDF-") and len(pdf) > 100_000, "CV report PDF included")
    video = raw("docs/gs/cv/Patio-Monitor-Demonstracao-Visao.mp4")
    verify(video[4:8] == b"ftyp" and len(video) > 1_000_000, "recorded demonstration MP4 included")
    vision = json_at("services/vision/artifacts/report.json")
    check_video = raw("services/vision/artifacts/annotated.mp4")
    verify(sha256(check_video).hexdigest() == vision["video"]["sha256"],
           "annotated source video matches its report")
    verify(vision["data_origin"] == "PUBLIC_VIDEO" and bool(vision["events"]),
           "licensed source and actual crossings recorded")
    for crossing in vision["events"]:
        frame = raw("services/vision/artifacts/" + Path(crossing["evidence_url"]).name)
        verify(frame.startswith(b"\xff\xd8\xff"), "crossing evidence is a JPEG")
    verify(sha256(raw("services/vision/artifacts/bus-heads.npz")).hexdigest()
           == vision["model"]["sha256"], "detector weights match recorded results")

    model = json_at("gs/genai/model.json")
    evaluation = json_at("gs/genai/evaluation.json")
    verify(evaluation["model_sha256"] == model["sha256"], "LLM weights match experiment manifest")
    verify(len(evaluation["results"]) == 51, "51 benchmark responses saved")
    scores = evaluation["scoreboard"]
    verify(scores["rag_agent"]["correct_total"] > scores["rag"]["correct_total"]
           > scores["baseline"]["correct_total"], "model, RAG and agent compared faithfully")
    corpus = json_at("services/api/app/assistant_data/corpus.json")
    verify(len(corpus) >= 10 and all(item.get("id") and item.get("url")
           and item.get("rights") for item in corpus), "source-attributed corpus included")
    cases = json_at("gs/genai/gold.json")
    verify(len(cases) == 17 and sum(not case["expected_sources"] for case in cases) >= 5,
           "assessment includes unsupported questions")
    notebook = json_at("gs/genai/avaliacao.ipynb")
    verify(sum(bool(c.get("outputs")) for c in notebook["cells"]
               if c["cell_type"] == "code") >= 4, "executed notebook outputs preserved")

    for item in ["README.md", "docs/gs/GENAI.md", "docs/gs/cv/README.md",
                 "docs/gs/rpa/README.md"]:
        for dest in re.findall(r"\]\(([^)]+)\)", raw(item).decode("utf-8")):
            if dest.startswith(("http:", "https:", "mailto:", "#")):
                continue
            target = dest.split("#")[0].split(" ")[0]
            verify(not target or (ROOT / item).parent.joinpath(target).exists(),
                   "working link " + item + " -> " + target)

    web = raw("apps/web/src/main.tsx").decode("utf-8")
    verify(all(token in web for token in ("Iniciar teste guiado", "ShiftReview",
           "GateCamera", "GateMonitor", "useObservations", "<Scene ")),
           "single-screen guided portal integrates its components")
    print("Release preflight passed.")

if __name__ == "__main__":
    main()
