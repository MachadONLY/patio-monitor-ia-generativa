import { useId, useState, type KeyboardEvent } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Check, ChevronRight, Clock3, Crosshair,
  History, MapPin, Navigation, Route, X,
} from "lucide-react";
import type { Vehicle } from "./fleet";
import { localPoint, useRecordedVehicleHistory, type Area, type Mode } from "./observations";
import { clockLabel, simulationPhaseLabel } from "./operation-demo";
import { simulationVehicleDetails, type SimulationPose } from "./simulation";
import { APPROACH, APRON, TERMINAL_BOUNDS, TERMINAL_GATE, TERMINAL_HALL, WEST_STREET_X, terminalBays } from "./terminal-layout";
import "./vehicle-inspector.css";

export const readingTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium",
});

type DemoDetails = NonNullable<ReturnType<typeof simulationVehicleDetails>>;
const tabs = [
  { id: "summary", label: "Visão geral" },
  { id: "route", label: "Trajeto" },
  { id: "history", label: "Histórico" },
] as const;

export function SiteMap({ pose, details }: { pose?: SimulationPose; details?: DemoDetails }) {
  const { west, east, north, south } = TERMINAL_BOUNDS;
  return (
    <svg viewBox="-72 -88 170 138" aria-label="Planta esquemática do terminal" className="terminal-map" role="img">
      <rect x="-72" y="-88" width="170" height="138" fill="#e3e8df" />
      <path d={`M-72 -45H98 M-72 45H98 M${WEST_STREET_X} -45V45 M64 -45V50 M17 -76H94 M50 -76V-37`} fill="none" stroke="#fafbf6" strokeWidth="7" />
      <rect x={west} y={north} width={east - west} height={south - north} rx="2" fill="#c6dbcf" stroke="#80a58f" />
      <path
        d={`M${APPROACH.inboundX} -59V${APRON.north}H-37 M-37 ${APRON.south}H${APPROACH.outboundX}V-59`}
        fill="none" stroke="#91aaa0" strokeWidth="2.8" strokeLinejoin="round"
      />
      <rect x={TERMINAL_HALL.west} y={TERMINAL_HALL.north}
        width={TERMINAL_HALL.east - TERMINAL_HALL.west}
        height={TERMINAL_HALL.south - TERMINAL_HALL.north} rx="1" fill="#5c8171" />
      {terminalBays.map(({ x, id }) => <rect key={id} x={x - 1.5} y="-7.5" width="3" height="15" rx="0.6" fill="#f6f6ec" />)}
      {[-27, -13, 1, 15].map((x) => <rect key={x} x={x - 1.55} y="-11" width="3.1" height="22" rx="0.6" fill="#648e7a" />)}
      <circle cx={TERMINAL_GATE.x} cy={north} r="2.1" fill="#537464" />
      {details && [
        { key: "arrival", points: details.arrival, color: "#367b9b" },
        { key: "departure", points: details.departure, color: "#13654a" },
      ].map(({ key, points, color }) => (
        <polyline key={key} points={points.map(({ x, z }) => `${x},${z}`).join(" ")}
          fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {pose?.visible && (
        <g>
          <circle cx={pose.x} cy={pose.z} r="6.2" fill="#19684e" opacity=".18" />
          <circle cx={pose.x} cy={pose.z} r="3.9" fill="#12694b" stroke="#fff" strokeWidth="1.5" />
        </g>
      )}
    </svg>
  );
}

function GpsMap({ area, vehicle }: { area: Area; vehicle: Vehicle }) {
  const points = area.ring.map((point) => localPoint(area.origin, point));
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const minX = Math.min(...xs, vehicle.x);
  const minZ = Math.min(...zs, vehicle.z);
  const width = Math.max(...xs, vehicle.x) - minX;
  const height = Math.max(...zs, vehicle.z) - minZ;
  const pad = Math.max(width, height, 1) * 0.11;
  return (
    <svg viewBox={`${minX - pad} ${minZ - pad} ${width + pad * 2} ${height + pad * 2}`}
      aria-label="Posição registrada no perímetro operacional" role="img">
      <polygon points={points.map(([x, z]) => `${x},${z}`).join(" ")} fill="#c6dbcf" stroke="#80a58f" vectorEffect="non-scaling-stroke" />
      <circle cx={vehicle.x} cy={vehicle.z} r={pad * 0.23} fill="#12694b" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${Math.floor(seconds % 60)} s` : `${Math.floor(seconds)} s`;
}

type Props = {
  vehicle: Vehicle;
  mode: Mode;
  site: string;
  area?: Area;
  replayAt?: string;
  elapsed: number;
  stale: boolean;
  following: boolean;
  cameraDisabled: boolean;
  onClose: () => void;
  onCamera: (action: "focus" | "follow" | "profile" | "top") => void;
};

export function VehicleInspector({
  vehicle, mode, site, area, replayAt, elapsed, stale, following,
  cameraDisabled, onClose, onCamera,
}: Props) {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("summary");
  const id = useId();
  const demo = mode === "DEMO" ? simulationVehicleDetails(vehicle, elapsed) : undefined;
  const obs = vehicle.observation;
  const recorded = useRecordedVehicleHistory(
    mode === "REPLAY" && tab === "history" ? vehicle.id : undefined, replayAt,
  );
  const samples = recorded?.length ? recorded : obs ? [obs] : [];
  const returning = demo?.pose.phase === "arriving";
  const origin = demo ? (returning ? vehicle.demoDestination : site) : obs?.lineOrigin;
  const destination = demo ? (returning ? site : vehicle.demoDestination) : obs?.lineDestination;
  const status = demo ? simulationPhaseLabel[demo.pose.phase] : stale ? "Leitura desatualizada" : "Posição registrada";
  const upcomingDeparture = demo && demo.nextDeparture > elapsed ? demo.nextDeparture : undefined;
  const nextDeparture = upcomingDeparture === undefined ? "—" : clockLabel(upcomingDeparture);
  const recentMovements = demo?.history.slice(0, upcomingDeparture === undefined ? 3 : 2).reverse() ?? [];

  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const offset = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const next = tabs[(index + offset + tabs.length) % tabs.length].id;
    setTab(next);
    document.getElementById(`${id}-${next}`)?.focus();
  }

  return (
    <section className="vehicle-inspector" aria-label={`Detalhes do ônibus ${vehicle.id}`}>
      <header className="inspector-hero">
        <div className="inspector-kicker">
          <span>FICHA DO VEÍCULO</span>
          <button className="icon" aria-label="Limpar seleção" onClick={onClose}><X size={17} /></button>
        </div>
        <div className="inspector-identity">
          <div><span className="eyebrow">PREFIXO</span><h2 className="vehicle-id">{vehicle.id}</h2></div>
          <span className="inspector-line">Linha <strong>{vehicle.line}</strong></span>
        </div>
        <div className="inspector-badges">
          <span className={`inspector-status${stale ? " is-stale" : ""}`}><i />{status}</span>
          <span className="inspector-mode">{mode}</span>
        </div>
        <figure className="inspector-portrait">
          <img
            src={`/models/bus-portrait-${vehicle.paint.slice(1)}.webp`}
            width={720}
            height={360}
            alt={demo ? `Retrato do ônibus ${vehicle.id}` : "Render ilustrativo do modelo de ônibus"}
          />
          {!demo && <figcaption>Modelo ilustrativo</figcaption>}
        </figure>
      </header>

      <div className="inspector-tabs" role="tablist" aria-label="Informações do veículo">
        {tabs.map(({ id: value, label }, index) => (
          <button key={value} type="button" role="tab" id={`${id}-${value}`}
            aria-controls={`${id}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)} onKeyDown={(event) => moveTab(event, index)}>
            {label}
          </button>
        ))}
      </div>

      <div className="inspector-content" role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`}>
        {tab === "summary" && <>
          <div className="inspector-route-summary">
            <Route size={17} />
            <div><small>{demo ? "Destino do cenário" : "Destino informado"}</small><strong>{destination || "Não informado"}</strong></div>
          </div>
          {demo ? (
            <dl className="inspector-stats">
              <div><dt><ArrowDownLeft size={13} /> Entrada</dt><dd>{demo.lastEntry !== undefined ? clockLabel(demo.lastEntry) : "—"}</dd></div>
              <div><dt><Clock3 size={13} /> Em baia</dt><dd>{demo.parkedAt !== undefined ? durationLabel(elapsed - demo.parkedAt) : "—"}</dd></div>
              <div><dt><ArrowUpRight size={13} /> Saída prevista</dt><dd>{nextDeparture}</dd></div>
            </dl>
          ) : obs && (
            <dl className="inspector-reading">
              <div><dt>Horário do GPS</dt><dd>{readingTime.format(new Date(obs.observedAt))}</dd></div>
              <div><dt>Recepção</dt><dd>{readingTime.format(new Date(obs.receivedAt))}</dd></div>
            </dl>
          )}
          {demo && (recentMovements.length > 0 || upcomingDeparture !== undefined) && (
            <section className="inspector-recent" aria-labelledby={`${id}-movements`}>
              <h3 id={`${id}-movements`}>Movimentação em tempo real</h3>
              <ol>
                {recentMovements.map(({ at, label }, index) => {
                  const latest = index === recentMovements.length - 1;
                  return (
                    <li key={label + at} data-state={latest ? "latest" : "recorded"}>
                      <span className="movement-marker" aria-hidden="true">{latest && <Check size={9} strokeWidth={3} />}</span>
                      <time>{clockLabel(at)}</time>
                      <span className="movement-label">{label}</span>
                    </li>
                  );
                })}
                {upcomingDeparture !== undefined && (
                  <li data-state="planned">
                    <span className="movement-marker" aria-hidden="true" />
                    <time>{nextDeparture}</time>
                    <span className="movement-label">Saída prevista · Linha {vehicle.line}</span>
                  </li>
                )}
              </ol>
            </section>
          )}
          <h3><MapPin size={16} /> Localização atual</h3>
          <div className="inspector-map">
            {demo ? <SiteMap pose={demo.pose} /> : area && obs ? <GpsMap area={area} vehicle={vehicle} /> : null}
          </div>
          {demo ? (
            <div className="inspector-location">
              {demo.pose.visible ? <span>Posição no cenário <strong>X {demo.pose.x.toFixed(1)} m · Z {demo.pose.z.toFixed(1)} m</strong></span>
                : <span>Trecho externo ao cenário</span>}
              {demo.pose.bay && <p>Baia ilustrativa <strong>{demo.pose.bay}</strong></p>}
            </div>
          ) : obs && (
            <div className="inspector-location"><span>Posição GPS <strong>{obs.latitude.toFixed(6)}, {obs.longitude.toFixed(6)}</strong></span></div>
          )}
        </>}

        {tab === "route" && <>
          <h3><Route size={16} /> Linha {vehicle.line}</h3>
          <ol className="inspector-stops">
            <li><small>Origem</small><strong>{origin || "Não informada"}</strong></li>
            <li><small>Destino</small><strong>{destination || "Não informado"}</strong></li>
          </ol>
          <div className="inspector-map">
            {demo ? <SiteMap pose={demo.pose} details={demo} /> : area && obs ? <GpsMap area={area} vehicle={vehicle} /> : null}
          </div>
          {demo ? <>
            <div className="inspector-legend"><span><i /> Saída</span><span><i /> Retorno</span></div>
            <p className="inspector-note">Retorno pela baia {demo.destinationBay} · trechos modelados do cenário.</p>
          </> : <p className="inspector-note">O ponto mostra a leitura recebida. O traçado da linha está indisponível nesta fonte.</p>}
        </>}

        {tab === "history" && <>
          <h3><History size={16} /> {demo ? "Movimentações do veículo" : "Leituras de posição"}</h3>
          {demo ? (
            demo.history.length > 0 ? <ol className="inspector-history">
              {demo.history.map(({ at, label }) => <li key={label + at}><time>{clockLabel(at)}</time><strong>{label}</strong></li>)}
            </ol> : <p className="inspector-note">Nenhuma passagem registrada para este veículo.</p>
          ) : <>
            <ol className="inspector-history">
              {samples.map((row) => <li key={row.observedAt}>
                <time dateTime={row.observedAt}>{readingTime.format(new Date(row.observedAt))}</time>
                <strong>{row.latitude.toFixed(6)}, {row.longitude.toFixed(6)}</strong>
              </li>)}
            </ol>
            <p className="inspector-note">{mode === "LIVE" ? "Última leitura recebida do Olho Vivo." : "Registros verificados até o horário selecionado."}</p>
          </>}
        </>}
      </div>

      <footer className="inspector-actions">
        <button disabled={cameraDisabled} className="focus" onClick={() => onCamera("focus")}>
          <Crosshair size={15} /> Focar veículo <ChevronRight size={14} />
        </button>
        {demo && <button className="follow" disabled={cameraDisabled} aria-pressed={following} onClick={() => onCamera("follow")}>
          <Navigation size={14} /> Seguir ônibus
        </button>}
        <div className="inspection" aria-label="Vistas do veículo">
          <button disabled={cameraDisabled} onClick={() => onCamera("profile")}>Perfil</button>
          <button disabled={cameraDisabled} onClick={() => onCamera("top")}>Superior</button>
        </div>
      </footer>
    </section>
  );
}
