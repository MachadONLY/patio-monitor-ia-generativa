# Pátio Monitor · Generative AI for Engineering

FIAP · Global Solution 2026.2 · Engenharia de Software

Assistente local para explicar divergências entre escala e portaria, com citação das fontes e recusa quando faltam evidências. O experimento compara o mesmo modelo sem contexto, com RAG e com RAG e agente.

[Relatório técnico](docs/gs/GENAI.md) · [Notebook executado](gs/genai/avaliacao.ipynb) · [Resultados brutos](gs/genai/evaluation.json) · [Vídeo](docs/gs/genai/demonstracao.mp4)

Visualização 3D de operações de ônibus para equipes de mobilidade urbana. O primeiro recorte mostra um pátio paulistano ilustrativo com oito ônibus autorais. Arraste para orbitar, arraste com o botão direito para deslocar e use a roda ou os controles para aproximar. Clique em um ônibus ou abra a lista para selecioná-lo. O painel oferece foco, vista de perfil e vista superior. Em DEMO, **Seguir ônibus** trava o centro da câmera no veículo selecionado durante a operação. **Vista do bairro** abre o enquadramento e **Restaurar vista geral** retorna ao pátio.

## Ficha técnica

| Campo | Pátio Monitor |
|---|---|
| Cidadão e território | Passageiros e equipes de operação de terminais urbanos. Cenário 3D inspirado em Pirituba (SP) e recorte GPS do BRT no entorno do Terminal Alvorada (RJ). |
| Problema | Divergências entre escala, portaria e posição dificultam a conferência de saídas e a investigação de atrasos. |
| Proposta de valor | Reunir posição e evidência por veículo, destacar ocorrências de turno e oferecer uma explicação com fonte para revisão humana. |
| Arquitetura | Vite, React, Three.js, FastAPI, WebSocket, análise de vídeo com OpenCV e inferência local via llama.cpp. |
| Fontes | SPTrans Olho Vivo com credencial, GTFS Realtime da SMTR / MOBI-Rio, gravação pública com licença e CSVs fornecidos pelo operador. |
| Modelos | Qwen2.5-0.5B-Instruct com RAG e agente, e YOLOX com cabeças treinadas de classificação e ajuste de caixas. |
| Repositório | [MachadONLY/patio-monitor-ia-generativa](https://github.com/MachadONLY/patio-monitor-ia-generativa) |
| Indicadores | Tempo para revisar uma saída, taxa de saídas confirmadas e idade da observação GPS. |
| ODS | ODS 9 e ODS 11. |

## Executar

Para usar o DEMO e a revisão de turno, execute na pasta que contém o `package.json`. Use Node 24, pnpm 11.25.0 e um navegador com WebGL 2.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

No PowerShell, use `pnpm.cmd` se a execução de scripts estiver bloqueada. Abra o endereço da linha `Local` impresso pelo Vite.

Para ativar os modos de GPS LIVE e REPLAY, inicie também o backend em outro terminal com Python 3.12.

```sh
python -m pip install -r services/api/requirements-dev.txt
python -m uvicorn app.main:app --app-dir services/api --host 127.0.0.1 --port 8000
```

Para o build, execute `pnpm build`. O Vite encaminha REST, WebSocket e health check ao FastAPI na mesma origem. O FastAPI desta entrega usa **um processo** para manter uma sessão e um coletor upstream.

## Operação contínua

O modo **DEMO** abre com o terminal em funcionamento. Os oito ônibus percorrem a via urbana, usam portarias de entrada e saída separadas e alternam entre dez baias de passagem. A circulação interna usa corredores de sentido único, curvas de raio de 9 m e baias de 15 m. Depois de sair do trecho modelado, cada veículo fica identificado como **Em rota** até aparecer de novo. O diário conta as passagens na portaria e exibe os três registros mais recentes. Selecione um registro para acompanhar o ônibus.

O relógio usa o tempo transcorrido desde a abertura da página. A operação segue após o primeiro ciclo e retoma no instante corrente após voltar de outra aba. A preferência de movimento reduzido atualiza as posições em passos de um segundo. Recarregar a página inicia uma nova sessão DEMO. Não há coleta nem controle operacional nesse modo.

### Referência urbana

**Terminal Pátio Leste** é um cenário autoral em escala métrica, inspirado pelo [memorial do Terminal Pirituba](https://unamunizviegas.com.br/projeto/terminal-pirituba-2002/) e pela [ficha oficial da SPTrans](https://www.sptrans.com.br/terminais/pirituba/). A composição adapta a relação entre a avenida e a ferrovia, as ilhas com coberturas metálicas independentes e o acesso separado para passageiros. O perímetro, as ruas, as baias e os horários são esquemáticos. O cenário não tem o georreferenciamento de Pirituba.

**LIVE** segue posições geográficas recebidas e **REPLAY** usa a captura assinada. Cada modo conserva suas fontes e horários e é independente da operação DEMO.

O terminal de passageiros do cenário DEMO tem saguão envidraçado, bilheteria, bancos de espera e duas baias cobertas de serviço. A travessia de passageiros liga a rua ao saguão. A garagem tem entrada própria pelo lado sul.

## Ficha do ônibus

Clique no ônibus no mapa 3D, no diário ou na lista para abrir a ficha na coluna direita. O topo da ficha mostra um retrato renderizado do mesmo modelo 3D e da cor usada no mapa. Em LIVE e REPLAY, a imagem vem identificada como modelo ilustrativo. **Visão geral** mostra prefixo, linha, localização e minimapa. No DEMO, a linha do tempo da visão geral separa os registros da próxima saída prevista pelo cenário. **Trajeto** mostra origem e destino e, no DEMO, os caminhos de saída e retorno do cenário. **Histórico** mostra eventos simulados no DEMO, a última leitura no LIVE ou as leituras do arquivo assinado até o cursor do REPLAY. Em telas estreitas a ficha fica abaixo da cena.

Para observações do Olho Vivo, as coordenadas são as leituras recebidas e os letreiros só aparecem quando fornecidos. O minimapa usa o perímetro configurado. A fonte de posições não fornece o traçado das linhas.

## Fechamento de turno

Abra **Revisar turno** no painel lateral para experimentar a fila com dados sintéticos identificados. Selecione uma saída para consultar escala, portaria e posição disponível na cena. Registre uma conclusão e exporte a revisão. O CSV de exportação registra a leitura de portaria e a decisão humana em campos separados.

O conjunto de demonstração da revisão é um caso de conciliação próprio, separado do diário gerado pela simulação 3D.

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

## Modos de dados

| Modo | Origem | Estado desta entrega |
|---|---|---|
| DEMO | Cenário e frota sintéticos, identificados na tela | Disponível sem credenciais e sem rede externa |
| LIVE | SPTrans Olho Vivo, servidor FastAPI e recorte do perímetro fornecido | Adaptador e conexão de UI implementados. Autenticação e cobertura real pendentes |
| REPLAY | Captura histórica validada e assinada pelo operador | Leitura e busca temporal implementadas. Sem captura histórica fornecida |

Para LIVE, configure **somente no processo FastAPI** a credencial via `SPTRANS_TOKEN` ou `SPTRANS_TOKEN_FILE` e defina `PATIO_AREA_FILE`. A variável opcional `SPTRANS_COMPANY_ID` escolhe a consulta de garagem por empresa. A credencial é emitida no [DevPlace da SPTrans](https://www.sptrans.com.br/desenvolvedores/api-do-olho-vivo-guia-de-referencia/). O arquivo de área é JSON com `name`, `source`, `origin` e `ring`. Use pares `[longitude, latitude]` em WGS84 e feche o anel repetindo o primeiro ponto. Registre fonte e licença do perímetro. GPS e perímetro usam a mesma projeção UTM 23S, em metros.

Para REPLAY, configure `PATIO_REPLAY_FILE` e `PATIO_REPLAY_KEY` no servidor. O JSON contém `version: 1`, `source: "sptrans_olhovivo"`, `area` e `observations`, com os campos descritos em [contrato](packages/contracts/README.md). Um arquivo companheiro com sufixo `.json.sig` contém o HMAC-SHA256 hexadecimal dos bytes originais do JSON. Use uma chave privada de pelo menos 32 bytes e assine apenas dados com procedência já verificada. A timeline usa as leituras registradas e mantém seus horários originais.

Os modos de GPS mostram somente a área configurada e posições observadas. O pátio cenográfico é exclusivo do DEMO. O aplicativo não atribui a observações GPS uma baia, direção, telemetria de manutenção ou autorização de saída.

## Execução em contêiner local

Com Docker Compose, crie `runtime-data` na raiz e execute `docker compose up --build`. Abra `http://127.0.0.1:8080`. O Caddy publica a interface apenas no loopback, encaminha a API e faz a atualização WebSocket na mesma origem. Os processos usam UID 10001, sistema de arquivos de contêiner somente leitura e nenhuma capability adicional.

Para ativar LIVE nessa configuração, coloque o token e o perímetro em `runtime-data`, com permissões de leitura para o UID 10001. Copie `.env.example` para `.env` e defina `SPTRANS_TOKEN_FILE=/run/patio/sptrans-token.txt` e `PATIO_AREA_FILE=/run/patio/area.json`. O diretório é montado somente para leitura na API. A interface recebe apenas as observações normalizadas.

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

Permanecem pendentes para operação institucional a validação de um pátio real e da cobertura GPS, modelo georreferenciado, persistência PostgreSQL/PostGIS, retenção, autenticação da plataforma, observabilidade e testes em dispositivos de operadores. O blueprint original registra os marcos de implementação e as integrações restantes. Para a referência visual, use `references/00-APPROVED-visual-target.png` do handoff v3.
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
- **IA generativa.** Em **Revisar turno**, abra uma ocorrência e clique em **Explicar ocorrência** para consultar as fontes com a LLM local. O servidor recebe o tipo da ocorrência e sua origem. Os registros de CSV importados e as conclusões da equipe ficam no navegador. Consulte a [avaliação e a execução da LLM](gs/genai/README.md).
- **GPS real.** O servidor usa o Olho Vivo com a configuração da SPTrans. Para executar com o feed público do BRT do Rio, defina `PATIO_LIVE_PROVIDER=rio_brt` no servidor e escolha **LIVE** na interface. O recorte padrão fica no entorno do Terminal Alvorada e mostra posições observadas com horário de cada veículo. O recorte é geográfico e os dados têm atribuição à SMTR / MOBI-Rio sob CC BY 4.0. [Dados GTFS Realtime](https://dados.mobilidade.rio/gtfs/realtime) · [catálogo e licença](https://www.transit.land/data/feeds/f-75cj-mobi~rio~rt).
