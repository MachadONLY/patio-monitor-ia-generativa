import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./style.css";
import "./operation-design.css";
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, BusFront, Camera, ChevronRight, ClipboardCheck, Crosshair, Fingerprint, MapPin, Minus, Pause, Play, Plus, ListChecks } from "lucide-react";
import type { Vehicle } from "./fleet";
import { buildVehicleRoadNetwork, projectAlvoradaRoads } from "./alvorada-road-path";
import { alvoradaRoadSurface } from "./alvorada-road-surface";
import { TerminalCrossings } from "./terminal-crossings";
import { AssessmentExample } from "./assessment-example";
import { AssessmentTour, assessmentSteps } from "./assessment-tour";
import { GateCamera, GateEvidence } from "./gs-evidence";
import { GateMonitor } from "./gate-monitor";
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
  const [gateOpen, setGateOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("cancela") === "1" && params.get("tour") !== "1";
  });
  const [fleetPage, setFleetPage] = useState(0);
  const [showCrossings, setShowCrossings] = useState(false);
  const [tourStep, setTourStep] = useState<number | null>(() => new URLSearchParams(window.location.search).get("tour") === "1" ? 0 : null);
  const [animateAmbience, setAnimateAmbience] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed3d, setFailed3d] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => setFailed3d(true), []);
  const reviewEntry = useRef<HTMLButtonElement>(null);
  const gateEntry = useRef<HTMLButtonElement>(null);
  const crossingsEntry = useRef<HTMLButtonElement>(null);
  const crossingsBack = useRef<HTMLButtonElement>(null);
  const tourEntry = useRef<HTMLButtonElement>(null);
  const tourTarget = useRef<HTMLDivElement>(null);
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
  const pageSize = 3;
  const pageCount = Math.max(1, Math.ceil(vehicles.length / pageSize));
  const currentPage = Math.min(fleetPage, pageCount - 1);
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
    if (showCrossings) crossingsBack.current?.focus({ preventScroll: true });
  }, [showCrossings]);

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
    setShowCrossings(false);
    contextRegion.current?.querySelector(".operation-panel-content")?.scrollTo({ top: 0 });
  }

  function closeTour() {
    setTourStep(null);
    requestAnimationFrame(() => tourEntry.current?.focus({ preventScroll: true }));
    const url = new URL(window.location.href);
    if (url.searchParams.get("tour") === "1") {
      url.searchParams.delete("tour");
      window.history.replaceState(window.history.state, "", url);
    }
  }

  function resetView() {
    setSelected(null);
    setView({ type: defaultView });
  }

  function closeGate() {
    setGateOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("cancela") === "1") {
      url.searchParams.delete("cancela");
      window.history.replaceState(window.history.state, "", url);
      requestAnimationFrame(() => gateEntry.current?.focus({ preventScroll: true }));
    }
  }

  return (
    <div className="app operating-app" data-tour-step={tourStep ?? undefined}>
      <header className="topbar" inert={tourStep !== null}>
        <div className="identity">
          <div className="logo"><BusFront size={23} strokeWidth={2.2} /></div>
          <div className="brand">Pátio Monitor</div>
        </div>
        <div className="location">
          <MapPin size={16} />
          <div><strong>{hasTerminal ? "Barra da Tijuca" : site}</strong><small>{provider?.location ?? "Mobilidade urbana"}</small></div>
        </div>
        <div className="header-actions">
          <div className="connection-state" data-connected={current} role="status"><i /><span>{connection}</span></div>
          <button type="button" className="operation-primary header-guide" ref={tourEntry} onClick={() => {
            setReviewing(false);
            setTourStep(0);
          }}>
            <Play size={15} aria-hidden="true" /> Iniciar teste guiado
          </button>
        </div>
      </header>
      {cameraOpen && <GateCamera onClose={() => setCameraOpen(false)} />}
      {gateOpen && <GateMonitor onClose={closeGate} />}
      <main className="layout operating-layout">
        <section className={reviewing ? "workspace workspace-review" : "workspace workspace-inspector"} aria-label="Operação do pátio">
          <div className="viewport" inert={tourStep !== null} data-ready={ready} data-camera-mode={action.type}>
            <Scene vehicles={vehicles} selected={selected} onSelect={selectVehicle}
              action={action} zoom={zoom} onReady={onReady} onFailure={onFailure}
              demo={false} area={area} animateAmbience={animateAmbience && tourStep === null} roadNetwork={roadNetwork} />
            {!ready && !failed3d && <div className="load-label" role="status">Carregando mapa 3D…</div>}
            <div className="scene-caption">
              <h2>{hasTerminal ? "Terminal Alvorada" : site}</h2>
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
            <div className="viewport-footer"><span className="view-mode">3D</span><span>Posições GPS observadas · cenário e pessoas ilustrativos</span></div>
          </div>
          <aside className="side review-panel" aria-label="Painel de revisão" hidden={!reviewing} inert={tourStep !== null} ref={reviewRegion} tabIndex={-1}>
            <ShiftReview mode="LIVE" vehicles={snapshot?.source === "rio_mobi_gtfs_rt" ? [] : vehicles}
              canFocusVehicle={ready && !failed3d} onFocusVehicle={selectVehicle}
              onClose={() => { setReviewing(false); reviewEntry.current?.focus(); }} />
          </aside>
          <aside className="side operation-panel" aria-label="Contexto do pátio" hidden={reviewing} ref={contextRegion}>
            <div className="operation-links" inert={tourStep !== null && tourStep > 0} ref={tourStep === 0 ? tourTarget : undefined}>
              <button type="button" className="shift-entry operation-camera" ref={reviewEntry} aria-label="Revisar turno" onClick={() => tourStep === 0 ? setTourStep(1) : setReviewing(true)}>
                <span className="operation-camera-icon"><ClipboardCheck size={18} aria-hidden="true" /></span>
                <span><strong>Revisar turno</strong><small>Teste com exemplos ou importe CSVs</small></span><ChevronRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="shift-entry operation-camera" aria-label="Câmera do portão" onClick={() => tourStep === 0 ? setTourStep(3) : setCameraOpen(true)}>
                <span className="operation-camera-icon"><Camera size={18} aria-hidden="true" /></span>
                <span><strong>Câmera do portão</strong><small>Detecção em gravação real</small></span><ChevronRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="shift-entry operation-camera operation-gate" ref={gateEntry} onClick={() => setGateOpen(true)}>
                <span className="operation-camera-icon"><Fingerprint size={18} aria-hidden="true" /></span>
                <span><strong>Monitoramento da Cancela</strong><small>Eventos do protótipo Smart Bus Gate</small></span><ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="operation-panel-content" inert={tourStep !== null}>
              <div className="crossings-panel" hidden={!showCrossings || !hasTerminal}>
                <button type="button" className="operation-secondary panel-return" ref={crossingsBack} onClick={() => {
                  setShowCrossings(false);
                  requestAnimationFrame(() => crossingsEntry.current?.focus({ preventScroll: true }));
                }}><ArrowLeft size={15} /> Voltar à frota</button>
                <TerminalCrossings enabled={hasTerminal} onSelect={selectVehicle} activeVehicleIds={new Set(vehicles.map(({ id }) => id))} />
              </div>
              {(!showCrossings || !hasTerminal) && (vehicle ? (
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
                    <div><h2>Ônibus no entorno</h2><p>Selecione um veículo para consultar a leitura GPS</p></div>
                    <strong className="fleet-total" aria-label={`${vehicles.length} veículos`}>{vehicles.length}</strong>
                  </div>
                  {terminalVehicles === 0 && vehicles.length > 0 && action.type === "terminal" && (
                    <div className="fleet-note">
                      <span>Sem leitura GPS a até 230 m do terminal.</span>
                      <button type="button" onClick={() => setView({ type: "home" })}>Ver ônibus no entorno</button>
                    </div>
                  )}
                  {vehicles.length > 0 ? <div className="vehicle-list">
                    {vehicles.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((item) => (
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
                  {pageCount > 1 && (
                    <nav className="fleet-pages" aria-label="Páginas da frota">
                      <button type="button" className="icon" disabled={!currentPage} aria-label="Ônibus anteriores" onClick={() => setFleetPage(currentPage - 1)}><ArrowLeft size={15} /></button>
                      <span>{currentPage + 1} de {pageCount}</span>
                      <button type="button" className="icon" disabled={currentPage + 1 === pageCount} aria-label="Próximos ônibus" onClick={() => setFleetPage(currentPage + 1)}><ChevronRight size={16} /></button>
                    </nav>
                  )}
                  {hasTerminal && <button type="button" className="crossings-entry" ref={crossingsEntry} onClick={() => setShowCrossings(true)}>
                    <ListChecks size={16} aria-hidden="true" /> Entradas e saídas <ChevronRight size={16} aria-hidden="true" />
                  </button>}
                </section>
              ))}
            </div>
            {provider && <p className="operating-source">{provider.title}{snapshot?.archiveState === "unavailable" && " · Histórico indisponível"}</p>}
          </aside>
        </section>
        {tourStep !== null && tourStep > 0 && (
          <div className="tour-stage" ref={tourTarget} data-step={tourStep}>
            {tourStep < 3 ? <AssessmentExample explain={tourStep === 2} /> : (
              <section className="tour-feature" aria-label="Evidência em vídeo">
                <header className="tour-feature-heading"><div><p>Gravação de referência</p><h2>Câmera do portão</h2></div></header>
                <GateEvidence />
              </section>
            )}
          </div>
        )}
      </main>
      {tourStep !== null && <AssessmentTour step={tourStep} target={tourTarget} onClose={closeTour}
        onBack={() => setTourStep(tourStep - 1)}
        onAdvance={() => tourStep + 1 === assessmentSteps.length ? closeTour() : setTourStep(tourStep + 1)} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
