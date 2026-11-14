import { ArrowLeft, ArrowRight, BusFront, Camera, Check, ClipboardCheck, FileSearch, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { ExplainOccurrence, GateEvidence } from "./gs-evidence";
import { demoShift } from "./shift-demo";
import "./operation-design.css";

const steps = [
  { label: "Escala e portaria", icon: ClipboardCheck },
  { label: "Explicação com IA", icon: FileSearch },
  { label: "Passagem em vídeo", icon: Camera },
] as const;

const sample = demoShift.find((item) => item.reason === "vehicle_swap" && item.gate);
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function AssessmentTour({ onClose, fallbackFocus }: { onClose: () => void; fallbackFocus: RefObject<HTMLButtonElement | null> }) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const Icon = steps[step].icon;

  useEffect(() => {
    const modal = dialog.current;
    const trigger = document.activeElement;
    modal?.showModal();
    return () => {
      modal?.close();
      if (trigger instanceof HTMLElement && trigger !== document.body && trigger.isConnected) trigger.focus();
      else fallbackFocus.current?.focus();
    };
  }, [fallbackFocus]);
  useEffect(() => {
    content.current?.scrollTo(0, 0);
    heading.current?.focus();
  }, [step]);

  return (
    <dialog className="assessment-tour" ref={dialog} aria-labelledby="assessment-title" onCancel={(event) => {
      event.preventDefault();
      onClose();
    }}>
      <header className="assessment-header">
        <strong><BusFront size={18} aria-hidden="true" /> Teste guiado</strong>
        <button type="button" className="tour-close" aria-label="Fechar teste guiado" onClick={onClose}><X size={20} /></button>
      </header>
      <ol className="assessment-progress" aria-label="Etapas do teste guiado">
        {steps.map(({ label }, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined} data-complete={index < step}>
            <span aria-hidden="true">{index < step ? <Check size={14} /> : index + 1}</span>{label}
          </li>
        ))}
      </ol>
      <div className="assessment-content" ref={content}>
        <div className="assessment-step-heading">
          <span className="assessment-symbol"><Icon size={23} strokeWidth={1.8} aria-hidden="true" /></span>
          <h2 id="assessment-title" ref={heading} tabIndex={-1}>
            {step === 0 ? "Encontre a divergência" : step === 1 ? "Descubra o que verificar" : "Confira uma passagem no vídeo"}
          </h2>
          <p>{step === 0
            ? "A equipe de operação cruza a escala com o que a portaria registrou. Neste exemplo, houve uma troca de veículo."
            : step === 1
              ? "Clique em Explicar ocorrência. O assistente consulta as regras da operação e indica o que conferir, com a fonte."
              : "Selecione um cruzamento detectado para ir direto ao ponto da passagem na gravação anotada."}</p>
        </div>
        {step < 2 && sample?.gate && (
          <div className="assessment-case">
            <div className="assessment-case-label"><strong>Saída {sample.trip.tripId}</strong><span>Caso de exemplo</span></div>
            <dl>
              <div><dt>Previsto na escala</dt><dd>{sample.trip.vehicleId}<small>{time.format(new Date(sample.trip.plannedAt))}</small></dd></div>
              <div><dt>Registrado na portaria</dt><dd>{sample.gate.vehicleId}<small>{time.format(new Date(sample.gate.observedAt))}</small></dd></div>
            </dl>
            {step === 1 && <ExplainOccurrence item={sample} demo />}
          </div>
        )}
        {step === 2 && <GateEvidence />}
      </div>
      <footer className="assessment-footer">
        {step > 0 ? (
          <button type="button" className="operation-secondary" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Voltar</button>
        ) : (
          <button type="button" className="operation-secondary" onClick={onClose}>Explorar por conta própria</button>
        )}
        <button type="button" className="operation-primary" onClick={step === 2 ? onClose : () => setStep(step + 1)}>
          {step === 0 ? "Ir para a explicação" : step === 1 ? "Ver gravação" : "Concluir teste"}
          {step === 2 ? <Check size={16} /> : <ArrowRight size={16} />}
        </button>
      </footer>
    </dialog>
  );
}
