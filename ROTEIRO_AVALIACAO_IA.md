# Roteiro do avaliador — Generative AI for Engineering

**Global Solution FIAP 2026.2 · Pátio Monitor · Data de entrega: 19/11/2026**

Este roteiro acompanha o repositório e permite verificar, sem instruções orais da equipe, os oito critérios de pontuação e os sete elementos do relatório.

**Integrantes:** Gabriel Teixeira Machado — RM551570; Felipe Bressani — RM97688; Camila do Prado Padalino — RM98316.

## Comece pelo teste funcional na URL pública

**URL:** https://patio-monitor-production.up.railway.app/

1. Abra a URL numa janela anônima do Chrome. O terminal 3D e o botão **Iniciar teste guiado** devem aparecer.
2. Clique **Iniciar teste guiado** e, na primeira etapa, **Abrir caso de exemplo**. É um cenário demonstrativo identificado como tal, com saída **PM-0615**, escala **8 2361** e portaria **7 8042**.
3. Clique **Ir para a explicação**. O diagnóstico da divergência deve aparecer, derivado das regras de conciliação.
4. Clique **Explicar ocorrência**. Aguarde a resposta do modelo **Qwen2.5-0.5B-Instruct Q4_K_M**, identificada como **Orientação gerada pelo assistente**, acompanhada da seção **Fontes consultadas** e da fonte operacional **p02**. A chamada é feita de fato ao endpoint **POST /api/gs/explain** no servidor da plataforma.
5. Clique **Ver gravação** para conferir a evidência visual do componente de Computer Vision. Selecione a passagem **Esquerda → direita · 00:07,4**; o vídeo deve avançar para aproximadamente 7,44 segundos. Finalize com **Concluir teste**.

A demonstração de IA usa um **caso de exemplo sintético**; a chamada ao Qwen, a recuperação de documentos e a resposta são executadas no servidor. A câmera usa gravação pública processada. O GPS da tela principal, quando disponível, é de uma fonte independente.

A aplicação possui um **tour operacional**. As evidências acadêmicas de treinamento/especialização, métricas e análise de erros são verificadas nos arquivos abaixo; não são etapas clicáveis do tour.

## Rubrica: oito verificações objetivas

| Pontos | Requisito | Evidência e como conferir |
|---:|---|---|
| 0,5 | **1. Tarefa da IA, casos e “não consta”** | Abra [avaliacao/gabarito.json](avaliacao/gabarito.json): 17 casos, 11 respondíveis e 6 sem fonte esperada (`expected_sources: []`). Veja a definição da tarefa no [relatório](docs/gs/GENAI.md#ficha-técnica). |
| 1,0 | **2. Base de conhecimento com fonte** | Abra [base/corpus.json](base/corpus.json): 10 trechos com `id`, `title`, `url`, `rights` e `text`. A tabela de origem, formato, direitos e quantidade está no [relatório](docs/gs/GENAI.md#dados-e-arquitetura). |
| 1,0 | **3. Recall@1, Recall@3 e limiar** | Abra [gs/genai/evaluation.json](gs/genai/evaluation.json): em `retrieval`, `recall_at_1=1.0` e `recall_at_3=1.0` sobre as 11 perguntas com fonte; em `calibration` há a varredura dos limiares. Em [assistant.py](services/api/app/assistant.py), `MIN_SCORE=0.46`. O relatório explica a escolha: 7/7 respondíveis mantidos e 4/5 desconhecidos bloqueados no conjunto de calibração. |
| 2,0 | **4. JSON válido, fontes e recusa** | Veja [assistant.py](services/api/app/assistant.py), modelos `ModelOutput` e `Explanation`, `ask_model()` e `run_query()`. Os resultados de cada pergunta, incluindo respostas brutas da LLM, campos `citations` e `refused`, estão em [avaliacao/placar.json](avaliacao/placar.json). Execute também o teste de recusa abaixo. |
| 2,0 | **5. Especialização (LoRA ou agente) versus RAG** | A implementação escolheu **agente**, não LoRA. Em [assistant.py](services/api/app/assistant.py), `run_query()` implementa `baseline`, `rag` e `rag_agent` com seleção de consulta, limiar, validação de fontes e números e recusa. Em [evaluate.py](gs/genai/evaluate.py), os três modos são executados sobre o mesmo Qwen e o mesmo gabarito. |
| 2,0 | **6. Placar das três configurações** | Veja o campo `scoreboard` em [avaliacao/placar.json](avaliacao/placar.json), o [notebook com saídas](notebooks/avaliacao.ipynb) e a interpretação no [relatório](docs/gs/GENAI.md#resultados). Acertos: **4/17** (sem contexto), **8/17** (RAG), **11/17** (RAG + agente). |
| 1,0 | **7. Cinco erros reais e correções propostas** | O [relatório — Erros observados](docs/gs/GENAI.md#erros-observados) detalha os casos **g01, g04, g05, g08 e g09**, com a resposta obtida, causa e próximo ajuste, e registra a regressão corrigida de g12. Encontre as respostas em `results` no JSON do experimento. |
| 0,5 | **8. README e reprodução** | Siga [gs/genai/README.md](gs/genai/README.md) para instalar o runtime, baixar o Qwen original com SHA-256 validado e refazer o experimento. O [notebook](notebooks/avaliacao.ipynb) possui cinco células de código com saídas salvas. |

**Limite dos resultados:** Recall@1/3 de 100% significa recuperação da fonte esperada **neste conjunto pequeno e escrito para o domínio**, não 100% de respostas corretas ou precisão universal. O melhor sistema acertou 11 das 17 perguntas avaliadas, com seis recusas corretas entre seis casos sem evidência.

## Teste de recusa (“não consta”) pela API pública

No PowerShell, sem instalar Python, execute:

```powershell
$uri = "https://patio-monitor-production.up.railway.app/api/gs/explain"
$payload = @{ question = "Qual é a senha do motorista?" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($payload)) | ConvertTo-Json -Depth 6
```

**Resultado esperado:** `"refused": true`, `"citations": []`, e mensagem de que a informação não consta nas fontes. O campo `actions` registra a recuperação e recusa. **Uma indisponibilidade HTTP 503 ou 429 não é um resultado válido do teste**; nesse caso, a inferência não pôde ser confirmada e deve ser repetida.

Para verificar a resposta com fonte pelo mesmo caminho:

```powershell
$payload = @{
  question = "Que evidências devo verificar e qual é o próximo passo para revisar esta ocorrência?"
  context = @{ tripId="PM-0615"; status="divergent"; reason="vehicle_swap"; evidenceMode="DEMO" }
} | ConvertTo-Json -Depth 4 -Compress
Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($payload)) | ConvertTo-Json -Depth 6
```

**Resultado esperado:** `refused=false`, texto de orientação e citação `p02` em `citations`. O motor de conciliação calcula o diagnóstico documental; a LLM gera orientação operacional fundamentada.

## Como reproduzir o experimento sem depender da URL pública

A partir de Windows PowerShell, com Python 3.12 e Git instalados:

```powershell
git clone https://github.com/MachadONLY/patio-monitor-ia-generativa.git
cd patio-monitor-ia-generativa
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r services/api/requirements.txt
.\.venv\Scripts\python -m pip install -r services/api/requirements-ai.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu
.\.venv\Scripts\python gs/genai/download_model.py gs/genai/qwen.gguf
$env:PATIO_LLM_MODEL_PATH = (Resolve-Path gs/genai/qwen.gguf).Path
.\.venv\Scripts\python gs/genai/evaluate.py --out gs/genai/avaliacao-conferencia.json
```

A inferência é **local em CPU**, sem necessidade de chave comercial de IA, e usa o modelo previamente treinado Qwen2.5-0.5B-Instruct. O peso original GGUF é baixado e validado pelo hash do [manifesto](gs/genai/model.json). O tempo e o sucesso do download dependem do ambiente e da conectividade do avaliador. O script produz um novo placar, que pode variar se versões, hardware ou geração não forem idênticos.

**Distinção acadêmica:** nesta implementação não foi feito ajuste de pesos do Qwen, fine-tuning nem LoRA. A especialização foi feita por **agente + recuperação e validações**, a alternativa explicitamente prevista no item 5 da rubrica. Não interpretar o uso do modelo previamente treinado como evidência de treinamento de parâmetros feito pela equipe.

## Sete elementos exigidos no relatório

1. **Nome completo e RM:** início do [relatório](docs/gs/GENAI.md).
2. **Ficha técnica e tarefa:** [Ficha técnica](docs/gs/GENAI.md#ficha-técnica).
3. **Diagrama do pipeline da IA e dos documentos:** fluxograma Mermaid em [Dados e arquitetura](docs/gs/GENAI.md#dados-e-arquitetura).
4. **Tabela de fontes, formato, licença e número de trechos:** tabela na mesma seção; quando a licença do original não foi identificada, isso está declarado.
5. **Performance de cada configuração:** [Resultados](docs/gs/GENAI.md#resultados), avaliação JSON e notebook.
6. **Cinco erros, causas e correções:** [Erros observados](docs/gs/GENAI.md#erros-observados).
7. **Conclusão e links:** [Conclusão técnica](docs/gs/GENAI.md#conclusão-técnica) e os links abaixo.

## Links da entrega

- **Repositório:** https://github.com/MachadONLY/patio-monitor-ia-generativa
- **Relatório:** [docs/gs/GENAI.md](docs/gs/GENAI.md)
- **Vídeo principal — gravação real do fluxo no navegador:** [docs/gs/genai/demonstracao-navegador-real.mp4](docs/gs/genai/demonstracao-navegador-real.mp4). A captura verifica a chamada real ao Qwen, a fonte p02 e a navegação pela visão computacional.
- **Apresentação complementar:** [docs/gs/genai/demonstracao.mp4](docs/gs/genai/demonstracao.mp4) (resumo com métricas e capturas).
- **Plataforma:** https://patio-monitor-production.up.railway.app/
- **Teste automatizado na produção em 19/11/2026 (10 de 10 aprovados; Qwen, visão, n8n e GPS reais):** https://github.com/MachadONLY/patio-monitor-ia-generativa/actions/runs/44637525854
- **Reprodução independente em 19/11/2026 (51 inferências reais do Qwen e mesmo placar):** https://github.com/MachadONLY/patio-monitor-ia-generativa/actions/runs/44637894029
