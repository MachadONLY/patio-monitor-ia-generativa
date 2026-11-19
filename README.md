# Pátio Monitor · Generative AI for Engineering

> **Avaliação FIAP — comece aqui:** [Roteiro completo do professor (8 critérios + 7 entregáveis + testes reais)](ROTEIRO_AVALIACAO_IA.md).
> 
> O percurso no navegador demonstra a inferência e as fontes; o roteiro reúne as evidências acadêmicas do modelo, corpus, recuperação, placar, erros e reprodutibilidade. A especialização adotada é por **agente**, alternativa prevista na rubrica; não foi realizado fine-tuning/LoRA nos pesos da LLM.


FIAP · Global Solution 2026.2 · Engenharia de Software

Assistente local para explicar divergências entre escala e portaria, com citação das fontes e recusa quando faltam evidências. O experimento compara o mesmo modelo sem contexto, com RAG e com RAG e agente.

[Relatório técnico](docs/gs/GENAI.md) · [Notebook executado](gs/genai/avaliacao.ipynb) · [Resultados brutos](gs/genai/evaluation.json) · [Vídeo real do teste guiado](docs/gs/genai/demonstracao-navegador-real.mp4) · [Apresentação complementar](docs/gs/genai/demonstracao.mp4)

O Pátio Monitor acompanha ônibus pelo GPS e ajuda a revisar divergências entre escala e portaria. A tela abre no Terminal Alvorada, com a implantação em 3D, posições do BRT do Rio e acesso direto à gravação analisada e à revisão de turno.

## Entregáveis organizados pela rubrica

O material de IA está disponível também na estrutura solicitada pelo enunciado oficial da Global Solution:

| Pasta | Conteúdo |
|---|---|
| [notebooks/](notebooks/) | [Notebook de avaliação executado, com saídas salvas](notebooks/avaliacao.ipynb) |
| [base/](base/) | [Corpus de trechos, fontes e direitos](base/corpus.json) |
| [avaliacao/](avaliacao/) | [Gabarito de 17 casos](avaliacao/gabarito.json) e [placar das três configurações, com as 51 respostas](avaliacao/placar.json) |

Os arquivos dessa estrutura são cópias fiéis dos dados experimentais também usados pelo código em `gs/genai/` e `services/api/app/assistant_data/`. A explicação da arquitetura, a justificativa do limiar, as métricas e os cinco erros reais estão no [relatório técnico](docs/gs/GENAI.md).

## Teste direto para o professor

1. Abra o MVP pelo link público informado no Teams e clique em **Iniciar teste guiado**.
2. Selecione **Abrir caso de exemplo → Ir para a explicação → Explicar ocorrência**. O app deve exibir o diagnóstico de dois prefixos diferentes (`8 2361` na escala, `7 8042` na portaria) e a resposta do **Qwen local**, com a fonte da regra consultada.
3. Clique em **Ver gravação** para conferir a visão computacional integrada. Para testar arquivos próprios, abra **Revisar turno** e baixe os dois CSVs de exemplo preenchidos ou importe uma escala e uma portaria da operação.

A regra calcula uma **divergência documental**; o aplicativo não confirma uma substituição física sem evidência. A resposta do modelo é orientação complementar, não autorização automática de saída. [Prova de teste com Qwen real](docs/gs/genai/prova-qwen-real.png) · [Resultados do experimento](gs/genai/evaluation.json).

## Ficha técnica

| Campo | Pátio Monitor |
|---|---|
| Cidadão e território | Passageiros e equipes de operação de terminais urbanos. Terminal Alvorada e entorno na Barra da Tijuca (RJ), com posições do BRT em tempo real. |
| Problema | Divergências entre escala, portaria e posição dificultam a conferência de saídas e a investigação de atrasos. |
| Proposta de valor | Reunir posição e evidência por veículo, destacar ocorrências de turno e oferecer uma explicação com fonte para revisão humana. |
| Arquitetura | Vite, React, Three.js, FastAPI, WebSocket, análise de vídeo com OpenCV e inferência local via llama.cpp. |
| Fontes | SPTrans Olho Vivo com credencial, GTFS Realtime da SMTR / MOBI-Rio, gravação pública com licença e CSVs fornecidos pelo operador. |
| Modelos | Qwen2.5-0.5B-Instruct com RAG e agente, e YOLOX com cabeças treinadas de classificação e ajuste de caixas. |
| Repositório | [MachadONLY/patio-monitor-ia-generativa](https://github.com/MachadONLY/patio-monitor-ia-generativa) |
| Indicadores | Tempo para revisar uma saída, taxa de saídas confirmadas e idade da observação GPS. |
| ODS | ODS 9 e ODS 11. |

## Executar

Siga o [guia para Windows e Linux](deploy/README.md). Ele inicia o frontend, o FastAPI e o Qwen local em um único endereço. Com `PATIO_LIVE_PROVIDER=rio_brt`, a plataforma recebe o feed público do BRT do Rio sem chave de API.

## Operação

- **Terminal** aproxima a câmera das pistas e coberturas do Alvorada. **Entorno** amplia o enquadramento. As duas ações mudam apenas a câmera.
- Selecione um ônibus no mapa ou na lista para abrir a ficha com prefixo, linha, coordenadas e horário da leitura. **Histórico** consulta posições coletadas pelo servidor quando a persistência está configurada.
- **Câmera do portão** dá acesso à gravação processada e aos cruzamentos identificados. Confira a procedência exibida no player.
- **Monitoramento da Cancela** consulta os eventos do protótipo Smart Bus Gate registrados pelo n8n. Veja a [integração de RPA](docs/gs/rpa/README.md).
- **Entradas e saídas** lista as travessias estimadas pelo GPS, com horário e acesso à ficha dos veículos presentes no recorte.
- **Revisar turno** compara os CSVs de escala e portaria da operação e permite consultar uma explicação com fonte.

A cena 3D usa ortofoto e alturas fotogramétricas do IPP, além da cartografia do OpenStreetMap. A ficha preserva a coordenada recebida. [Procedência e limites do modelo](docs/SOURCES.md#terminal-alvorada).

## Fechamento de turno

Abra **Revisar turno** no painel lateral e importe os CSVs da operação. Selecione uma saída para consultar escala, portaria e posição disponível na cena. Registre uma conclusão e exporte a revisão. O CSV de exportação registra a leitura de portaria e a decisão humana em campos separados.

Para revisar seus dados, carregue um par de CSVs UTF-8 com vírgula ou ponto e vírgula. O painel oferece modelos de ambos.

| Arquivo | Colunas obrigatórias | Coluna opcional |
|---|---|---|
| Escala | `trip_id,vehicle_id,planned_at` | `route` |
| Portaria | `event_id,vehicle_id,observed_at,direction` | `trip_id` |

Use um identificador de veículo consistente nos dois arquivos, IDs únicos por saída/evento e datas ISO 8601 com fuso, como `2026-11-06T06:00:00-03:00`. A escala deve conter um único turno, com intervalo inferior a 24 horas. A direção da portaria é `IN` ou `OUT`. Um arquivo de portaria com apenas o cabeçalho representa ausência de registros.

Se os CSVs tiverem cabeçalhos próprios, a revisão abre o mapeamento de colunas. Use a prévia e confirme as correspondências ou aplique as sugestões por arquivo. Para horários como `06/11/2026 06:00`, escolha explicitamente o offset indicado pela operação. Horários ISO com offset conservam o original. No modo com mapeamento, o campo de direção também aceita `Entrada` e `Saída`. Os dois arquivos ainda precisam usar o mesmo identificador de veículo e pertencer à mesma garagem e ao mesmo turno.

- **Vínculo por saída.** Um registro `OUT` com `trip_id` tem prioridade. Registros duplicados para a mesma saída, veículo diferente da escala ou horário fora de −60 a +180 minutos aparecem como divergências.
- **Vínculo por veículo e horário.** Sem `trip_id`, a janela é de −15 a +60 minutos. O vínculo exige um candidato único em ambos os sentidos. Acima de cinco minutos de atraso, a saída vinculada aparece como atrasada. Mais de cinco minutos de antecedência exige revisão.
- **Evidência.** A passagem é confirmada pelo registro de portaria aceito na conciliação. A observação GPS complementa a investigação. Uma saída da garagem é distinta do início da viagem comercial. Uma saída sem registro suficiente permanece sem confirmação.

Os arquivos de entrada são processados no navegador. As conclusões são locais ao perfil do navegador e ao conjunto de dados. Para reabrir sem reimportar, use **Guardar turno neste navegador**. O histórico guarda apenas os campos necessários à revisão. **Excluir turno** remove os registros guardados e as conclusões correspondentes após confirmação. A opção de reimportar os mesmos arquivos, com o mesmo mapeamento quando houver, também recupera as conclusões. Exporte a revisão para guardá-la fora do navegador.

<a id="modos-de-dados"></a>

## Origem das posições e histórico

O feed público da SMTR / MOBI-Rio fornece posições para o entorno do Alvorada. Para usar a SPTrans, configure no servidor `PATIO_LIVE_PROVIDER=sptrans`, `SPTRANS_TOKEN` ou `SPTRANS_TOKEN_FILE` e `PATIO_AREA_FILE`. A forma do perímetro e os campos das posições estão no [contrato da API](packages/contracts/README.md).

Com `PATIO_ARCHIVE_FILE` apontando para um SQLite gravável, o servidor arquiva as observações originais dentro do recorte. A persistência separa fonte, perímetro e filtro por empresa, deduplica por veículo e instante e limita a retenção a 14 dias ou um milhão de linhas. O histórico por ônibus está na ficha, junto da observação mais recente.

A vista única combina o GPS com cartografia OSM, ortofoto do IPP e alturas de edifícios medidas pelo município quando há correspondência suficiente. A câmera acompanha a posição do veículo durante a inspeção. [Fontes e parâmetros da cena](docs/SOURCES.md#terminal-alvorada).

No Alvorada, o painel **Entradas e saídas** registra cruzamentos inferidos a partir de duas leituras consecutivas dentro e fora do perímetro, com margem de 15 m ao redor do limite. O evento traz o intervalo entre a última leitura do lado de origem e a primeira do lado de destino. O acompanhamento começa quando o SQLite está habilitado. O painel mantém até 14 dias de eventos dentro dos limites de retenção e mostra até 40 passagens recentes.

A posição recebida expressa uma leitura GPS. Para confirmar saída ou entrada física, use registros de portaria. A gravação pública fornecida na entrega é de Praga e tem procedência própria.

## Execução em contêiner local

Com Docker Compose, crie `runtime-data` na raiz e execute `docker compose up --build`. Abra `http://127.0.0.1:8080`. O Caddy publica a interface apenas no loopback, encaminha a API e faz a atualização WebSocket na mesma origem. Os processos usam UID 10001, sistema de arquivos de contêiner somente leitura e nenhuma capability adicional. A API grava os dados GPS e os cruzamentos no volume local `patio_observations`.

Para ativar a SPTrans nessa configuração, coloque o token e o perímetro em `runtime-data`, com permissões de leitura para o UID 10001. Copie `.env.example` para `.env` e defina `SPTRANS_TOKEN_FILE=/run/patio/sptrans-token.txt` e `PATIO_AREA_FILE=/run/patio/area.json`. O diretório é montado somente para leitura na API. A interface recebe apenas as observações normalizadas.

O perfil Compose é local. Uma implantação remota exige TLS, autenticação de acesso à aplicação e configuração de `PATIO_PUBLIC_ORIGIN` conforme a origem HTTPS real.

## Testar e regenerar

```sh
(cd services/api && python -m pytest -q)
pnpm build
pnpm --filter @patio/web exec playwright install chromium
pnpm test
blender -b -t 2 -P assets/build_bus.py
blender -b -t 4 -P assets/render_bus_portraits.py
```

Os testes de navegador iniciam a API offline em 8000 e o frontend de produção em 4174. Feche processos locais que estejam usando essas portas antes de testar. Use `CHROMIUM_PATH` para um executável Chromium de testes previamente instalado. As capturas ficam em `docs/qa`. A procedência e licença do ônibus estão em [models/LICENSE.md](apps/web/public/models/LICENSE.md).

## Escopo operacional

O build contém câmera, inspeção de malha, sessão SPTrans server-side, polling compartilhado, deduplicação por prefixo, projeção métrica e replay assinado. A sessão usa HTTPS, timeout, renovação após 401/403 e espera crescente em falhas. O canal `/api/vehicles/live` transmite os snapshots aos navegadores conectados e limita a origem e o número de conexões. A interface recupera dados por HTTP enquanto tenta restabelecer o canal. Observações antigas mantêm o horário original e aparecem sinalizadas.

Uma implantação institucional requer validação da cobertura GPS e dos portões em campo, credenciais, autenticação da plataforma, observabilidade e testes nos dispositivos usados pelos operadores.

## Componentes da Global Solution

Instale as dependências da API e o runtime de IA e baixe o modelo na raiz do repositório.

```sh
python -m pip install -r services/api/requirements.txt
python -m pip install --only-binary=:all: --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu -r services/api/requirements-ai.txt
python gs/genai/download_model.py runtime-data/qwen.gguf
```

No PowerShell, inicie o backend em um terminal e mantenha o frontend em outro.

```powershell
$env:PATIO_LLM_MODEL_PATH = (Resolve-Path "runtime-data/qwen.gguf").Path
$env:PATIO_LIVE_PROVIDER = "rio_brt"
python -m uvicorn app.main:app --app-dir services/api --host 127.0.0.1 --port 8000
```

- **Visão computacional.** Abra **Câmera do portão** para assistir à gravação anotada e ir diretamente aos instantes de cruzamento. A direção é relativa à imagem e a evidência visual mantém o vínculo com a gravação original. Consulte o [relatório e o roteiro de visão](docs/gs/cv/README.md).
- **IA generativa.** Em **Fechamento de turno**, abra uma ocorrência e clique em **Explicar ocorrência** para consultar as fontes com a LLM local. O servidor recebe o tipo da ocorrência e sua origem. Os registros de CSV importados e as conclusões da equipe ficam no navegador. Consulte a [avaliação e a execução da LLM](gs/genai/README.md).
- **GPS real.** O servidor usa o Olho Vivo com a configuração da SPTrans. Para executar com o feed público do BRT do Rio, defina `PATIO_LIVE_PROVIDER=rio_brt` no servidor e abra a interface. O recorte padrão fica no entorno do Terminal Alvorada e mostra posições observadas com horário de cada veículo. O recorte é geográfico e os dados têm atribuição à SMTR / MOBI-Rio sob CC BY 4.0. [Dados GTFS Realtime](https://dados.mobilidade.rio/gtfs/realtime) · [catálogo e licença](https://www.transit.land/data/feeds/f-75cj-mobi~rio~rt).
