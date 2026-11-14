# Demonstração integrada

É possível executar o Pátio Monitor sem chave de API ou infraestrutura paga. A demonstração inclui o cenário 3D, a revisão de turno, o vídeo anotado, o Qwen em CPU e o GPS do feed público do BRT do Rio. O modo REPLAY exige uma captura assinada. A fonte SPTrans exige sua própria credencial e área.

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
python -m uvicorn app.hosted:app --app-dir services/api --host 127.0.0.1 --port 8000 --ws-max-size 4096 --ws-max-queue 8
```

Abra http://127.0.0.1:8000. Para uma instalação em Windows, use os mesmos scripts e [o roteiro de ambiente Python em PowerShell](../gs/genai/README.md#reproduzir-no-terminal), ou use o Codespaces.

## Compartilhar uma demonstração

- **Máquina própria.** Use um [Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) apontando para `http://127.0.0.1:8000`. Com a URL emitida, defina `PATIO_PUBLIC_ORIGIN` com essa origem HTTPS e reinicie somente o servidor, mantendo o túnel ativo. A URL muda se o túnel for recriado e fica indisponível quando o túnel ou o servidor para. Confira a URL em janela anônima antes de compartilhar.
- **Codespaces.** Crie um Codespace na conta pessoal somente com cota incluída disponível e cobrança excedente bloqueada. Use os comandos acima e inicie o servidor com `--host 0.0.0.0`. Defina `PATIO_PUBLIC_ORIGIN="https://${CODESPACE_NAME}-8000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"` antes de iniciar. Na aba Ports, altere a visibilidade da porta 8000 para **Public** e copie a URL. O Codespace pode parar por inatividade. Use essa opção para uma demonstração agendada.

Para uma janela de correção de vários dias, mantenha a máquina e o túnel ativos e confira periodicamente a URL publicada. Use apenas os dados demonstrativos e o feed público nessa instância.

## Conferir a demonstração

1. Em **DEMO**, selecione um ônibus e abra **Câmera do portão**. O cruzamento direciona o vídeo para 7,44 s.
2. Em **Fechamento de turno**, abra uma ocorrência de troca e clique em **Explicar ocorrência**. Confira a resposta e a fonte.
3. Em **LIVE**, confira a atribuição ao BRT do Rio e a idade de uma posição. As posições dependem da disponibilidade do provedor.
