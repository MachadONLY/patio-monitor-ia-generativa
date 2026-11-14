import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./style.css";
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, BusFront, Camera, ChevronRight, ClipboardCheck, Crosshair, MapPin, Minus, Plus, Radio } from "lucide-react";
import type { Vehicle } from "./fleet";
import { GateCamera } from "./gs-evidence";
import { Scene, hasAlvoradaMap, type CameraAction, type CameraZoom } from "./scene";
import { ShiftReview } from "./shift-review";
import { readingTime, VehicleInspector } from "./vehicle-inspector";
import { observedVehicles, observationSources, useObservations } from "./observations";

function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<CameraAction>({ type: "terminal" });
  const [zoom, setZoom] = useState<CameraZoom>();
  const [reviewing, setReviewing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
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
  const provider = snapshot?.source ? observationSources[snapshot.source] : undefined;
  const vehicles = observedVehicles(snapshot);
  const vehicle = vehicles.find((item) => item.id === selected);
  const site = area?.name ?? "Operação de ônibus";
  const current = snapshot?.state === "connected" && !result?.failed;
  const connection = current ? "GPS ao vivo"
    : snapshot?.state === "no_observations" && !result?.failed ? "Sem veículos no recorte"
    : !result?.failed && (!snapshot || snapshot.state === "connecting") ? "Conectando ao GPS"
    : "GPS indisponível";
  const defaultView = hasTerminal ? "terminal" : "home";
  const action = view.type === "terminal" && !hasTerminal ? { type: "home" } as const : view;

  useEffect(() => {
    if (reviewing) reviewRegion.current?.focus();
  }, [reviewing]);

  function selectVehicle(id: string) {
    const target = vehicles.find((item) => item.id === id);
    if (!target) return;
    setSelected(id);
    setView({ type: "focus", vehicle: target });
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
          <div><strong>{site}</strong><small>{provider?.location ?? "Mobilidade urbana"}</small></div>
        </div>
        <div className="connection-state" data-connected={current} role="status"><i />{connection}</div>
      </header>
      {cameraOpen && <GateCamera onClose={() => setCameraOpen(false)} />}
      <main className="layout operating-layout">
        <section className={reviewing ? "workspace workspace-review" : "workspace workspace-inspector"} aria-label="Operação do pátio">
          <div className="viewport" data-ready={ready} data-camera-mode={action.type}>
            <Scene vehicles={vehicles} selected={selected} onSelect={selectVehicle}
              action={action} zoom={zoom} onReady={onReady} onFailure={onFailure}
              demo={false} area={area} />
            {!ready && !failed3d && <div className="load-label" role="status">Carregando mapa 3D…</div>}
            <div className="scene-caption">
              <span className="eyebrow"><Radio size={13} /> MONITORAMENTO GPS</span>
              <h1>{hasTerminal ? "Terminal Alvorada" : site}</h1>
              <span>{hasTerminal ? "Implantação cartográfica · volumes ilustrativos" : area?.source}</span>
            </div>
            {!failed3d && (
              <div className="camera operating-camera" aria-label="Controles da câmera">
                {hasTerminal && <button className="icon labelled-camera" aria-label="Ver Terminal Alvorada"
                  aria-pressed={action.type === "terminal"} onClick={resetView}><Building2 size={17} /> Terminal</button>}
                <button className="icon labelled-camera" aria-label="Restaurar vista geral" onClick={() => {
                  setSelected(null); setView({ type: "home" });
                }}><Crosshair size={17} /> Entorno</button>
                <button className="icon" aria-label="Aproximar câmera" onClick={() => setZoom({ factor: 1.22 })}><Plus size={18} /></button>
                <button className="icon" aria-label="Afastar câmera" onClick={() => setZoom({ factor: 1 / 1.22 })}><Minus size={18} /></button>
              </div>
            )}
            {hasTerminal && <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>}
            <div className="viewport-footer"><span className="view-mode">3D</span><span>Selecione um ônibus para abrir sua ficha</span></div>
          </div>
          <aside className="side" aria-label="Painel de revisão" hidden={!reviewing} ref={reviewRegion} tabIndex={-1}>
            <ShiftReview mode="LIVE" vehicles={snapshot?.source === "rio_mobi_gtfs_rt" ? [] : vehicles}
              canFocusVehicle={ready && !failed3d} onFocusVehicle={selectVehicle}
              onClose={() => { setReviewing(false); reviewEntry.current?.focus(); }} />
          </aside>
          <aside className="side" aria-label="Contexto do pátio" hidden={reviewing} ref={contextRegion}>
            {vehicle ? (
              <VehicleInspector vehicle={vehicle} mode="LIVE" site={site} area={area} elapsed={0}
                stale={!current || Date.now() - Date.parse(vehicle.observation?.observedAt ?? "") > 90000}
                following={false} cameraDisabled={failed3d} onClose={resetView}
                onCamera={(type) => setView({ type, vehicle })} />
            ) : (
              <section className="info operating-fleet">
                <span className="eyebrow">FROTA OBSERVADA</span>
                <h2>{vehicles.length} {vehicles.length === 1 ? "veículo" : "veículos"} no entorno</h2>
                {vehicles.length > 0 ? <div className="vehicle-list">
                  {vehicles.map((item) => (
                    <button key={item.id} aria-label={`Inspecionar ônibus ${item.id}`} onClick={() => selectVehicle(item.id)}>
                      <BusFront size={16} />
                      <strong>{item.id}</strong>
                      {item.observation && <small>{readingTime.format(new Date(item.observation.observedAt))}</small>}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div> : <p className="quiet">{connection}</p>}
              </section>
            )}
            <button className="shift-entry" ref={reviewEntry} aria-label="Revisar turno" onClick={() => setReviewing(true)}>
              <ClipboardCheck size={19} /><span><strong>Revisar turno</strong><small>Confira divergências entre escala e portaria</small></span><ChevronRight size={16} />
            </button>
            <button className="shift-entry" aria-label="Câmera do portão" onClick={() => setCameraOpen(true)}>
              <Camera size={19} /><span><strong>Câmera do portão</strong><small>Consulte a gravação e seus cruzamentos</small></span><ChevronRight size={16} />
            </button>
            {provider && <p className="operating-source">{provider.title}{snapshot?.archiveState === "unavailable" && " · Histórico indisponível"}</p>}
          </aside>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
