import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./style.css";
import { createRoot } from "react-dom/client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  BusFront,
  Camera,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Crosshair,
  History,
  Layers3,
  List,
  MapPin,
  Minus,
  Plus,
  Radio,
  X,
} from "lucide-react";
import { fleet, type Vehicle } from "./fleet";
import { GateCamera } from "./gs-evidence";
import { Scene, type CameraAction, type CameraZoom } from "./scene";
import { ShiftReview } from "./shift-review";
import { OperationFeed, useDemoOperation } from "./operation-demo";
import { sampleSimulation } from "./simulation";
import { readingTime, SiteMap, VehicleInspector } from "./vehicle-inspector";
import { observedVehicles, observationSources, useObservations, type Mode } from "./observations";

function App() {
  const [mode, setMode] = useState<Mode>("DEMO");
  const [selected, setSelected] = useState<string | null>("8 2361");
  const [action, setAction] = useState<CameraAction>({ type: "home" });
  const [zoom, setZoom] = useState<CameraZoom>();
  const [panel, setPanel] = useState<"overview" | "fleet" | "shift">(
    "overview",
  );
  const [help, setHelp] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const [failed3d, setFailed3d] = useState(false);
  const [at, setAt] = useState("");
  const onFailure = useCallback(() => setFailed3d(true), []);
  const result = useObservations(mode, at);
  const snapshot = result?.data;
  const area = snapshot?.area;
  const demo = mode === "DEMO";
  const provider = observationSources[snapshot?.source ?? "sptrans_olhovivo"];
  const location = demo ? observationSources.sptrans_olhovivo : provider;
  const vehicles = demo ? fleet : observedVehicles(snapshot);
  const site = demo ? "Terminal Pátio Leste" : (area?.name ?? "Área operacional");
  const noData = !demo && !vehicles.length;
  const vehicle = vehicles.find((item) => item.id === selected);
  const reviewing = panel === "shift";
  const operation = useDemoOperation(demo);
  const demoPose = demo && vehicle ? sampleSimulation(vehicle, operation.elapsed) : undefined;
  const reviewEntry = useRef<HTMLButtonElement>(null);
  const reviewRegion = useRef<HTMLElement>(null);
  const contextRegion = useRef<HTMLElement>(null);
  const fleetRegion = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected && !reviewing) contextRegion.current?.scrollTo({ top: 0 });
  }, [selected, reviewing]);
  useEffect(() => {
    if (reviewing) reviewRegion.current?.focus();
  }, [reviewing]);

  useEffect(() => {
    if (panel === "fleet") fleetRegion.current?.scrollIntoView({ block: "nearest" });
  }, [panel]);

  function closeReview() {
    setPanel("overview");
    reviewEntry.current?.focus();
  }

  function selectVehicle(vehicleId: string) {
    setSelected(vehicleId);
    if (!reviewing) contextRegion.current?.scrollTo({ top: 0 });
    if (action.type !== "follow" || action.vehicle?.id === vehicleId) return;
    const target = vehicles.find((item) => item.id === vehicleId);
    if (target) setAction({ type: "follow", vehicle: target });
  }

  function followVehicle(target: Vehicle) {
    setSelected(target.id);
    setAction({ type: "follow", vehicle: target });
  }

  function focusReviewVehicle(vehicleId: string) {
    const target = vehicles.find((item) => item.id === vehicleId);
    if (target) {
      setSelected(target.id);
      setAction({ type: "focus", vehicle: target });
    }
  }

  function chooseMode(next: Mode) {
    setCameraOpen(false);
    setMode(next);
    setAt("");
    setSelected(next === "DEMO" ? "8 2361" : null);
    setAction({ type: "home" });
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="identity">
          <div className="logo">
            <BusFront size={23} strokeWidth={2.2} />
          </div>
          <div>
            <div className="brand">Pátio Monitor</div>
            <div className="brand-caption">MOBILIDADE URBANA</div>
          </div>
        </div>
        <div className="location">
          <MapPin size={16} />
          <div>
            <strong>{site}</strong>
            <small>
              {demo
                ? "São Paulo · cenário ilustrativo"
                : location.location + " · observações GPS"}
            </small>
          </div>
        </div>
        <div className="modes" aria-label="Modo de dados">
          {(["DEMO", "LIVE", "REPLAY"] as const).map((name) => (
            <button
              key={name}
              aria-pressed={mode === name}
              onClick={() => chooseMode(name)}
            >
              {mode === name && <i />}
              {name}
            </button>
          ))}
        </div>
        <button
          className="icon help"
          type="button"
          aria-label="Ajuda e origem dos dados"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={20} />
        </button>
      </header>
      {cameraOpen && demo && <GateCamera onClose={() => setCameraOpen(false)} />}
      <main className="layout">
        <nav className="rail" aria-label="Área de trabalho">
          <button
            className="icon"
            aria-label="Visão geral"
            aria-pressed={panel === "overview"}
            onClick={() => {
              setPanel("overview");
              setSelected(null);
              if (action.type === "follow") setAction({ type: "home" });
            }}
          >
            <Layers3 size={20} />
          </button>
          <button
            className="icon"
            aria-label={
              demo ? "Frota de demonstração" : "Observações de veículos"
            }
            aria-pressed={panel === "fleet"}
            onClick={() => setPanel("fleet")}
          >
            <List size={20} />
          </button>
          <button
            className="icon"
            ref={reviewEntry}
            aria-label="Fechamento de turno"
            title="Fechamento de turno"
            aria-pressed={reviewing}
            onClick={() => setPanel("shift")}
          >
            <ClipboardCheck size={20} />
          </button>
          {demo && (
            <button
              type="button"
              className="icon"
              aria-label="Câmera do portão"
              aria-haspopup="dialog"
              title="Câmera do portão"
              onClick={() => setCameraOpen(true)}
            >
              <Camera size={20} />
            </button>
          )}
        </nav>
        <section
          className={reviewing ? "workspace workspace-review" : "workspace workspace-inspector"}
          aria-label="Visão do pátio"
        >
          <div className="viewport" data-ready={ready} data-camera-mode={action.type}>
            <Scene
              vehicles={vehicles}
              selected={selected}
              onSelect={selectVehicle}
              action={action}
              zoom={zoom}
              onReady={onReady}
              onFailure={onFailure}
              demo={demo}
              area={area}
              simulation={demo ? operation.scene : undefined}
            />
            {!ready && !failed3d && (
              <div className="load-label" role="status">
                Iniciando cena WebGL…
              </div>
            )}
            <div className="scene-caption">
              <span className="eyebrow">
                <Layers3 size={13} /> {action.type === "district"
                  ? "VISTA DO BAIRRO"
                  : action.type === "follow"
                    ? `SEGUINDO ÔNIBUS ${action.vehicle?.id}`
                    : "VISÃO ESPACIAL"}
              </span>
              <h1>{site}</h1>
              <span>
                {demo
                  ? demoPose?.phase === "away" && action.type === "follow"
                    ? "Em rota fora da área 3D · aguardando retorno"
                    : "Cenário inspirado no Terminal Pirituba"
                  : (area?.source ?? "Perímetro verificado indisponível")}
              </span>
            </div>
            {noData && (
              <div className="mode-notice" role="status">
                {mode === "LIVE" ? <Radio size={22} /> : <History size={22} />}
                <strong>
                  {mode === "LIVE"
                    ? snapshot?.state === "no_observations"
                      ? "Sem ônibus observados na área"
                      : "LIVE indisponível"
                    : "REPLAY sem registros"}
                </strong>
                <span>
                  {mode === "LIVE"
                    ? snapshot?.state === "no_observations"
                      ? "Nenhuma leitura dentro do perímetro."
                      : "A conexão com " + provider.title + " está indisponível."
                    : "Nenhum histórico verificado foi carregado."}
                </span>
                <button onClick={() => chooseMode("DEMO")}>
                  Abrir demonstração <ChevronRight size={15} />
                </button>
              </div>
            )}
            {!failed3d && (
              <div className="camera" aria-label="Controles da câmera">
                <button
                  className="icon"
                  aria-label="Restaurar vista geral"
                  onClick={() => setAction({ type: "home" })}
                >
                  <Crosshair size={19} />
                </button>
                {demo && (
                  <button
                    className="icon"
                    aria-label="Vista do bairro"
                    aria-pressed={action.type === "district"}
                    title="Vista do bairro"
                    onClick={() => setAction({ type: "district" })}
                  >
                    <Building2 size={19} />
                  </button>
                )}
                <button
                  className="icon"
                  aria-label="Aproximar câmera"
                  onClick={() => setZoom({ factor: 1.22 })}
                >
                  <Plus size={19} />
                </button>
                <button
                  className="icon"
                  aria-label="Afastar câmera"
                  onClick={() => setZoom({ factor: 1 / 1.22 })}
                >
                  <Minus size={19} />
                </button>
              </div>
            )}
            <div className="viewport-footer">
              <span className="view-mode">3D</span>
              <span>
                {action.type === "follow"
                  ? "Arraste para girar · câmera vinculada ao ônibus"
                  : "Arraste para girar · botão direito para deslocar"}
              </span>
            </div>
          </div>
          <aside
            className="side"
            aria-label="Painel de revisão"
            hidden={!reviewing}
            ref={reviewRegion}
            tabIndex={-1}
          >
            <ShiftReview
              key={mode}
              mode={mode}
              vehicles={snapshot?.source === "rio_mobi_gtfs_rt" ? [] : vehicles}
              canFocusVehicle={ready && !failed3d}
              referenceAt={mode === "REPLAY" ? snapshot?.at : undefined}
              onFocusVehicle={focusReviewVehicle}
              onClose={closeReview}
            />
          </aside>
          <aside
            className="side"
            aria-label="Contexto do pátio"
            ref={contextRegion}
            hidden={reviewing}
          >
            {vehicle && (
              <VehicleInspector
                key={mode}
                vehicle={vehicle}
                mode={mode}
                site={site}
                area={area}
                replayAt={snapshot?.at}
                elapsed={operation.elapsed}
                stale={Boolean(mode === "LIVE" && vehicle.observation &&
                  (result?.failed || Date.now() - Date.parse(vehicle.observation.observedAt) > 90000))}
                following={action.type === "follow"}
                cameraDisabled={failed3d}
                onClose={() => {
                  setSelected(null);
                  if (action.type === "follow") setAction({ type: "home" });
                }}
                onCamera={(type) => {
                  if (type === "follow" && action.type === "follow") setAction({ type: "home" });
                  else setAction({ type, vehicle });
                }}
              />
            )}
            {demo && !vehicle && (
              <div className="map-card">
                <SiteMap />
                <div>
                  <MapPin size={15} />
                  <span>Planta ilustrativa</span>
                  <small>DEMO</small>
                </div>
              </div>
            )}
            {demo && (
              <OperationFeed
                elapsed={operation.elapsed}
                onFollow={failed3d ? undefined : (id) => {
                  const target = fleet.find((item) => item.id === id);
                  if (target) followVehicle(target);
                }}
              />
            )}
            <section className="info">
              <span className="eyebrow">
                {panel === "fleet" ? "VEÍCULOS DA CENA" : "VISÃO DO PÁTIO"}
              </span>
              <h2>
                {panel === "fleet"
                  ? demo
                    ? "Frota de demonstração"
                    : "Observações GPS"
                  : "Contexto operacional"}
              </h2>
              {demo || vehicles.length > 0 || snapshot?.range ? (
                <>
                  {panel === "overview" && (
                    <div className="overview">
                      <span className="soft-icon">
                        <BusFront size={20} />
                      </span>
                      <div>
                        <strong>{vehicles.length} veículos</strong>
                        <small>
                          {demo
                            ? "Frota do cenário DEMO"
                            : "Observações na área"}
                        </small>
                      </div>
                    </div>
                  )}
                  {(panel === "fleet" || failed3d || !demo) && (
                    <div className="vehicle-list" ref={fleetRegion}>
                      {vehicles.map((item) => (
                        <button
                          key={item.id}
                          aria-pressed={selected === item.id}
                          onClick={() => selectVehicle(item.id)}
                        >
                          <BusFront size={16} />
                          <strong>{item.id}</strong>
                          <small>{item.line}</small>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                  {mode === "REPLAY" && snapshot?.range && (
                    <label className="replay">
                      <span>
                        {snapshot.at
                          ? readingTime.format(new Date(snapshot.at))
                          : "Horário do registro"}
                      </span>
                      <input
                        type="range"
                        aria-label="Horário do replay"
                        min={Date.parse(snapshot.range[0])}
                        max={Date.parse(snapshot.range[1])}
                        step={1000}
                        value={
                          at
                            ? Date.parse(at)
                            : Date.parse(snapshot.at ?? snapshot.range[1])
                        }
                        onChange={(event) =>
                          setAt(
                            new Date(
                              Number(event.currentTarget.value),
                            ).toISOString(),
                          )
                        }
                      />
                    </label>
                  )}
                </>
              ) : (
                <p className="quiet">
                  Nenhuma observação disponível para este modo.
                </p>
              )}
            </section>
            <button
              className="shift-entry"
              aria-label="Revisar turno"
              onClick={() => setPanel("shift")}
            >
              <ClipboardCheck size={19} />
              <span>
                <strong>Revisar turno</strong>
                <small>Compare escala e registros de portaria</small>
              </span>
              <ChevronRight size={16} />
            </button>
            <div className="provenance">
              <Clock3 size={15} />
              <div>
                <strong>
                  {mode === "DEMO"
                    ? "Dados sintéticos"
                    : result?.failed ||
                        snapshot?.state === "stale" ||
                        snapshot?.state === "unavailable"
                      ? "Conexão indisponível ou leitura antiga"
                      : vehicles.length
                        ? provider.title
                        : "Sem observações"}
                </strong>
                <small>
                  {mode === "DEMO"
                    ? "Sem horário de GPS real"
                    : result?.transport === "websocket" && !result.failed
                      ? provider.title + " · canal WebSocket"
                      : provider.title + " · consulta HTTP"}
                </small>
              </div>
            </div>
          </aside>
        </section>
      </main>
      <footer className="bottom">
        <span>
          <i />
          {mode === "DEMO"
            ? "DEMO · Dados simulados"
            : mode === "LIVE"
              ? result?.failed ||
                snapshot?.state === "stale" ||
                snapshot?.state === "unavailable"
                ? "LIVE · Dados indisponíveis ou antigos"
                : snapshot?.state === "connected"
                  ? "LIVE · GPS observado"
                  : "LIVE · Sem observações"
              : snapshot?.range
                ? "REPLAY · Histórico verificado"
                : "REPLAY · Sem registros"}
        </span>
        <span>Visualização de mobilidade · {location.region}</span>
      </footer>
      {help && (
        <dialog open aria-labelledby="help-title" className="help-dialog">
          <button
            className="icon close"
            aria-label="Fechar ajuda"
            onClick={() => setHelp(false)}
          >
            <X size={20} />
          </button>
          <h2 id="help-title">Origem dos dados</h2>
          <p>
            <strong>DEMO</strong> simula manobras e passagens na portaria.{" "}
            <strong>LIVE</strong> exibe observações GPS da fonte identificada na tela.{" "}
            <strong>REPLAY</strong> exige histórico registrado e verificado.
          </p>
          <p>
            Use os botões da câmera, arraste o pátio ou escolha um veículo na
            lista.
          </p>
        </dialog>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
