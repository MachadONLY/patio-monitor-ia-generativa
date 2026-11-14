# Assistente local de revisão de saídas

A tarefa é orientar a revisão de ocorrências de saída com apoio da documentação da aplicação e da API Olho Vivo. Saídas da garagem, partidas em linha e posição GPS são evidências distintas no domínio analisado. As perguntas gabaritadas abrangem regras de conciliação, procedência, autenticação, falta de evidência e uma ocorrência estruturada.

## Reproduzir no terminal

A instalação e o download exigem rede. A inferência roda no computador com o peso local. O artefato GGUF oficial tem aproximadamente 469 MiB. O script valida o SHA-256 registrado em `model.json`.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r services/api/requirements.txt
.\.venv\Scripts\python -m pip install -r services/api/requirements-ai.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
.\.venv\Scripts\python gs/genai/download_model.py gs/genai/qwen.gguf
$env:PATIO_LLM_MODEL_PATH = (Resolve-Path gs/genai/qwen.gguf).Path
.\.venv\Scripts\python gs/genai/evaluate.py
.\.venv\Scripts\python -m uvicorn app.main:app --app-dir services/api --host 127.0.0.1 --port 8000
```

Em Linux, use `python3 -m venv .venv`, o executável `.venv/bin/python` e `export PATIO_LLM_MODEL_PATH="$(pwd)/gs/genai/qwen.gguf"`. A variável opcional `PATIO_LLM_THREADS` escolhe as threads de CPU. A disponibilidade de uma wheel pré-compilada depende da plataforma. Em sua ausência, consulte o runtime, que requer CMake e um compilador C/C++.

Na interface, abra **Revisar turno**, selecione a ocorrência `PM-0615` do DEMO e use **Explicar ocorrência**. O endpoint `POST /api/gs/explain` recebe uma pergunta e um contexto estruturado opcional. A interface transmite um rótulo de ocorrência e o motivo, sem notas ou arquivos locais. Com o modelo ausente, o endpoint responde 503. A recusa fundamentada sai como JSON com `refused: true`. A inferência é serializada por processo e solicitações concorrentes recebem 429.

## Arquivos

| Arquivo | Uso |
|---|---|
| [Corpus](../../services/api/app/assistant_data/corpus.json) | Dez trechos em JSON UTF-8, cada registro é uma unidade de recuperação com ID, título, URL, direitos e texto. Oito trechos originais descrevem práticas do projeto. Dois resumem a documentação oficial em formulação própria. A licença de republicação do texto original da SPTrans não foi identificada. |
| [Gabarito](gold.json) | Dezessete perguntas com resposta esperada, trechos relevantes e critérios lexicais. Há seis casos sem informação no corpus. |
| [Calibração](calibration.json) | Doze perguntas distintas, reservadas para justificar o limiar. |
| [Avaliação](evaluate.py) | Mede as três configurações com o mesmo peso, decodificação determinística e gabarito. |
| [Resultados](evaluation.json) | Saídas JSON, fontes recuperadas, latências e métricas observadas. |
| [Notebook](avaliacao.ipynb) | Células de análise com saídas registradas e comando de reprodução. |
| [Relatório](../../docs/gs/GENAI.md) | Método, resultados e erros observados. |
