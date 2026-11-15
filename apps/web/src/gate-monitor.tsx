import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, DoorClosed, DoorOpen, Fingerprint, ListChecks, RefreshCw, X } from "lucide-react";
import "./gate-monitor.css";

type GateEvent = {
  id: number;
  dispositivo: string;
  evento: string;
  distancia_cm: number;
  movimento: boolean;
  tipo_registro: string;
  data_hora: string;
};

type GateSnapshot = {
  status: "available" | "stale" | "disabled" | "unavailable";
  checked_at: string | null;
  total: number;
  eventos: GateEvent[];
};

const eventKinds = ["opened", "closed", "alert", "other"] as const;
type EventKind = (typeof eventKinds)[number];
const kindLabel: Record<EventKind, string> = {
  opened: "Aberturas", closed: "Fechamentos", alert: "Alertas", other: "Outros",
};
const timezone = "America/Sao_Paulo";
const clock = new Intl.DateTimeFormat("pt-BR", {
  timeZone: timezone, dateStyle: "short", timeStyle: "medium",
});
const dayKey = new Intl.DateTimeFormat("sv-SE", { timeZone: timezone, dateStyle: "short" });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("pt-BR");
const emptyHistory: GateSnapshot = { status: "unavailable", checked_at: null, total: 0, eventos: [] };
const pageSize = 8;

function eventKind(event: GateEvent): EventKind {
  if (event.evento === "CANCELA_ABERTA") return "opened";
  if (event.evento === "CANCELA_FECHADA") return "closed";
  if (event.evento === "POSSIVEL_OBSTRUCAO" || event.evento === "ANOMALIA"
      || /^ALERTA(?:_|$)/.test(event.evento) || /^ALERTA(?:_|$)/.test(event.tipo_registro)) return "alert";
  return "other";
}

function eventLabel(value: string) {
  if (value === "POSSIVEL_OBSTRUCAO") return "Possível obstrução";
  const words = value.replaceAll("_", " ").toLocaleLowerCase("pt-BR");
  return words.charAt(0).toLocaleUpperCase("pt-BR") + words.slice(1);
}

function useGateHistory() {
  const [history, setHistory] = useState<GateSnapshot>();
  const [loading, setLoading] = useState(true);
  const pending = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    setLoading(true);
    try {
      const response = await fetch("/api/rpa/gate-events", {
        signal: controller.signal, credentials: "same-origin", headers: { Accept: "application/json" },
      });
      if (!response.ok && response.status !== 503) throw new Error("Consulta indisponível");
      const next = await response.json() as GateSnapshot;
      if (!Array.isArray(next.eventos) || !["available", "stale", "disabled", "unavailable"].includes(next.status)) {
        throw new Error("Histórico inválido");
      }
      if (pending.current === controller) setHistory((previous) => next.status === "unavailable" && previous?.checked_at
        ? { ...previous, status: "stale" } : next);
    } catch {
      if (pending.current === controller) setHistory((previous) => previous?.checked_at
        ? { ...previous, status: "stale" } : emptyHistory);
    } finally {
      window.clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30_000);
    return () => {
      window.clearInterval(interval);
      const controller = pending.current;
      pending.current = null;
      controller?.abort();
    };
  }, [refresh]);

  return { history, loading, refresh };
}

function GateCharts({ events, totals }: {
  events: GateEvent[];
  totals: Record<EventKind, number>;
}) {
  const days = new Map<string, { opened: number; closed: number }>();
  for (const event of events) {
    const kind = eventKind(event);
    if (kind !== "opened" && kind !== "closed") continue;
    const date = dayKey.format(new Date(event.data_hora));
    const day = days.get(date) ?? { opened: 0, closed: 0 };
    day[kind] += 1;
    days.set(date, day);
  }
  const recent = [...days].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  const max = recent.reduce((highest, [, day]) => Math.max(highest, day.opened + day.closed), 1);

  return (
    <div className="gate-monitor-charts">
      <section className="gate-monitor-card" aria-labelledby="gate-days-title">
        <h3 id="gate-days-title">Aberturas e fechamentos por dia</h3>
        {recent.length > 0 ? (
          <>
            <p className="gate-monitor-note">Até 7 dias com registros · horário de Brasília</p>
            <div className="gate-monitor-legend">
              <span data-kind="opened">{kindLabel.opened}</span><span data-kind="closed">{kindLabel.closed}</span>
            </div>
            <ul className="gate-monitor-bars">
              {recent.map(([date, day]) => (
                <li key={date} aria-label={`${date}, ${day.opened} aberturas e ${day.closed} fechamentos`}>
                  <time dateTime={date}>{date.slice(8)}/{date.slice(5, 7)}</time>
                  <span className="gate-monitor-bar" aria-hidden="true">
                    <i data-kind="opened" style={{ width: `${day.opened / max * 100}%` }} />
                    <i data-kind="closed" style={{ width: `${day.closed / max * 100}%` }} />
                  </span>
                  <strong aria-hidden="true">{integer.format(day.opened + day.closed)}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : <p className="gate-monitor-note">Nenhuma abertura ou fechamento no histórico.</p>}
      </section>
      <section className="gate-monitor-card" aria-labelledby="gate-distribution-title">
        <h3 id="gate-distribution-title">Distribuição dos eventos</h3>
        <ul className="gate-monitor-distribution">
          {eventKinds.map((kind) => (
            <li key={kind}>
              <span data-kind={kind}>{kindLabel[kind]}</span>
              <span className="gate-monitor-bar" aria-hidden="true">
                <i data-kind={kind} style={{ width: `${totals[kind] / events.length * 100}%` }} />
              </span>
              <strong>{integer.format(totals[kind])}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function GateMonitor({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { history, loading, refresh } = useGateHistory();
  const [kind, setKind] = useState("");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(0);
  const events = history?.eventos ?? emptyHistory.eventos;
  const kinds = useMemo(() => [...new Set(events.map(({ evento }) => evento))]
    .sort((a, b) => eventLabel(a).localeCompare(eventLabel(b), "pt-BR")), [events]);
  const totals = useMemo(() => {
    const counts = { opened: 0, closed: 0, alert: 0, other: 0 };
    for (const event of events) counts[eventKind(event)] += 1;
    return counts;
  }, [events]);
  const latestState = events.find(({ evento }) => evento === "CANCELA_ABERTA" || evento === "CANCELA_FECHADA");
  const filtered = useMemo(() => events.filter((event) =>
    (!kind || event.evento === kind) && (!date || dayKey.format(new Date(event.data_hora)) === date)), [events, kind, date]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePage = Math.min(page, pages - 1);
  const stateText = latestState ? latestState.evento === "CANCELA_ABERTA" ? "Aberta" : "Fechada" : "Estado indisponível";
  const StateIcon = latestState?.evento === "CANCELA_ABERTA" ? DoorOpen : DoorClosed;
  const statusText = history?.status === "disabled"
    ? "A integração com o n8n ainda não foi configurada neste servidor."
    : history?.status === "stale"
      ? "Não foi possível atualizar. O painel mantém os dados da última consulta bem-sucedida."
      : "Não foi possível consultar o histórico da cancela. Tente atualizar novamente.";

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
    <dialog className="gs-camera gate-monitor" ref={dialog} aria-labelledby="gate-monitor-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="gs-camera-header gate-monitor-header">
        <div className="gs-camera-brand"><Fingerprint size={21} aria-hidden="true" /></div>
        <div>
          <p>SMART BUS GATE · N8N</p>
          <h2 id="gate-monitor-title">Monitoramento da Cancela</h2>
        </div>
        <button type="button" className="icon" onClick={onClose} aria-label="Fechar monitoramento da cancela"><X size={21} /></button>
      </header>
      <div className="gate-monitor-body">
        <div className="gate-monitor-toolbar">
          <div>
            <strong>Histórico do protótipo</strong>
            <p>{history?.checked_at ? <>Última atualização <time dateTime={history.checked_at}>{clock.format(new Date(history.checked_at))}</time> · Brasília</> : "Eventos de auditoria registrados pelo n8n"}</p>
          </div>
          <button type="button" className="operation-secondary" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> {loading ? "Atualizando…" : "Atualizar dados"}
          </button>
        </div>

        {!history && <p className="gate-monitor-message" role="status">Consultando o histórico da cancela…</p>}
        {history && history.status !== "available" && <p className="gate-monitor-message" role="status">{statusText}</p>}
        {history?.checked_at && (
          <>
            <dl className="gate-monitor-metrics">
              <div><dt><ListChecks size={16} aria-hidden="true" /> Total de eventos</dt><dd>{integer.format(history.total)}</dd></div>
              <div data-kind="opened"><dt><DoorOpen size={16} aria-hidden="true" /> Aberturas</dt><dd>{integer.format(totals.opened)}</dd></div>
              <div data-kind="closed"><dt><DoorClosed size={16} aria-hidden="true" /> Fechamentos</dt><dd>{integer.format(totals.closed)}</dd></div>
              <div data-kind="alert"><dt><AlertTriangle size={16} aria-hidden="true" /> Alertas no histórico</dt><dd>{integer.format(totals.alert)}</dd></div>
            </dl>

            <section className="gate-monitor-state" aria-labelledby="gate-state-title" data-kind={latestState && eventKind(latestState)}>
              <span className="gate-monitor-state-icon"><StateIcon size={22} aria-hidden="true" /></span>
              <div>
                <h3 id="gate-state-title">Status da cancela</h3>
                <strong>{latestState ? `Último estado registrado: ${stateText.toLocaleLowerCase("pt-BR")}` : stateText}</strong>
                {latestState && <p>{latestState.dispositivo} · <time dateTime={latestState.data_hora}>{clock.format(new Date(latestState.data_hora))}</time></p>}
              </div>
              <span>Histórico do protótipo</span>
            </section>

            {events.length > 0 && <GateCharts events={events} totals={totals} />}

            <section className="gate-monitor-card gate-monitor-history" aria-labelledby="gate-history-title">
              <div className="gate-monitor-history-header">
                <div><h3 id="gate-history-title">Histórico de eventos</h3><p className="gate-monitor-note" role="status">{integer.format(filtered.length)} de {integer.format(events.length)} registros · horário de Brasília</p></div>
                {events.length > 0 && <div className="gate-monitor-filters">
                  <div>
                    <label htmlFor="gate-event-type">Evento</label>
                    <select id="gate-event-type" value={kind} onChange={(event) => { setKind(event.target.value); setPage(0); }}>
                      <option value="">Todos os tipos</option>
                      {kind && !kinds.includes(kind) && <option value={kind}>{eventLabel(kind)}</option>}
                      {kinds.map((value) => <option value={value} key={value}>{eventLabel(value)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="gate-event-date">Data</label>
                    <input id="gate-event-date" type="date" lang="pt-BR" value={date} onChange={(event) => { setDate(event.target.value); setPage(0); }} />
                  </div>
                  {(kind || date) && <button type="button" className="operation-secondary" onClick={() => { setKind(""); setDate(""); setPage(0); }}>Limpar</button>}
                </div>}
              </div>
              {filtered.length > 0 ? (
                <>
                  <div className="gate-monitor-table-wrap" tabIndex={0} role="region" aria-label="Tabela de registros da cancela">
                    <table>
                      <thead><tr><th scope="col">Data e hora</th><th scope="col">Dispositivo</th><th scope="col">Evento</th><th scope="col">Distância</th><th scope="col">Movimento</th></tr></thead>
                      <tbody>
                        {filtered.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize).map((event) => (
                          <tr key={event.id}>
                            <td><time dateTime={event.data_hora}>{clock.format(new Date(event.data_hora))}</time>
                              <small className="gate-monitor-event-id">#{event.id}</small></td>
                            <td><span className="gate-monitor-device">{event.dispositivo}</span></td>
                            <td><span className="gate-monitor-badge" data-kind={eventKind(event)}>{eventLabel(event.evento)}</span></td>
                            <td>{decimal.format(event.distancia_cm)} cm</td><td>{event.movimento ? "Sim" : "Não"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {pages > 1 && <nav className="gate-monitor-pages" aria-label="Páginas do histórico da cancela">
                    <button type="button" className="icon" aria-label="Página anterior" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}><ChevronLeft size={17} /></button>
                    <span>Página {visiblePage + 1} de {pages}</span>
                    <button type="button" className="icon" aria-label="Próxima página" disabled={visiblePage + 1 === pages} onClick={() => setPage(visiblePage + 1)}><ChevronRight size={17} /></button>
                  </nav>}
                </>
              ) : <p className="gate-monitor-message" role="status">{events.length ? "Nenhum evento corresponde aos filtros." : "A consulta ainda não retornou eventos."}</p>}
            </section>
          </>
        )}
      </div>
    </dialog>
  );
}
