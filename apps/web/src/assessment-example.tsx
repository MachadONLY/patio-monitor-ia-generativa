import { ExplainOccurrence } from "./gs-evidence";
import { demoShift } from "./shift-demo";
import { ShiftEvidence, StatusBadge } from "./shift-review";

const example = demoShift.find(({ reason }) => reason === "vehicle_swap");

export function AssessmentExample({ explain }: { explain: boolean }) {
  if (!example) return <p role="status">O caso de exemplo está indisponível.</p>;
  return (
    <section className="tour-feature" aria-label="Conferência do caso de exemplo">
      <header className="tour-feature-heading">
        <div><p>Caso de exemplo</p><h2>Saída {example.trip.tripId}</h2></div>
        <StatusBadge status={example.status} />
      </header>
      <ShiftEvidence item={example} />
      {explain && <ExplainOccurrence item={example} demo scrollIntoView />}
    </section>
  );
}
