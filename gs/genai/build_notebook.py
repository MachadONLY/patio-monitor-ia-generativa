"""Execute analysis cells over the recorded local inference data and store an ipynb."""

from contextlib import redirect_stdout
from io import StringIO
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

CELLS = [
    ("markdown", """# Pátio Monitor · Avaliação de IA generativa

As saídas abaixo foram executadas sobre a avaliação com Qwen2.5-0.5B-Instruct local. O JSON de entrada conserva as 51 respostas, incluindo recusas, latência e fontes. Abra este notebook a partir de `gs/genai` ou da raiz do repositório.

Para refazer a inferência, instale as dependências e baixe o peso de acordo com o README, configure `PATIO_LLM_MODEL_PATH` e rode `python gs/genai/evaluate.py` a partir da raiz. Estas células analisam os resultados gerados."""),
    ("code", """from pathlib import Path
import json
root = Path.cwd()
data_file = root / 'evaluation.json'
if not data_file.exists():
    data_file = root / 'gs' / 'genai' / 'evaluation.json'
report = json.loads(data_file.read_text(encoding='utf-8'))
print('Modelo:', report['model_name'])
print('SHA-256:', report['model_sha256'])
print('Threads:', report['threads'], '| camadas GPU:', report['n_gpu_layers'])
print('Temperatura:', report['temperature'], '| seed:', report['seed'])
print('Casos por método:', report['retrieval']['n'])"""),
    ("code", """retriever = report['retrieval']
calibration = report['calibration']
cutoff = report['threshold']
print(f"Recall@1 = {retriever['recall_at_1']:.1%}")
print(f"Recall@3 = {retriever['recall_at_3']:.1%}")
print(f"Perguntas gabaritadas com fonte: {retriever['answerable']}")
print('Limiar:', cutoff)
print('Calibração:', next(row for row in calibration['threshold_sweep'] if row['threshold'] == cutoff))"""),
    ("code", """for mode, result in report['scoreboard'].items():
    print(mode)
    for metric, value in result.items():
        print(f'  {metric}: {value}')"""),
    ("code", """sample = next(item for item in report['results'] if item['id'] == 'g17' and item['mode'] == 'rag_agent')
print('Pergunta:', sample['question'])
print('Fontes recuperadas:', sample['retrieved'])
print(json.dumps(sample['answer'], ensure_ascii=False, indent=2))"""),
    ("code", """failures = [item for item in report['results'] if not item['correct']]
for case_id in ['g01', 'g03', 'g05', 'g09', 'g11']:
    item = next(row for row in failures if row['id'] == case_id)
    print(item['mode'], item['id'], item['question'])
    print('  Gabarito:', item['expected'])
    print('  Saída:', item['answer']['answer'])"""),
]


def main():
    import os
    os.chdir(HERE)
    state = {}
    cells = []
    counter = 0
    for index, (kind, source) in enumerate(CELLS, 1):
        cell = {"id": f"avaliacao-{index}", "cell_type": kind, "metadata": {}, "source": source.splitlines(keepends=True)}
        if kind == "code":
            counter += 1
            stdout = StringIO()
            with redirect_stdout(stdout):
                exec(compile(source, f"Notebook cell {counter}", "exec"), state)
            cell.update(execution_count=counter, outputs=[
                {"name": "stdout", "output_type": "stream", "text": stdout.getvalue().splitlines(keepends=True)}
            ])
        cells.append(cell)
    document = {
        "cells": cells, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python",
                                                   "name": "python3"},
                                    "language_info": {"name": "python", "version": "3.12"}},
        "nbformat": 4, "nbformat_minor": 5,
    }
    (HERE / "avaliacao.ipynb").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
