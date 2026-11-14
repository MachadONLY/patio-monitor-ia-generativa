import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./style.css";
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, BusFront, Camera, ChevronRight, ClipboardCheck, Crosshair, MapPin, Minus, Pause, Play, Plus, Radio } from "lucide-react";
import type { Vehicle } from "./fleet";
import { buildVehicleRoadNetwork, projectAlvoradaRoads } from "./alvorada-road-path";
import { alvoradaRoadSurface } from "./alvorada-road-surface";
import { TerminalCrossings } from "./terminal-crossings";
import { GateCamera } from "./gs-evidence";
import { Scene, hasAlvoradaMap, ALVORADA_TERMINAL, type CameraAction, type CameraZoom } from "./scene";
import { ShiftReview } from "./shift-review";
import { VehicleInspector } from "./vehicle-inspector";
import { localPoint, observedVehicles, observationSources, useObservations } from "./observations";

const fleetClock = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", timeStyle: "medium",
});

function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<CameraAction>({ type: "terminal" });
  const [zoom, setZoom] = useState<CameraZoom>();
  const [reviewing, setReviewing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [animateAmbience, setAnimateAmbience] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed3d, setFailed3d] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => setFailed3d(true), []);
  const reviewEntry = useRef<HTMLButtonElement>(null);
  const reviewRegion = useRef<HTMLElement>(null);
  const contextRegion = useRef<HTMLElement>(null);

  const result = useObservations("LIVE", "");
  const snapshot = result?.data;
  const area = snapshot?.area;
  const hasTerminal = hasAlvoradaMap(area);
  const east = area?.origin[0], north = area?.origin[1];
  const roadNetwork = useMemo(() => hasTerminal && east !== undefined && north !== undefined
    ? buildVehicleRoadNetwork(projectAlvoradaRoads([east, north]), alvoradaRoadSurface([east, north]))
    : undefined, [hasTerminal, east, north]);
  const provider = snapshot?.source ? observationSources[snapshot.source] : undefined;
  const vehicles = observedVehicles(snapshot);
  const observedVehicle = vehicles.find((item) => item.id === selected);
  const [lastSelected, setLastSelected] = useState<Vehicle>();
  const vehicle = observedVehicle ?? (lastSelected?.id === selected ? lastSelected : undefined);
  const observed = observedVehicle?.observation;
  const hasRoad = (item: Vehicle) => !roadNetwork || Boolean(roadNetwork.match({
    x: item.x, z: item.z,
  }));
  const canLocate = !!observedVehicle && hasRoad(observedVehicle);
  const site = area?.name ?? "Operação de ônibus";
  const current = snapshot?.state === "connected" && !result?.failed;
  const connection = current ? "GPS ao vivo"
    : snapshot?.state === "stale" && !result?.failed ? "GPS desatualizado"
    : snapshot?.state === "no_observations" && !result?.failed ? "Sem veículos no recorte"
    : !result?.failed && (!snapshot || snapshot.state === "connecting") ? "Conectando ao GPS"
    : "GPS indisponível";
  const terminalCenter = hasTerminal && area ? localPoint(area.origin, ALVORADA_TERMINAL) : undefined;
  const terminalVehicles = terminalCenter && vehicles.filter(({ x, z }) =>
    Math.hypot(x - terminalCenter[0], z - terminalCenter[1]) < 230
  ).length;
  const defaultView = hasTerminal ? "terminal" : "home";
  const baseAction = useMemo<CameraAction>(() => ({ type: defaultView }), [defaultView]);
  const action = (view.type === "terminal" && !hasTerminal) || (view.vehicle && !canLocate) ? baseAction : view;

  useEffect(() => {
    if (reviewing) reviewRegion.current?.focus();
  }, [reviewing]);

  useEffect(() => {
    if (!observed) return;
    setLastSelected((previous) => {
      if (previous?.id === observed.vehicleId && previous.observation?.observedAt === observed.observedAt) return previous;
      return observedVehicle;
    });
  }, [observed, observedVehicle]);

  function selectVehicle(id: string) {
    const target = vehicles.find((item) => item.id === id);
    if (!target) return;
    setLastSelected(target);
    setSelected(id);
    setView(hasRoad(target) ? { type: "focus", vehicle: target } : { type: defaultView });
    setReviewing(false);
    contextRegion.current?.scrollTo({ top: 0 });
  }

  function resetView() {
    setSelected(null);
    setView({ type: defaultView });
  }

  return (
    <div className="app operating-app">
      <header className="topbar">
        <div className="identity">
          <div className="logo"><BusFront size={23} strokeWidth={2.2} /></div>
          <div className="brand">Pátio Monitor</div>
        </div>
        <div className="location">
          <MapPin size={16} />
          <div><strong>{hasTerminal ? "Barra da Tijuca" : site}</strong><small>{provider?.location ?? "Mobilidade urbana"}</small></div>
        </div>
        <div className="connection-state" data-connected={current} role="status"><i />{connection}</div>
      </header>
      {cameraOpen && <GateCamera onClose={() => setCameraOpen(false)} />}
      <main className="layout operating-layout">
        <section className={reviewing ? "workspace workspace-review" : "workspace workspace-inspector"} aria-label="Operação do pátio">
          <div className="viewport" data-ready={ready} data-camera-mode={action.type}>
            <Scene vehicles={vehicles} selected={selected} onSelect={selectVehicle}
              action={action} zoom={zoom} onReady={onReady} onFailure={onFailure}
              demo={false} area={area} animateAmbience={animateAmbience} roadNetwork={roadNetwork} />
            {!ready && !failed3d && <div className="load-label" role="status">Carregando mapa 3D…</div>}
            <div className="scene-caption">
              <span className="eyebrow"><Radio size={13} /> MONITORAMENTO GPS</span>
              <h1>{hasTerminal ? "Terminal Alvorada" : site}</h1>
              <span>{hasTerminal ? "Barra da Tijuca · Rio de Janeiro" : area?.source}</span>
            </div>
            {!failed3d && (
              <div className="camera operating-camera" aria-label="Controles da câmera">
                {hasTerminal && <button className="icon labelled-camera" aria-label="Ver Terminal Alvorada"
                  aria-pressed={action.type === "terminal"} onClick={resetView}><Building2 size={17} /> Terminal</button>}
                <button className="icon labelled-camera" aria-label="Restaurar vista geral" onClick={() => {
                  setSelected(null); setView({ type: "home" });
                }}><Crosshair size={17} /> Entorno</button>
                {hasTerminal && <button className="icon" aria-label={animateAmbience ? "Pausar ambientação" : "Retomar ambientação"}
                  title={animateAmbience ? "Pausar ambientação" : "Retomar ambientação"}
                  onClick={() => setAnimateAmbience((playing) => !playing)}>{animateAmbience ? <Pause size={16} /> : <Play size={16} />}</button>}
                <button className="icon" aria-label="Aproximar câmera" onClick={() => setZoom({ factor: 1.22 })}><Plus size={18} /></button>
                <button className="icon" aria-label="Afastar câmera" onClick={() => setZoom({ factor: 1 / 1.22 })}><Minus size={18} /></button>
              </div>
            )}
            {hasTerminal && <div className="map-attribution">
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
              <a href="https://pgeo3.rio.rj.gov.br/arcgis/rest/services/Imagens/Mosaico_2019/ImageServer" target="_blank" rel="noreferrer">Ortofoto 2019 · IPP / PCRJ</a>
            </div>}
            <div className="viewport-footer"><span className="view-mode">3D</span><span>Ônibus via GPS · carros e pessoas ilustrativos</span></div>
          </div>
          <aside className="side" aria-label="Painel de revisão" hidden={!reviewing} ref={reviewRegion} tabIndex={-1}>
            <ShiftReview mode="LIVE" vehicles={snapshot?.source === "rio_mobi_gtfs_rt" ? [] : vehicles}
              canFocusVehicle={ready && !failed3d} onFocusVehicle={selectVehicle}
              onClose={() => { setReviewing(false); reviewEntry.current?.focus(); }} />
          </aside>
          <aside className="side" aria-label="Contexto do pátio" hidden={reviewing} ref={contextRegion}>
            {!vehicle && (
              <section className="info operations-intro" aria-labelledby="operations-objective">
                <div>
                  <span className="eyebrow">CONFERÊNCIA DE SAÍDAS</span>
                  <h2 id="operations-objective">O ônibus saiu no horário e com o prefixo da escala?</h2>
                </div>
                <p>Compare a escala com a portaria, investigue trocas, atrasos e saídas sem registro, e documente a conclusão do turno.</p>
                <button className="shift-entry" ref={reviewEntry} aria-label="Revisar turno" onClick={() => setReviewing(true)}>
                  <ClipboardCheck size={19} /><span><strong>Revisar turno</strong><small>Importe seus arquivos ou abra um caso de exemplo</small></span><ChevronRight size={16} />
                </button>
              </section>
            )}
            {vehicle ? (
              <VehicleInspector key={vehicle.id} vehicle={vehicle} mode="LIVE" site={site} area={area} elapsed={0}
                stale={!observedVehicle || !current || Date.now() - Date.parse(vehicle.observation?.observedAt ?? "") > 90000}
                following={false} cameraDisabled={failed3d || !canLocate} onClose={resetView}
                roadNotice={roadNetwork && observedVehicle
                  ? canLocate ? "O mapa ajusta o ônibus à pista. A ficha mostra a coordenada original do GPS."
                    : "Leitura sem correspondência segura com uma pista. Consulte a posição original e o histórico nesta ficha."
                  : undefined}
                onCamera={(type) => setView({ type, vehicle })} />
            ) : (
              <section className="info operating-fleet">
                <div className="fleet-heading">
                  <div><span className="eyebrow">FROTA OBSERVADA</span><h2>Ônibus no entorno</h2></div>
                  <strong className="fleet-total" aria-label={`${vehicles.length} veículos`}>{vehicles.length}</strong>
                </div>
                {terminalVehicles === 0 && vehicles.length > 0 && action.type === "terminal" && (
                  <div className="fleet-note">
                    <span>Sem leitura GPS a até 230 m do terminal.</span>
                    <button type="button" onClick={() => setView({ type: "home" })}>Ver ônibus no entorno</button>
                  </div>
                )}
                {vehicles.length > 0 ? <div className="vehicle-list">
                  {vehicles.map((item) => (
                    <button key={item.id} aria-label={`Inspecionar ônibus ${item.id}`} onClick={() => selectVehicle(item.id)}>
                      <BusFront size={16} />
                      <span className="fleet-vehicle">
                        <strong>{item.id}</strong>
                        <span>{item.line === "Não informada" ? "Linha indisponível" : `Linha ${item.line}`}</span>
                      </span>
                      {item.observation && <time dateTime={item.observation.observedAt}>
                        {fleetClock.format(new Date(item.observation.observedAt))}
                      </time>}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div> : <p className="quiet">{connection}</p>}
              </section>
            )}
            <button className="shift-entry" aria-label="Câmera do portão" onClick={() => setCameraOpen(true)}>
              <Camera size={19} /><span><strong>Câmera do portão</strong><small>Confira a detecção e a hora da passagem na gravação</small></span><ChevronRight size={16} />
            </button>
            <TerminalCrossings enabled={hasTerminal} onSelect={selectVehicle} activeVehicleIds={new Set(vehicles.map(({ id }) => id))} />
            {provider && <p className="operating-source">{provider.title}{snapshot?.archiveState === "unavailable" && " · Histórico indisponível"}</p>}
          </aside>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
