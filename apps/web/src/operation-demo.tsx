import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BusFront } from "lucide-react";
import { fleet } from "./fleet";
import { DEMO_WARMUP_SECONDS, sampleSimulation, simulationMovementsAt } from "./simulation";
import "./operation-demo.css";

export const simulationPhaseLabel = {
  parked: "Na baia",
  departing: "Em saída",
  away: "Em rota",
  arriving: "Em chegada",
} as const;

export function clockLabel(seconds: number) {
  const daySecond = Math.floor(6 * 3600 + seconds) % 86400;
  return [Math.floor(daySecond / 3600), Math.floor(daySecond / 60) % 60, daySecond % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
}

export function useDemoOperation(enabled: boolean) {
  const origin = useRef(performance.now());
  const readTime = useCallback(
    () => DEMO_WARMUP_SECONDS + Math.max(0, performance.now() - origin.current) / 1000,
    [],
  );
  const clock = useRef(DEMO_WARMUP_SECONDS);
  const [elapsed, setElapsed] = useState(DEMO_WARMUP_SECONDS);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sync = () => setElapsed(readTime());
    sync();
    const timer = window.setInterval(sync, 1000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [enabled, readTime]);

  const scene = useMemo(
    () => ({ animate: !reducedMotion, readTime, elapsed: clock }),
    [readTime, reducedMotion],
  );
  return { elapsed, scene };
}

export function OperationFeed({
  elapsed,
  onFollow,
}: {
  elapsed: number;
  onFollow?: (vehicleId: string) => void;
}) {
  const phases = fleet.map((vehicle) => sampleSimulation(vehicle, elapsed).phase);
  const parked = phases.filter((phase) => phase === "parked").length;
  const away = phases.filter((phase) => phase === "away").length;
  const { arrivals, departures, events } = simulationMovementsAt(elapsed);

  return (
    <section className="operation-feed" aria-label="Movimentos do pátio">
      <header>
        <span className="eyebrow">OPERAÇÃO CONTÍNUA</span>
        <span className="operation-source">DEMO</span>
      </header>
      <h2>Movimentos do pátio</h2>
      <dl className="operation-counts">
        <div><dt>Em baia</dt><dd>{parked}</dd></div>
        <div><dt>Em trânsito</dt><dd>{fleet.length - parked - away}</dd></div>
        <div><dt>Fora</dt><dd>{away}</dd></div>
      </dl>
      <p className="operation-totals">
        <span><ArrowDownLeft size={12} /> Entradas <strong>{arrivals}</strong></span>
        <span><ArrowUpRight size={12} /> Saídas <strong>{departures}</strong></span>
      </p>
      {events.length ? <ol className="operation-events">
        {events.map((event) => (
          <li key={event.id}>
            <span className="operation-event-icon" data-kind={event.kind}>
              {event.kind === "arrival" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </span>
            <div>
              <strong>{event.kind === "arrival" ? "Entrada na portaria" : "Saída pela portaria"}</strong>
              {onFollow ? (
                <button
                  aria-label={`Acompanhar ônibus ${event.vehicleId}`}
                  onClick={() => onFollow(event.vehicleId)}
                >
                  Ônibus {event.vehicleId}
                </button>
              ) : <small>Ônibus {event.vehicleId}</small>}
            </div>
            <time title="Horário do cenário">{clockLabel(event.at)}</time>
          </li>
        ))}
      </ol> : <p className="operation-empty"><BusFront size={15} /> Aguardando a primeira passagem simulada.</p>}
    </section>
  );
}
