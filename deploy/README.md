# Demonstração integrada

O Pátio Monitor abre direto na visão operacional. A tela reúne posições reais do BRT do Rio, o histórico por ônibus, a revisão de turno, a gravação processada e o assistente local.

## Teste do avaliador

Na página inicial, abra **Iniciar teste guiado**. O guia escurece o mapa e destaca, em sequência, a revisão de turno, os registros divergentes, a explicação com IA e a gravação com os cruzamentos detectados. Clique em **Explicar ocorrência** para consultar a API local e selecione um cruzamento para levar o vídeo ao instante da passagem. O mapa mantém o feed GPS público. Para abrir o guia diretamente em um link de avaliação, acrescente `?tour=1` ao endereço da plataforma.

## Executar localmente

Use Node 24, pnpm 11.25.0 e Python 3.12. Rode a partir da raiz do repositório. Na primeira execução, a internet é necessária para instalar as dependências e baixar o peso GGUF de aproximadamente 469 MiB, verificado por SHA-256.

```bash
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm build
python -m venv .venv
. .venv/bin/activate
python -m pip install -r services/api/requirements.txt
python -m pip install --only-binary=:all: --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu -r services/api/requirements-ai.txt
python gs/genai/download_model.py runtime-data/qwen.gguf
export PATIO_WEB_DIST="$PWD/apps/web/dist"
export PATIO_LLM_MODEL_PATH="$PWD/runtime-data/qwen.gguf"
export PATIO_LIVE_PROVIDER=rio_brt
export PATIO_ARCHIVE_FILE="$PWD/runtime-data/observations.sqlite3"
python -m uvicorn app.hosted:app --app-dir services/api --host 127.0.0.1 --port 8000 --ws-max-size 4096 --ws-max-queue 8
```

Abra [Pátio Monitor](http://127.0.0.1:8000/). O histórico começa com as coletas desta execução e permanece disponível após reiniciar o processo.

### PowerShell

```powershell
npm.cmd install -g pnpm@11.25.0
pnpm.cmd install --frozen-lockfile
pnpm.cmd build
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r services/api/requirements.txt
.\.venv\Scripts\python.exe -m pip install --only-binary=:all: --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu -r services/api/requirements-ai.txt
.\.venv\Scripts\python.exe gs/genai/download_model.py runtime-data/qwen.gguf
$env:PATIO_WEB_DIST = (Resolve-Path "apps/web/dist").Path
$env:PATIO_LLM_MODEL_PATH = (Resolve-Path "runtime-data/qwen.gguf").Path
$env:PATIO_LIVE_PROVIDER = "rio_brt"
$env:PATIO_ARCHIVE_FILE = Join-Path $PWD "runtime-data/observations.sqlite3"
.\.venv\Scripts\python.exe -m uvicorn app.hosted:app --app-dir services/api --host 127.0.0.1 --port 8000 --ws-max-size 4096 --ws-max-queue 8
```

Com o túnel ativo, defina `$env:PATIO_PUBLIC_ORIGIN = "https://HOST.trycloudflare.com"` com o endereço real emitido e execute novamente o comando do Uvicorn.

## Compartilhar uma demonstração

- **Máquina própria.** Use um [Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) apontando para `http://127.0.0.1:8000`. Com a URL emitida, defina `PATIO_PUBLIC_ORIGIN` com essa origem HTTPS e reinicie somente o servidor, mantendo o túnel ativo. A URL muda se o túnel for recriado e fica indisponível quando o túnel ou o servidor para. Confira a URL em janela anônima antes de compartilhar.
- **Codespaces.** Crie um Codespace na conta pessoal somente com cota incluída disponível e cobrança excedente bloqueada. Use os comandos acima e inicie o servidor com `--host 0.0.0.0`. Defina `PATIO_PUBLIC_ORIGIN="https://${CODESPACE_NAME}-8000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"` antes de iniciar. Na aba Ports, altere a visibilidade da porta 8000 para **Public** e copie a URL. O Codespace pode parar por inatividade. Use essa opção para uma demonstração agendada.

Para uma janela de correção de vários dias, mantenha a máquina e o túnel ativos e confira periodicamente a URL publicada. Use apenas os dados demonstrativos e o feed público nessa instância.

## Conferir a aplicação

1. Abra a página e confira o mapa 3D do Alvorada e o indicador de conexão GPS. Use **Entorno** para ampliar o campo de visão.
2. Selecione um ônibus e abra **Histórico**. As leituras armazenadas aparecem na ficha.
3. Abra **Câmera do portão**. A gravação pública de Praga inclui um cruzamento selecionável em 7,44 s.
4. Em **Revisar turno**, importe a escala e a portaria do mesmo turno e abra **Explicar ocorrência**. A orientação deve incluir a referência utilizada.
