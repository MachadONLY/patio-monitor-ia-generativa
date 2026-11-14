import { fleet, type Vehicle } from "./fleet";
import { APPROACH, APRON, TERMINAL_GATE, terminalBays } from "./terminal-layout";

export const DEMO_WARMUP_SECONDS = 101;
const FIRST_DEPARTURE = 50;
const HEADWAY = 19;
const RETURN_OFFSETS = [63, 60, 66, 62, 59, 65, 61, 64];
const SPEED = 3.5;
const RAMP_SECONDS = 2;
const VEHICLE_PERIOD = fleet.length * HEADWAY;

export type SimulationPhase = "parked" | "departing" | "away" | "arriving";
type Point = { x: number; z: number };
type Location = Point & { heading: number };
export type SimulationPose = Location & {
  phase: SimulationPhase;
  visible: boolean;
  bay?: string;
};
export type SimulationEvent = {
  id: string;
  vehicleId: string;
  at: number;
  kind: "departure" | "arrival";
};

type Segment = { length: number; sample: (distance: number) => Location };

function line(from: Point, to: Point): Segment {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  const heading = Math.atan2(dx, dz);
  return {
    length,
    sample(distance) {
      return { x: from.x + dx * distance / length, z: from.z + dz * distance / length, heading };
    },
  };
}

function bend(from: Point, corner: Point, to: Point) {
  const radius = APRON.turnRadius;
  const before = Math.hypot(corner.x - from.x, corner.z - from.z);
  const after = Math.hypot(to.x - corner.x, to.z - corner.z);
  const entry = { x: corner.x + (from.x - corner.x) * radius / before, z: corner.z + (from.z - corner.z) * radius / before };
  const exit = { x: corner.x + (to.x - corner.x) * radius / after, z: corner.z + (to.z - corner.z) * radius / after };
  const center = { x: entry.x + exit.x - corner.x, z: entry.z + exit.z - corner.z };
  const a = Math.atan2(entry.z - center.z, entry.x - center.x);
  const b = Math.atan2(exit.z - center.z, exit.x - center.x);
  const direction = Math.sign(Math.sin(b - a));
  const arc: Segment = {
    length: Math.PI * radius / 2,
    sample(distance) {
      const angle = a + direction * distance / radius;
      return {
        x: center.x + radius * Math.cos(angle),
        z: center.z + radius * Math.sin(angle),
        heading: Math.atan2(-direction * Math.sin(angle), direction * Math.cos(angle)),
      };
    },
  };
  return { entry, exit, arc };
}

function route(points: Point[]) {
  const bends = points.slice(1, -1).map((corner, index) => bend(points[index], corner, points[index + 2]));
  const pieces: Segment[] = [];
  let cursor = points[0];
  for (const { entry, exit, arc } of bends) {
    pieces.push(line(cursor, entry), arc);
    cursor = exit;
  }
  pieces.push(line(cursor, points[points.length - 1]));
  const length = pieces.reduce((total, piece) => total + piece.length, 0);
  function sample(distance: number) {
    let remaining = distance;
    for (const piece of pieces) {
      if (remaining <= piece.length) return piece.sample(Math.max(0, remaining));
      remaining -= piece.length;
    }
    const last = pieces[pieces.length - 1];
    return last.sample(last.length);
  }
  const steps = Math.ceil(length / 2);
  const samples = Array.from({ length: steps + 1 }, (_, index) => sample(length * index / steps));
  return { length, duration: length / SPEED + RAMP_SECONDS, sample, points: samples };
}

const streetBendDistance = TERMINAL_GATE.z - APPROACH.streetZ +
  APRON.turnRadius * (Math.PI / 2 - 2);
const routes = terminalBays.map((bay, index) => {
  const { inboundX, outboundX, streetZ, streetWest, streetEast } = APPROACH;
  const inboundStart = streetWest + index % 3 * 3.2;
  const outboundEnd = streetEast - index % 4 * 3.2;
  const departure = route([
    bay, { x: bay.x, z: APRON.south }, { x: outboundX, z: APRON.south },
    { x: outboundX, z: streetZ }, { x: outboundEnd, z: streetZ },
  ]);
  const arrival = route([
    { x: inboundStart, z: streetZ }, { x: inboundX, z: streetZ },
    { x: inboundX, z: APRON.north }, { x: bay.x, z: APRON.north }, bay,
  ]);
  const departureStreet = streetBendDistance + outboundEnd - outboundX;
  const arrivalStreet = streetBendDistance + inboundX - inboundStart;
  return {
    departure,
    arrival,
    departureLead: (departure.length - departureStreet) / SPEED + RAMP_SECONDS / 2,
    arrivalLead: arrivalStreet / SPEED + RAMP_SECONDS / 2,
  };
});
const maximumDepartureLead = Math.max(...routes.map((path) => path.departureLead));
const fleetIndex = new Map(fleet.map(({ id }, index) => [id, index]));

function distanceAt(seconds: number, path: ReturnType<typeof route>) {
  if (seconds < RAMP_SECONDS) return SPEED * seconds ** 2 / (2 * RAMP_SECONDS);
  const remaining = path.duration - seconds;
  if (remaining < RAMP_SECONDS) return path.length - SPEED * remaining ** 2 / (2 * RAMP_SECONDS);
  return SPEED * (seconds - RAMP_SECONDS / 2);
}

function validTime(seconds: number) {
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

function trip(index: number, round: number) {
  const dispatch = index + round * fleet.length;
  // The previous return slot becomes this trip's starting bay.
  const from = dispatch % terminalBays.length;
  const to = (dispatch + fleet.length) % terminalBays.length;
  const outgoing = routes[from];
  const incoming = routes[to];
  const departureGate = FIRST_DEPARTURE + dispatch * HEADWAY;
  const arrivalGate = departureGate + RETURN_OFFSETS[index];
  const leavesAt = departureGate - outgoing.departureLead;
  const entersAt = arrivalGate - incoming.arrivalLead;
  return { from, to, outgoing, incoming, departureGate, arrivalGate, leavesAt, entersAt };
}

function tripRound(index: number, time: number) {
  return Math.max(0, Math.floor((time - FIRST_DEPARTURE - index * HEADWAY + maximumDepartureLead) / VEHICLE_PERIOD));
}

export function sampleSimulation(vehicle: Pick<Vehicle, "id" | "x" | "z">, seconds: number): SimulationPose {
  const index = fleetIndex.get(vehicle.id);
  if (index === undefined) return { x: vehicle.x, z: vehicle.z, heading: 0, visible: true, phase: "parked" };

  const time = validTime(seconds);
  const { from, to, outgoing, incoming, leavesAt, entersAt } = trip(index, tripRound(index, time));
  if (time < leavesAt) return parkedAt(from);
  if (time < leavesAt + outgoing.departure.duration) {
    return { ...outgoing.departure.sample(distanceAt(time - leavesAt, outgoing.departure)), visible: true, phase: "departing" };
  }
  if (time < entersAt) {
    return { x: TERMINAL_GATE.x, z: APPROACH.streetZ, heading: 0, visible: false, phase: "away" };
  }
  if (time < entersAt + incoming.arrival.duration) {
    return { ...incoming.arrival.sample(distanceAt(time - entersAt, incoming.arrival)), visible: true, phase: "arriving" };
  }
  return parkedAt(to);
}

function parkedAt(index: number): SimulationPose {
  const { x, z, id } = terminalBays[index];
  return { x, z, heading: 0, visible: true, phase: "parked", bay: id };
}

export function simulationVehicleDetails(vehicle: Vehicle, seconds: number) {
  const index = fleetIndex.get(vehicle.id);
  if (index === undefined) return;
  const time = validTime(seconds);
  const round = tripRound(index, time);
  const current = trip(index, round);
  const pose = sampleSimulation(vehicle, time);
  const upcoming = pose.phase === "parked" && time >= current.leavesAt
    ? trip(index, round + 1)
    : current;
  const history = [];
  for (let r = Math.max(0, round - 2); r <= round; r++) {
    const event = trip(index, r);
    const bay = terminalBays[event.to].id;
    history.push(
      { at: event.departureGate, label: "Saída pela portaria" },
      { at: event.arrivalGate, label: "Entrada na portaria" },
      { at: event.entersAt + event.incoming.arrival.duration, label: `Estacionou na baia ${bay}`, bay },
    );
  }
  const recent = history.filter((event) => event.at <= time).reverse();
  return {
    pose,
    history: recent.slice(0, 6),
    lastEntry: recent.find((event) => event.label === "Entrada na portaria")?.at,
    parkedAt: pose.bay ? recent.find((event) => event.bay === pose.bay)?.at ?? 0 : undefined,
    nextDeparture: time <= current.departureGate ? current.departureGate : trip(index, round + 1).departureGate,
    destinationBay: terminalBays[current.to].id,
    departure: upcoming.outgoing.departure.points,
    arrival: current.incoming.arrival.points,
  };
}

export function simulationMovementsAt(seconds: number) {
  const time = validTime(seconds);
  const departures = Math.max(0, 1 + Math.floor((time - FIRST_DEPARTURE) / HEADWAY));
  const events: SimulationEvent[] = [];
  for (let n = Math.max(0, departures - 3); n < departures; n++) {
    events.push({
      id: `${n}-departure`,
      vehicleId: fleet[n % fleet.length].id,
      at: FIRST_DEPARTURE + n * HEADWAY,
      kind: "departure",
    });
  }

  let arrivals = 0;
  // The latest three returns always occur in a bus's current or recent rounds.
  for (const [index, { id }] of fleet.entries()) {
    const first = FIRST_DEPARTURE + index * HEADWAY + RETURN_OFFSETS[index];
    const count = Math.max(0, 1 + Math.floor((time - first) / VEHICLE_PERIOD));
    arrivals += count;
    for (let round = Math.max(0, count - 3); round < count; round++) {
      events.push({
        id: `${index + round * fleet.length}-arrival`,
        vehicleId: id,
        at: first + round * VEHICLE_PERIOD,
        kind: "arrival",
      });
    }
  }
  return { arrivals, departures, events: events.sort((a, b) => b.at - a.at).slice(0, 3) };
}
