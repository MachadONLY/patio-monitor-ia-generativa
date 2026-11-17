import { ArrowDownLeft, ArrowUpRight, Camera, ExternalLink, FileSearch, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ShiftCase } from "./shift-engine";
import "./gs-evidence.css";

type Crossing = {
  id: string;
  timestamp_seconds: number;
  direction: "LEFT_TO_RIGHT" | "RIGHT_TO_LEFT";
  confidence: number;
  evidence_url?: string;
};

type VisionReport = {
  schema_version: 1;
  data_origin: "PUBLIC_VIDEO" | "OPERATOR_VIDEO" | "DEMO";
  source: { title: string; author: string; license: string; license_url?: string; source_url?: string };
  model: { family: string };
  video: { url: string; duration_seconds: number };
  events: Crossing[];
};

type Explanation = {
  answer: string;
  refused: boolean;
  citations: { id: string; title: string; url?: string }[];
  actions: string[];
  model: string;
};

const VISION_ROUTE = "/api/gs/vision";

function isText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function safeSource(value?: string) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.href;
  } catch {
    return;
  }
}

function mediaUrl(value?: string) {
  if (!value?.startsWith(VISION_ROUTE + "/media/")) return;
  const url = new URL(value, window.location.origin);
  if (url.origin === window.location.origin && url.pathname.startsWith(VISION_ROUTE + "/media/")) {
    return url.href;
  }
}

function clock(seconds: number, digits = 0) {
  const scale = 10 ** digits;
  const ticks = Math.round(seconds * scale);
  const minutes = String(Math.floor(ticks / (60 * scale))).padStart(2, "0");
  const remainder = ((ticks % (60 * scale)) / scale).toFixed(digits).padStart(digits ? 3 + digits : 2, "0");
  return minutes + ":" + remainder.replace(".", ",");
}

const confidence = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

function validateReport(result: VisionReport) {
  return result?.schema_version === 1
    && (["PUBLIC_VIDEO", "OPERATOR_VIDEO", "DEMO"].includes(result.data_origin))
    && isText(result.source?.title)
    && isText(result.source?.author)
    && isText(result.source?.license)
    && isText(result.model?.family)
    && mediaUrl(result.video?.url)
    && Number.isFinite(result.video?.duration_seconds)
    && result.video.duration_seconds > 0
    && Array.isArray(result.events)
    && result.events.every((event) =>
      isText(event?.id)
      && Number.isFinite(event.timestamp_seconds)
      && event.timestamp_seconds >= 0
      && event.timestamp_seconds <= result.video.duration_seconds
      && (event.direction === "LEFT_TO_RIGHT" || event.direction === "RIGHT_TO_LEFT")
      && Number.isFinite(event.confidence) && event.confidence >= 0 && event.confidence <= 1);
}

export function GateEvidence() {
  const player = useRef<HTMLVideoElement>(null);
  const [reload, setReload] = useState(0);
  const [report, setReport] = useState<VisionReport>();
  const [unavailable, setUnavailable] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(VISION_ROUTE, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error();
        const data: VisionReport = await response.json();
        if (!validateReport(data)) throw new Error();
        if (!controller.signal.aborted) setReport(data);
      } catch {
        if (!controller.signal.aborted) setUnavailable(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  function seek(event: Crossing) {
    const video = player.current;
    if (!video || video.readyState === 0 || videoFailed) return;
    video.currentTime = event.timestamp_seconds;
    setSelected(event.id);
  }

  return (
    <>
      {!report ? (
        <div className="gs-camera-state">
          {unavailable ? (
            <>
              <p role="status">O vídeo e os cruzamentos estão indisponíveis.</p>
              <button type="button" className="shift-button shift-secondary" onClick={() => {
                setUnavailable(false);
                setReload((count) => count + 1);
              }}>Tentar novamente</button>
            </>
          ) : <p role="status">Carregando evidência visual…</p>}
        </div>
      ) : (
        <>
          <div className="gs-camera-content">
            <section className="gs-camera-media" aria-label="Gravação anotada">
              <span className="gs-source">{report.data_origin === "PUBLIC_VIDEO" ? "VÍDEO PÚBLICO • GRAVAÇÃO" : report.data_origin === "OPERATOR_VIDEO" ? "VÍDEO DO OPERADOR • GRAVAÇÃO" : "DEMO • GRAVAÇÃO SINTÉTICA"}</span>
              <video ref={player} src={mediaUrl(report.video.url)} controls playsInline preload="metadata" aria-label="Vídeo com as detecções na área do portão" onLoadedMetadata={() => setVideoReady(true)} onError={() => setVideoFailed(true)} />
              {videoFailed && <p className="gs-video-error" role="status">O navegador não conseguiu reproduzir esta gravação.</p>}
              <div className="gs-camera-caption">
                <strong>{report.source.title}</strong>
                <span>{report.source.author} · {report.model.family}</span>
              </div>
            </section>
            <section className="gs-crossings" aria-label="Cruzamentos no vídeo">
              <header>
                <h3>Cruzamentos detectados</h3>
                <span>{report.events.length} {report.events.length === 1 ? "registro" : "registros"}</span>
              </header>
              <p>Os horários são relativos ao início do vídeo. A direção usa o enquadramento da câmera.</p>
              {report.events.length ? (
                <ol>
                  {[...report.events].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds).map((event) => (
                    <li key={event.id}>
                      <button type="button" aria-pressed={event.id === selected} disabled={videoFailed || !videoReady} onClick={() => seek(event)}>
                        <span className="gs-direction" aria-hidden="true">
                          {event.direction === "LEFT_TO_RIGHT" ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                        </span>
                        <span>
                          <strong>{event.direction === "LEFT_TO_RIGHT" ? "Esquerda → direita" : "Direita → esquerda"}</strong>
                          <small>{confidence.format(event.confidence)} de confiança do modelo</small>
                        </span>
                        <span className="gs-clock">{clock(event.timestamp_seconds, 1)}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : <p>Nenhum cruzamento detectado nesta gravação.</p>}
            </section>
          </div>
          <footer className="gs-camera-footer">
            <p>{report.data_origin === "PUBLIC_VIDEO" ? "Gravação de referência externa. " : ""}O cruzamento é uma observação visual. Para confirmar o veículo e a saída, compare com o registro de portaria.</p>
            {safeSource(report.source.source_url) && (
              <a href={safeSource(report.source.source_url)} target="_blank" rel="noreferrer">Gravação original <ExternalLink size={13} /></a>
            )}
            {safeSource(report.source.license_url)
              ? <a href={safeSource(report.source.license_url)} target="_blank" rel="noreferrer">{report.source.license} <ExternalLink size={13} /></a>
              : <span>{report.source.license}</span>}
          </footer>
        </>
      )}
    </>
  );
}

export function GateCamera({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const trigger = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} className="gs-camera" aria-labelledby="gs-camera-title" onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <header className="gs-camera-header">
        <div className="gs-camera-brand"><Camera size={21} aria-hidden="true" /></div>
        <div>
          <p>EVIDÊNCIA VISUAL</p>
          <h2 id="gs-camera-title">Câmera do portão</h2>
        </div>
        <button type="button" className="icon" aria-label="Fechar câmera do portão" onClick={onClose}><X size={21} /></button>
      </header>
      <GateEvidence />
    </dialog>
  );
}

function isExplanation(result: Explanation) {
  return isText(result?.answer)
    && typeof result.refused === "boolean"
    && isText(result.model)
    && Array.isArray(result.citations)
    && result.citations.every((citation) => isText(citation?.id) && isText(citation.title))
    && Array.isArray(result.actions)
    && result.actions.every(isText);
}

const localTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
});

function operationalDiagnosis(item: ShiftCase) {
  const trip = item.trip;
  const gate = item.gate;
  const planned = "Saída " + trip.tripId + ": escala do veículo " + trip.vehicleId
    + " às " + localTime.format(new Date(trip.plannedAt)) + ".";
  const observed = gate
    ? " Portaria: veículo " + gate.vehicleId + " às "
      + localTime.format(new Date(gate.observedAt)) + " (" + gate.eventId + ")."
    : " Não há registro OUT vinculado de forma inequívoca na portaria.";

  switch (item.reason) {
    case "vehicle_swap":
      return {
        finding: "Divergência de identificação comprovada nos registros. " + planned + observed,
        action: "Conferir com o controle do terminal se ocorreu substituição de " + trip.vehicleId
          + " por " + gate?.vehicleId
          + ". Se houve, atualizar a escala; se o registro estiver incorreto, corrigir a portaria."
          + " Registrar a evidência e a decisão antes de encerrar a ocorrência.",
      };
    case "missing_gate":
      return {
        finding: "Saída sem confirmação de portaria. " + planned + observed,
        action: "Localizar o registro OUT original da saída. Se ele não existir, manter a ocorrência"
          + " sem confirmação e registrar a pendência; GPS sozinho não comprova a passagem.",
      };
    case "ambiguous":
      return {
        finding: "Há " + item.candidates.length + " registros candidatos, sem associação única. " + planned,
        action: "Conferir os IDs, prefixos e horários das passagens candidatas. Não associar um"
          + " registro arbitrariamente; manter a pendência até localizar a evidência correta.",
      };
    case "early_gate":
      return {
        finding: "Passagem registrada antes da tolerância de antecedência. " + planned + observed,
        action: "Conferir os relógios e a escala da saída. Registrar se foi antecipação autorizada"
          + " ou erro de registro antes de concluir.",
      };
    case "outside_window":
      return {
        finding: "A passagem vinculada ocorreu fora da janela aceita. " + planned + observed,
        action: "Verificar o ID da saída e o horário da portaria, confrontar os documentos"
          + " originais e manter a divergência até haver confirmação.",
      };
    case "confirmed":
      return {
        finding: item.status === "late"
          ? "Saída vinculada com atraso acima de cinco minutos. " + planned + observed
          : "Saída vinculada dentro da tolerância. " + planned + observed,
        action: item.status === "late"
          ? "Conferir a justificativa do atraso e registrar a ação tomada com o controle operacional."
          : "Nenhuma ação corretiva exigida pelo horário; conservar a evidência registrada.",
      };
  }
}

const ruleSummaries: Record<string, string> = {
  p01: "Sem passagem OUT vinculada, a saída permanece sem confirmação. Posição GPS não comprova a travessia física.",
  p02: "Mesmo ID de saída com prefixos diferentes na escala e na portaria indica uma divergência documental. A substituição física precisa ser conferida.",
  p03: "Sem ID de saída, a associação exige veículo correspondente, horário na janela e um candidato único.",
  p04: "Atraso acima de cinco minutos é sinalizado. Antecedência excessiva ou registro fora da janela exigem revisão.",
  p05: "Dados DEMO, GPS observado e arquivos locais são fontes distintas e não podem ser confundidas.",
  p06: "Os CSVs de escala e portaria devem conter identificadores e horários com fuso explícito.",
  p07: "A decisão humana e a evidência permanecem separadas; a plataforma não autoriza a saída de veículos.",
  p08: "GPS desatualizado não comprova a posição atual do ônibus.",
  s01: "A API de GPS informa observações de veículos, não confirma passagem em portões.",
  s02: "A chave de acesso ao Olho Vivo deve permanecer no servidor.",
};

export function ExplainOccurrence({ item, demo, scrollIntoView = false }: { item: ShiftCase; demo: boolean; scrollIntoView?: boolean }) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string>();
  const [result, setResult] = useState<Explanation>();
  const active = useRef<AbortController | null>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const diagnosis = operationalDiagnosis(item);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (scrollIntoView && (result || failure)) feedback.current?.scrollIntoView({ block: "nearest" });
  }, [failure, result, scrollIntoView]);

  async function explain() {
    if (active.current) return;
    setFailure(undefined);
    setResult(undefined);
    setPending(true);
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await fetch("/api/gs/explain", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          question: "Que evidências devo verificar e qual é o próximo passo para revisar esta ocorrência?",
          context: {
            tripId: demo ? item.trip.tripId : "ocorrencia-local",
            status: item.status,
            reason: item.reason,
            evidenceMode: demo ? "DEMO" : "CSV_LOCAL",
          },
        }),
      });
      if (response.status === 429) {
        if (!controller.signal.aborted) setFailure("O assistente está processando outra solicitação. Tente novamente em instantes.");
        return;
      }
      if (!response.ok) throw new Error();
      const responseData: Explanation = await response.json();
      if (!isExplanation(responseData)) throw new Error();
      if (!controller.signal.aborted) setResult(responseData);
    } catch {
      if (!controller.signal.aborted) setFailure("O assistente está indisponível. As evidências da saída continuam acessíveis.");
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <div className="gs-explain">
      <section className="gs-operational-diagnosis" aria-label="Diagnóstico operacional">
        <div className="gs-operational-head">
          <strong>Problema identificado</strong>
          <small>{demo ? "Cenário de teste · dados fictícios" : "Conferência dos CSVs importados"}</small>
        </div>
        <p>{diagnosis.finding}</p>
        <strong>Próxima ação</strong>
        <p>{diagnosis.action}</p>
        <small>O diagnóstico resulta da comparação de escala e portaria; não confirma, sozinho, um acontecimento físico.</small>
      </section>
      <button type="button" className="shift-button shift-secondary" onClick={() => void explain()} disabled={pending}>
        <FileSearch size={15} /> {pending ? "Consultando fontes…" : result ? "Consultar novamente" : "Explicar ocorrência"}
      </button>
      {!demo && !result && <small>Envia ao assistente apenas a classificação da ocorrência.</small>}
      {failure && <div ref={feedback} className="gs-explain-failure" role="status">{failure}</div>}
      {result && (
        <div ref={feedback} className="gs-explain-result" aria-live="polite">
          <strong>{result.refused ? "Explicação sem suporte nas fontes" : "Orientação gerada pelo assistente"}</strong>
          <small>{demo ? "Caso de exemplo" : "Classificação de arquivos locais"} · {result.model}</small>
          <p>{result.answer}</p>
          <small>A IA fornece orientação sobre a regra; o diagnóstico acima foi calculado dos registros.</small>
          {result.citations.length ? (
            <>
              <strong>Fontes consultadas</strong>
              <ul>{result.citations.map((source) => (
                <li key={source.id}>
                  {ruleSummaries[source.id] && <p className="gs-rule-summary">{ruleSummaries[source.id]}</p>}
                  {safeSource(source.url)
                    ? <a href={safeSource(source.url)} target="_blank" rel="noreferrer">{source.title} <ExternalLink size={12} /></a>
                    : source.title}
                </li>
              ))}</ul>
              <small>Os links são referências técnicas para auditoria. A regra principal está resumida acima.</small>
            </>
          ) : <small>Nenhuma fonte citada.</small>}
        </div>
      )}
    </div>
  );
}
