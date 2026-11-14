import { expect, test } from "@playwright/test";
import { fleet } from "../src/fleet";
import { sampleSimulation, simulationMovementsAt, type SimulationPose } from "../src/simulation";
import { APPROACH, TERMINAL_GATE, TERMINAL_HALL, terminalBays } from "../src/terminal-layout";

test("all eight buses run recurring trips and use different bays", () => {
  for (const bus of fleet) {
    const phases = new Set<string>();
    const bays = new Set<string>();
    for (let second = 0; second < 900; second++) {
      const pose = sampleSimulation(bus, second);
      phases.add(pose.phase);
      if (pose.bay) bays.add(pose.bay);
    }
    expect(phases).toEqual(new Set(["parked", "departing", "away", "arriving"]));
    expect(bays.size).toBe(5);
  }

  for (const time of [86_400, 86_500, 604_800]) {
    const { arrivals, departures, events } = simulationMovementsAt(time);
    expect(arrivals).toBeGreaterThan(4_500);
    expect(departures - arrivals).toBeLessThanOrEqual(4);
    expect(events).toHaveLength(3);
  }
});

test("each entry and exit is recorded at the matching gate crossing", () => {
  expect(simulationMovementsAt(0)).toEqual({ arrivals: 0, departures: 0, events: [] });
  for (const time of [50, 69, 107, 113, 129, 886, 889, 86394]) {
    const movement = simulationMovementsAt(time);
    const event = movement.events[0];
    const bus = fleet.find(({ id }) => id === event.vehicleId)!;
    const at = sampleSimulation(bus, event.at);
    const before = sampleSimulation(bus, event.at - 0.01);
    expect(event.at).toBe(time);
    expect(at.z).toBeCloseTo(TERMINAL_GATE.z);
    if (event.kind === "arrival") {
      expect(at.x).toBe(APPROACH.inboundX);
      expect(before.z).toBeLessThan(at.z);
    } else {
      expect(at.x).toBe(APPROACH.outboundX);
      expect(before.z).toBeGreaterThan(at.z);
    }
  }
});

test("visible buses move continuously, occupy distinct bays and clear each other", () => {
  const halfWidth = 1.681;
  const halfLength = 6.1061;
  const axes = ({ heading }: SimulationPose) => [
    [Math.cos(heading), -Math.sin(heading)],
    [Math.sin(heading), Math.cos(heading)],
  ];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];
  const spread = (axis: number[], [side, front]: number[][]) =>
    halfWidth * Math.abs(dot(axis, side)) + halfLength * Math.abs(dot(axis, front));
  let minimumClearance = Infinity;
  let hallClearance = Infinity;
  let largestStep = 0;
  let prior = fleet.map((bus) => sampleSimulation(bus, 0));
  const bayIds = new Set(terminalBays.map(({ id }) => id));
  // Covers the initial dispatches and the complete 40-dispatch rotation.
  for (let tick = 1; tick <= 9500; tick++) {
    const poses = fleet.map((bus) => sampleSimulation(bus, tick / 10));
    const parked = poses.filter((pose) => pose.bay).map((pose) => pose.bay!);
    if (new Set(parked).size !== parked.length || parked.some((bay) => !bayIds.has(bay))) {
      throw new Error(`Invalid bay occupancy at ${tick / 10}s`);
    }
    for (const [index, pose] of poses.entries()) {
      if (!pose.visible) continue;
      const previous = prior[index];
      if (previous.visible) largestStep = Math.max(largestStep, Math.hypot(pose.x - previous.x, pose.z - previous.z));
      const a = axes(pose);
      if (pose.z >= TERMINAL_HALL.north - halfLength && pose.z <= TERMINAL_HALL.south + halfLength) {
        hallClearance = Math.min(hallClearance, pose.x - spread([1, 0], a) - (TERMINAL_HALL.east + TERMINAL_HALL.walkwayWidth));
      }
      for (const other of poses.slice(index + 1)) {
        if (!other.visible) continue;
        const b = axes(other);
        const delta = [other.x - pose.x, other.z - pose.z];
        const clearance = Math.max(...[...a, ...b].map((axis) => Math.abs(dot(delta, axis)) - spread(axis, a) - spread(axis, b)));
        minimumClearance = Math.min(minimumClearance, clearance);
      }
    }
    prior = poses;
  }
  expect(largestStep).toBeLessThan(0.36);
  expect(minimumClearance).toBeGreaterThan(1);
  expect(hallClearance).toBeGreaterThan(0.5);
});
