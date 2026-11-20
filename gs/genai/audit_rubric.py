"""Verificação independente dos critérios objetivos 3, 4 e 5 da GS de IA.

Lê resultados, fontes e gabarito salvos. Não reexecuta inferência e não substitui
o benchmark real (ver independent-genai-benchmark.yml).
"""
from __future__ import annotations

import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "gs" / "genai"


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def check(condition: bool, message: str):
    if not condition:
        raise AssertionError(message)
    print("PASS:", message)


def audit() -> dict:
    evaluation = read(BASE / "evaluation.json")
    corpus = read(ROOT / "base" / "corpus.json")
    gold = read(ROOT / "avaliacao" / "gabarito.json")
    calibration = read(BASE / "calibration.json")
    model = read(BASE / "model.json")
    notebook = read(ROOT / "notebooks" / "avaliacao.ipynb")
    report = (ROOT / "docs" / "gs" / "GENAI.md").read_text(encoding="utf-8")
    results = evaluation["results"]
    scoreboard = evaluation["scoreboard"]
    modes = ("baseline", "rag", "rag_agent")

    check(evaluation["model_sha256"] == model["sha256"], "Resultados ligados ao SHA-256 do Qwen oficial")
    check(len(gold) == len({row["id"] for row in gold}) == 17, "17 casos únicos no gabarito")
    check(sum(bool(x["expected_sources"]) for x in gold) == 11
          and sum(not x["expected_sources"] for x in gold) == 6,
          "11 perguntas com evidência e 6 casos 'não consta'")
    check(len(corpus) == len({item["id"] for item in corpus}) == 10
          and all(all(item.get(field) for field in ("id", "title", "url", "rights", "text")) for item in corpus),
          "10 trechos únicos com ID, título, URL, direitos e texto")
    corpus_ids = {item["id"] for item in corpus}
    check(all(set(row["expected_sources"]) <= corpus_ids for row in gold),
          "Todas as fontes esperadas pertencem à base documentada")

    check(evaluation["retrieval"]["answerable"] == 11, "Recall medido apenas nos 11 casos com fonte")
    check(evaluation["retrieval"]["recall_at_1"] == 1.0
          and evaluation["retrieval"]["recall_at_3"] == 1.0,
          "Recall@1=100% e Recall@3=100% na amostra declarada")
    check(evaluation["threshold"] == 0.46, "Limiar de recuperação fixado em 0,46")
    check(len(calibration) == 12, "Calibração separada com 12 perguntas")
    chosen = next(x for x in evaluation["calibration"]["threshold_sweep"]
                  if x["threshold"] == evaluation["threshold"])
    check(chosen["answerable_pass"] == 7 and chosen["unknown_blocked"] == 4,
          "Limiar preservou 7/7 respondíveis e bloqueou 4/5 desconhecidos na calibração")

    check(set(scoreboard) == set(modes), "Três configurações no placar")
    check(Counter(row["mode"] for row in results) == Counter({mode: 17 for mode in modes}),
          "51 resultados: 17 de cada configuração")
    expected_ids = {row["id"] for row in gold}
    records_by_mode: dict[str, list[dict]] = {}
    raw_count = {}
    verified_returns = {}
    for mode in modes:
        rows = [row for row in results if row["mode"] == mode]
        records_by_mode[mode] = rows
        check({row["id"] for row in rows} == expected_ids, f"{mode}: mesmos 17 casos do gabarito")
        good_json = 0
        calls = 0
        for row in rows:
            response = row["answer"]
            check_fields = ("answer", "citations", "refused", "actions", "model")
            assert all(field in response for field in check_fields), (mode, row["id"], response)
            assert isinstance(response["answer"], str) and bool(response["answer"].strip())
            assert isinstance(response["refused"], bool)
            assert isinstance(response["citations"], list)
            assert isinstance(response["actions"], list)
            if response["refused"]:
                assert not response["citations"], (mode, row["id"], "recusa com citação")
            for citation in response["citations"]:
                assert citation["id"] in corpus_ids, (mode, row["id"], "citação fora do corpus")
                if mode != "baseline":
                    assert citation["id"] in {found[0] for found in row["retrieved"]}, (
                        mode, row["id"], "citação sem recuperação"
                    )
            raw = row["raw"]
            if raw is not None:
                parsed = json.loads(raw)
                assert set(parsed) == {"answer", "citation_ids", "refused"}
                assert isinstance(parsed["answer"], str)
                assert isinstance(parsed["citation_ids"], list)
                assert isinstance(parsed["refused"], bool)
                assert row["raw_model_json_valid"] is True
                good_json += 1
                calls += 1
            else:
                assert row["raw_model_json_valid"] is None
            assert row["answer"]["model"] == "Qwen2.5-0.5B-Instruct Q4_K_M"
        score = scoreboard[mode]
        check(score["correct_total"] == sum(bool(row["correct"]) for row in rows),
              f"{mode}: total de acertos coincide com as 17 saídas individuais")
        check(score["raw_model_json_valid"] == good_json
              and score["raw_model_calls"] == calls,
              f"{mode}: JSON bruto da LLM válido em {good_json}/{calls} chamadas")
        check(score["api_json_valid"] == len(rows) == 17,
              f"{mode}: 17/17 respostas de API com esquema válido")
        raw_count[mode] = {"valid": good_json, "calls": calls}
        verified_returns[mode] = len(rows)

    agent = records_by_mode["rag_agent"]
    unanswerable = [row for row in agent if not row["expected_sources"]]
    check(len(unanswerable) == 6 and all(row["answer"]["refused"]
          and not row["answer"]["citations"] for row in unanswerable),
          "Agente: 6/6 casos sem evidência recusados e sem citações indevidas")
    check(all("recuperar_trechos" in row["answer"]["actions"] for row in agent),
          "Agente registra uso da ferramenta de recuperação")
    check(any("restringir_à_fonte_recuperada" in row["answer"]["actions"] for row in agent),
          "Agente usa seleção de fonte mais forte quando apropriado")
    check(any("recusar_sem_evidência" in row["answer"]["actions"] for row in agent),
          "Agente tem rota verificável de recusa anterior à inferência")
    check(scoreboard["baseline"]["correct_total"] == 4
          and scoreboard["rag"]["correct_total"] == 8
          and scoreboard["rag_agent"]["correct_total"] == 11,
          "Placar reproduzido: 4/17 -> 8/17 -> 11/17 (+3 sobre RAG)")
    check(all(row["answer"]["actions"] != records_by_mode["rag"][i]["answer"]["actions"]
              for i, row in enumerate(agent)),
          "Fluxo agente tem decisões adicionais distintas do RAG simples")

    for case_id in ("g01", "g04", "g05", "g08", "g09"):
        check(any(row["id"] == case_id and row["correct"] is False for row in agent)
              and case_id in report, f"{case_id}: erro real registrado e analisado")
    check("## Conclusão técnica" in report and "flowchart TD" in report,
          "Relatório inclui conclusão e diagrama")
    check(sum(bool(cell.get("outputs")) for cell in notebook["cells"]
              if cell.get("cell_type") == "code") >= 4,
          "Notebook entregue com saídas de execução")

    return {
        "modelo": model["model"],
        "modelo_sha256": model["sha256"],
        "recuperacao": {
            "n_respondiveis": 11,
            "recall_at_1": 1.0, "recall_at_3": 1.0,
            "limiar": 0.46,
            "calibracao_respondiveis_mantidos": "7/7",
            "calibracao_desconhecidos_bloqueados": "4/5",
        },
        "geracao_fundamentada": {
            "api_json_valido": {mode: f"{n}/17" for mode, n in verified_returns.items()},
            "json_bruto_llm": {mode: f"{value['valid']}/{value['calls']}"
                               for mode, value in raw_count.items()},
            "recusas_corretas_agente": "6/6",
            "citacoes_com_id_existente_e_recuperado": True,
        },
        "especializacao": {
            "metodo": "agente; não LoRA nem ajuste de pesos",
            "comparacao": {mode: f"{scoreboard[mode]['correct_total']}/17" for mode in modes},
            "ganho_agente_versus_rag": 3,
            "trilha_de_acoes_por_pergunta": True,
        },
        "limites": "Métricas no conjunto acadêmico pequeno; não representam precisão universal.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    summary = audit()
    print("\nRELATÓRIO DE AUDITORIA\n" + json.dumps(summary, ensure_ascii=False, indent=2))
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
