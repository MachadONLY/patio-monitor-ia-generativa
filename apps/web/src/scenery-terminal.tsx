import { useMemo } from "react";
import { Batch, Sign, part, type Part, type XYZ } from "./scenery-kit";
import { TERMINAL_HALL, WEST_STREET_X } from "./terminal-layout";

const concrete = "#d2d0c4";
const steel = "#516b68";
const cream = "#dfddd0";
const green = "#234e43";
const amber = "#d5a74a";
const facade = TERMINAL_HALL.east;
const rear = TERMINAL_HALL.west;
const hallX = (facade + rear) / 2;
const garageStart = 5;
const garageFront = TERMINAL_HALL.south;
const passengerEntrance = -13;

function makeTerminal() {
  const shell: Part[] = [];
  const details: Part[] = [];
  const lights: Part[] = [];
  const add = (at: XYZ, size: XYZ, color: string) => shell.push(part(at, size, color));
  const trim = (at: XYZ, size: XYZ, color: string) => details.push(part(at, size, color));
  const light = (at: XYZ, size: XYZ) => lights.push(part(at, size, "#fce8b4"));
  const { north } = TERMINAL_HALL;
  const depth = facade - rear;
  const hallZ = (garageStart + north) / 2;

  // The concourse bridges the street sidewalk and the sheltered platform walk.
  add([hallX, 0.04, hallZ], [depth, 0.24, garageStart - north], cream);
  const walkway = TERMINAL_HALL.walkwayWidth;
  add([facade + (walkway - 1.75) / 2, 0.045, hallZ], [1.75 + walkway, 0.17, garageStart - north], concrete);
  add([rear - 0.65, 0.045, hallZ], [1.3, 0.17, garageStart - north], concrete);
  add([hallX, 2.85, north + 0.16], [depth, 5.4, 0.32], concrete);
  add([hallX, 2.85, garageStart], [depth, 5.4, 0.26], concrete);
  for (const [start, end] of [[north, passengerEntrance - 1.8], [passengerEntrance + 1.8, garageStart]]) {
    add([rear + 0.15, 2.85, (start + end) / 2], [0.30, 5.4, end - start], concrete);
  }
  add([hallX + 0.43, 5.88, hallZ], [depth + 2.4, 0.33, 37.1], "#dde0d7");
  add([facade + 1.55, 5.46, hallZ], [0.26, 0.64, 37.1], "#c1c8bb");
  add([facade + 1.7, 5.47, -23.9], [0.12, 0.70, 10.6], cream);
  add([facade + 1.72, 5.49, passengerEntrance], [0.14, 0.54, 4.4], green);
  trim([facade + 1.692, 5.16, -23.9], [0.02, 0.046, 10.55], green);

  for (const z of [-30.6, -26.5, -22.3, -18.1, -15.2, -10.8, -6.4, -2.1, 2.3, 4.8]) {
    add([facade + 0.6, 2.84, z], [0.26, 5.44, 0.26], "#b7b8ab");
    trim([facade + 0.62, 0.25, z], [0.34, 0.25, 0.34], "#7e8781");
    light([facade + 0.84, 5.66, z], [0.14, 0.05, 1.0]);
  }
  for (const [start, end] of [[-30.7, -15], [-11, 4.8]]) {
    for (const y of [0.36, 2.46, 3.58]) {
      trim([facade - 0.06, y, (start + end) / 2], [0.09, 0.07, end - start], steel);
    }
    for (let z = start; z <= end; z += 1.05) {
      trim([facade - 0.05, 1.96, z], [0.08, 3.3, 0.057], steel);
    }
  }
  trim([facade + walkway - 0.15, 0.139, hallZ], [0.22, 0.017, 35.5], amber);
  for (let z = -30.5; z < 5; z += 1.3) {
    trim([facade + 0.12, 0.136, z], [2.10, 0.013, 0.027], "#a4ada1");
  }
  // West crossing lines up with the through-entrance, independent of the garage.
  for (let x = WEST_STREET_X - 5.2; x <= WEST_STREET_X + 5.3; x += 0.84) {
    trim([x, 0.017, passengerEntrance], [0.43, 0.02, 3.5], "#f2f0e4");
  }

  // Ticket booths sit below a lit fascia, with public counters facing the apron.
  add([facade - 3.9, 1.56, -24.7], [2.6, 2.8, 10.7], "#bcc8bd");
  add([facade - 2.54, 2.59, -24.7], [0.12, 0.54, 10.65], green);
  for (const z of [-27.85, -24.7, -21.55]) {
    add([facade - 2.57, 1.79, z], [0.13, 0.85, 2.78], "#405e62");
    trim([facade - 2.52, 1.28, z], [0.48, 0.11, 2.91], "#a48258");
    light([facade - 2.45, 2.19, z], [0.07, 0.08, 2.2]);
  }
  for (const z of [-8.9, -5.7, -2.5, 0.7, 3.4]) {
    const x = facade - 2.5;
    add([x, 0.63, z], [0.56, 0.11, 1.97], "#a88258");
    add([x - 0.24, 0.84, z], [0.10, 0.36, 1.97], "#a88258");
    for (const dz of [-0.67, 0.67]) trim([x, 0.39, z + dz], [0.39, 0.38, 0.11], steel);
  }
  for (const z of [-25, -19, -9, -3, 2]) {
    light([facade - 1.7, 5.65, z], [1.04, 0.05, 0.17]);
  }
  for (const x of [-49, -46.25]) {
    for (const z of [-28, -23.7, -19.4, -15.1]) {
      trim([x, 6.14, z], [2.28, 0.10, 3.64], "#6d8290");
      for (const dz of [-1, 0, 1]) trim([x, 6.197, z + dz], [2.21, 0.014, 0.022], "#b1bdbe");
    }
  }

  // Two service bays extend 18 m behind the south-facing openings.
  add([hallX, 0.05, 14], [depth, 0.19, 18], "#a4a8a0");
  add([hallX, 6.06, 14], [depth + 0.4, 0.36, 18.4], concrete);
  for (const x of [rear + 0.14, hallX, facade - 0.14]) {
    add([x, 2.91, 14], [0.29, 5.65, 18], "#b3b9ac");
    add([x, 2.50, garageFront], [0.36, 4.8, 0.51], concrete);
    for (const y of [0.38, 0.68, 0.98]) trim([x, y, garageFront + 0.267], [0.37, 0.14, 0.019], amber);
  }
  add([hallX, 5.27, garageFront], [depth, 0.94, 0.44], cream);
  for (const z of [8.1, 12.1, 16.1, 20.1]) {
    trim([facade + 0.025, 4.54, z], [0.06, 0.76, 2.93], steel);
    trim([facade + 0.063, 4.55, z], [0.026, 0.59, 2.76], "#80999a");
    trim([facade + 0.078, 4.55, z], [0.020, 0.62, 0.06], steel);
  }
  for (const x of [hallX - 2.45, hallX + 2.45]) {
    add([x, 3.52, 5.23], [4.55, 4.18, 0.16], "#55655d");
    for (const z of [10.3, 16.1, 21.1]) light([x, 5.81, z], [1.36, 0.08, 0.15]);
    trim([x, 0.014, 26.7], [0.11, 0.016, 5.1], "#f1e8d2");
    trim([x + 1.71, 0.37, 20.8], [0.66, 0.55, 1.28], "#926253");
  }
  add([(WEST_STREET_X + 3.8 + facade) / 2, -0.025, 30.1], [facade - WEST_STREET_X - 3.8, 0.039, 9.7], "#777d79");
  for (const z of [26.5, 33.4]) trim([-52.8, 0.015, z], [6.7, 0.016, 0.09], "#f1e8d2");
  return { shell, details, lights };
}

export function TerminalHall() {
  const { shell, details, lights } = useMemo(makeTerminal, []);
  return (
    <group name="Terminal de passageiros">
      <Batch parts={shell} cast />
      <Batch parts={details} roughness={0.72} />
      <Batch parts={lights} receive={false} emissive="#ffe3a5" emissiveIntensity={0.7} />
      {([[-30.65, -15], [-11, 4.8]] as const).map(([start, end]) => (
        <mesh key={start} position={[facade - 0.078, 1.98, (start + end) / 2]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[end - start, 3.22]} />
          <meshStandardMaterial color="#83a8ad" transparent opacity={0.27} depthWrite={false} />
        </mesh>
      ))}
      <Sign text="TERMINAL PÁTIO LESTE" at={[facade + 1.765, 5.47, -23.9]} rotationY={Math.PI / 2} width={10.25} height={0.58} color={green} />
      <Sign text="ACESSO DE PASSAGEIROS" at={[facade + 1.795, 5.49, passengerEntrance]} rotationY={Math.PI / 2} width={4.21} height={0.53} />
      <Sign text="BILHETERIA" at={[facade - 2.468, 2.59, -24.7]} rotationY={Math.PI / 2} width={6.3} height={0.57} />
      <Sign text="GARAGEM  ·  SERVIÇO" at={[hallX, 5.28, garageFront + 0.224]} width={8.8} height={0.85} color={green} />
    </group>
  );
}
