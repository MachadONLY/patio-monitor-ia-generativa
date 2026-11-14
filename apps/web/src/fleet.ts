import { terminalBays } from "./terminal-layout";
import type { Observation } from "./observations";

export type Vehicle = {
  id: string;
  line: string;
  demoDestination?: string;
  bay?: string;
  x: number;
  z: number;
  paint: string;
  status?: "No pátio" | "Em saída";
  observation?: Observation;
};

export const fleet: Vehicle[] = [
  {
    id: "8 1029",
    line: "3301-10",
    demoDestination: "Praça do Mercado",
    bay: terminalBays[0].id,
    x: terminalBays[0].x,
    z: terminalBays[0].z,
    paint: "#19639f",
    status: "No pátio",
  },
  {
    id: "7 9154",
    line: "312N-10",
    demoDestination: "Jardim das Oficinas",
    bay: terminalBays[1].id,
    x: terminalBays[1].x,
    z: terminalBays[1].z,
    paint: "#bd463f",
    status: "No pátio",
  },
  {
    id: "8 1776",
    line: "4310-10",
    demoDestination: "Vila dos Ipês",
    bay: terminalBays[2].id,
    x: terminalBays[2].x,
    z: terminalBays[2].z,
    paint: "#19639f",
    status: "No pátio",
  },
  {
    id: "8 2361",
    line: "4103-10",
    demoDestination: "Avenida do Bairro",
    bay: terminalBays[3].id,
    x: terminalBays[3].x,
    z: terminalBays[3].z,
    paint: "#138455",
    status: "Em saída",
  },
  {
    id: "7 8042",
    line: "407P-10",
    demoDestination: "Parque do Mirante",
    bay: terminalBays[4].id,
    x: terminalBays[4].x,
    z: terminalBays[4].z,
    paint: "#bd463f",
    status: "No pátio",
  },
  {
    id: "8 4102",
    line: "373T-10",
    demoDestination: "Vila da Estação",
    bay: terminalBays[5].id,
    x: terminalBays[5].x,
    z: terminalBays[5].z,
    paint: "#19639f",
    status: "No pátio",
  },
  {
    id: "8 3132",
    line: "3766-10",
    demoDestination: "Praça das Palmeiras",
    bay: terminalBays[6].id,
    x: terminalBays[6].x,
    z: terminalBays[6].z,
    paint: "#19639f",
    status: "No pátio",
  },
  {
    id: "7 5538",
    line: "4025-10",
    demoDestination: "Jardim do Lago",
    bay: terminalBays[7].id,
    x: terminalBays[7].x,
    z: terminalBays[7].z,
    paint: "#bd463f",
    status: "No pátio",
  },
];
