import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

export const assessmentSteps = [
  { title: "Confira uma saída de garagem", body: "Cruze o que estava previsto na escala com o que a portaria registrou. O Pátio Monitor identifica atrasos, trocas de veículo e saídas sem registro.", action: "Abrir caso de exemplo" },
  { title: "Veja por que a saída foi sinalizada", body: "Os dois registros têm o mesmo ID de saída, mas prefixos diferentes. A conciliação identifica a troca automaticamente e exibe as duas evidências.", action: "Ir para a explicação" },
  { title: "Consulte a regra usada na revisão", body: "Clique em Explicar ocorrência. A IA consulta as regras da operação, indica o que conferir e cita a fonte. A conclusão fica com o operador.", action: "Ver gravação" },
  { title: "Vá à passagem no vídeo", body: "Clique no cruzamento detectado. O player pula para o instante, onde você pode conferir a direção e a passagem do ônibus na gravação de referência.", action: "Concluir teste" },
] as const;

type Rect = { x: number; y: number; width: number; height: number };
const focusable = "button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), video[controls], [tabindex='0']";

export function AssessmentTour({ step, target, onAdvance, onBack, onClose }: {
  step: number;
  target: RefObject<HTMLElement | null>;
  onAdvance: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect>();
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const card = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const item = assessmentSteps[step];

  useLayoutEffect(() => {
    const update = () => {
      const node = target.current;
      const bubble = card.current;
      if (!node || !bubble) return;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const bounds = node.getBoundingClientRect();
      const x = Math.max(5, bounds.x - 5);
      const y = Math.max(5, bounds.y - 5);
      const width = Math.min(viewportWidth - 5, bounds.right + 5) - x;
      const height = Math.min(viewportHeight - 5, bounds.bottom + 5) - y;
      const actual = { x, y, width, height };
      setRect((previous) => previous && Object.keys(actual).every((key) => {
        const name = key as keyof Rect;
        return Math.abs(previous[name] - actual[name]) < 0.5;
      }) ? previous : actual);
      const { width: cardWidth, height: cardHeight } = bubble.getBoundingClientRect();
      if (viewportWidth <= 720 && step > 0) {
        const stageMax = Math.max(92, viewportHeight - bounds.top - cardHeight - 36);
        node.style.setProperty("--feature-limit", `${stageMax}px`);
      } else {
        node.style.removeProperty("--feature-limit");
      }
      const gap = 14;
      const inset = 12;
      const clamp = (n: number, extent: number) => Math.max(inset, Math.min(n, extent - inset));
      const horizontal = clamp(x + width / 2 - cardWidth / 2, viewportWidth - cardWidth);
      const vertical = clamp(y + height / 2 - cardHeight / 2, viewportHeight - cardHeight);
      let next;
      if (viewportWidth > 720 && x - gap - cardWidth >= inset) next = { x: x - gap - cardWidth, y: vertical };
      else if (viewportWidth > 720 && x + width + gap + cardWidth <= viewportWidth - inset) next = { x: x + width + gap, y: vertical };
      else if (y + height + gap + cardHeight <= viewportHeight - inset) next = { x: horizontal, y: y + height + gap };
      else if (y - gap - cardHeight >= inset) next = { x: horizontal, y: y - gap - cardHeight };
      else next = { x: horizontal, y: Math.max(inset, viewportHeight - inset - cardHeight) };
      setPosition((last) => Math.abs(last.x - next.x) < 0.5 && Math.abs(last.y - next.y) < 0.5 ? last : next);
    };
    update();
    title.current?.focus({ preventScroll: true });
    if (step > 0) target.current?.scrollTo(0, 0);
    const observer = new ResizeObserver(update);
    if (target.current) observer.observe(target.current);
    if (card.current) observer.observe(card.current);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [step, target]);

  useLayoutEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const zone = [card.current, target.current];
      const controls = zone.flatMap((node) => node ? [...node.querySelectorAll<HTMLElement>(focusable)] : [])
        .filter((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
      if (!controls.length) return;
      event.preventDefault();
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index < 1 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
      controls[next].focus();
    }
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
  }, [onClose, target]);

  return (
    <div className="spotlight" aria-label="Teste guiado">
      {rect ? (
        <>
          <div className="spotlight-shade" style={{ inset: `0 0 auto 0`, height: rect.y }} />
          <div className="spotlight-shade" style={{ top: rect.y, height: rect.height, left: 0, width: rect.x }} />
          <div className="spotlight-shade" style={{ top: rect.y, height: rect.height, left: rect.x + rect.width, right: 0 }} />
          <div className="spotlight-shade" style={{ top: rect.y + rect.height, bottom: 0, left: 0, right: 0 }} />
          <div className="spotlight-ring" style={{ top: rect.y, left: rect.x, width: rect.width, height: rect.height }} />
        </>
      ) : <div className="spotlight-shade" style={{ inset: 0 }} />}
      <section ref={card} className="spotlight-callout" role="dialog" aria-labelledby="assessment-title"
        style={{ top: position.y, left: position.x }}>
        <header>
          <span>Teste guiado <span aria-hidden="true">·</span> {step + 1} de {assessmentSteps.length}</span>
          <button type="button" className="tour-close" aria-label="Fechar teste guiado" onClick={onClose}><X size={18} /></button>
        </header>
        <h2 id="assessment-title" tabIndex={-1} ref={title}>{item.title}</h2>
        <p>{item.body}</p>
        <footer>
          {step > 0
            ? <button type="button" className="operation-secondary" onClick={onBack}><ArrowLeft size={15} /> Voltar</button>
            : <button type="button" className="operation-secondary" onClick={onClose}>Pular</button>}
          <button type="button" className="operation-primary" onClick={onAdvance}>
            {item.action}{step === assessmentSteps.length - 1 ? <Check size={15} /> : <ArrowRight size={15} />}
          </button>
        </footer>
      </section>
    </div>
  );
}
