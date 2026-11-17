import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronRight, MapPin } from "lucide-react";
import "./terminal-crossings.css";

type Crossing = {
  id: string;
  vehicleId: string;
  kind: "entry" | "exit";
  line: string | null;
  betweenFrom: string;
  betweenTo: string;
  confirmedAt: string;
};

type Result = {
  status: "loading" | "active" | "disabled" | "unavailable";
  events: Crossing[];
  summary?: {
    windowHours: number;
    entries: number;
    exits: number;
    paired: number;
    averageMinutes: number | null;
  };
};

const time = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
const date = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "short",
});
const timestamp = (value: string) => new Date(value);

function useCrossings(enabled: boolean): Result {
  const [result, setResult] = useState<Result>({ status: "loading", events: [] });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: number | undefined;
    async function refresh() {
      try {
        const response = await fetch("/api/vehicles/terminal-crossings", {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Cruzamentos GPS indisponíveis");
        const next = await response.json() as Result;
        if (!controller.signal.aborted) setResult(next);
      } catch {
        if (!controller.signal.aborted) setResult((prior) => ({ ...prior, status: "unavailable" }));
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(refresh, 15_000);
      }
    }
    void refresh();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return result;
}

function EventBody({ event }: { event: Crossing }) {
  const from = timestamp(event.betweenFrom);
  const to = timestamp(event.betweenTo);
  return (
    <>
      <span className="crossing-icon" aria-hidden="true">
        {event.kind === "entry" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
      </span>
      <span className="crossing-details">
        <strong>{event.kind === "entry" ? "Entrada" : "Saída"} <span aria-hidden="true">·</span> {event.vehicleId}</strong>
        <span>
          {date.format(from)} · {time.format(from)}–{date.format(from) !== date.format(to) ? date.format(to) + " " : ""}{time.format(to)}
        </span>
      </span>
    </>
  );
}

const emptyMessage: Record<Result["status"], string> = {
  loading: "Consultando os registros…",
  active: "Nenhum cruzamento confirmado no período disponível.",
  disabled: "A coleta de cruzamentos está desativada neste servidor.",
  unavailable: "A coleta está temporariamente indisponível.",
};

export function TerminalCrossings({ enabled, onSelect, activeVehicleIds }: {
  enabled: boolean;
  onSelect: (id: string) => void;
  activeVehicleIds?: ReadonlySet<string>;
}) {
  const { status, events, summary } = useCrossings(enabled);
  if (!enabled) return null;

  return (
    <section className="terminal-crossings" aria-labelledby="terminal-crossings-title">
      <h2 id="terminal-crossings-title"><MapPin size={17} /> Entradas e saídas</h2>
      <p>Cruzamentos inferidos de posições GPS, não passagens confirmadas pela portaria.</p>
      {summary && status === "active" && (
        <dl className="crossing-overview" aria-label="Resumo GPS das últimas 24 horas">
          <div><dt>Entradas</dt><dd>{summary.entries}</dd></div>
          <div><dt>Saídas</dt><dd>{summary.exits}</dd></div>
          <div><dt>Tempo entre registros</dt>
            <dd>{summary.averageMinutes == null ? "—" : summary.averageMinutes.toLocaleString("pt-BR") + " min"}</dd>
            <small>{summary.paired} pares GPS · 24h</small>
          </div>
        </dl>
      )}
      {!events.length && <p className="crossing-message" role="status">{emptyMessage[status]}</p>}
      {events.length > 0 && (
        <>
          {status === "unavailable" && <p className="crossing-message" role="status">Coleta indisponível. Últimos registros abaixo.</p>}
          <ul className="crossing-list" aria-label="Últimos cruzamentos">
            {events.map((event) => (
              <li className="crossing-item" key={event.id} data-kind={event.kind}>
                {activeVehicleIds?.has(event.vehicleId) ? (
                  <button type="button" onClick={() => onSelect(event.vehicleId)}
                    aria-label={`Abrir ficha do ônibus ${event.vehicleId}, ${event.kind === "entry" ? "entrada" : "saída"}`}>
                    <EventBody event={event} /><ChevronRight size={15} className="crossing-chevron" aria-hidden="true" />
                  </button>
                ) : <EventBody event={event} />}
              </li>
            ))}
          </ul>
        </>
      )}
      <details>
        <summary>Como o horário é estimado</summary>
        <p>O intervalo vai da última leitura de um lado do limite até a primeira do outro lado. O sistema exige duas leituras consecutivas para confirmar cada lado e ignora a faixa de 15 m junto ao limite. O registro de portaria é consultado na revisão do turno.</p>
        <a href="https://www.openstreetmap.org/relation/4571813" target="_blank" rel="noreferrer">Perímetro © OpenStreetMap</a>
      </details>
    </section>
  );
}
