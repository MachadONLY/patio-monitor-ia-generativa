// Original DEMO layout in metres, inspired by the passenger islands of Terminal Pirituba.
export const TERMINAL_BOUNDS = { west: -54, east: 59, north: -37, south: 39 };
export const TERMINAL_GATE = { x: 50, z: TERMINAL_BOUNDS.north };
export const APPROACH = { inboundX: 46, outboundX: 54, streetZ: -76, streetWest: 24, streetEast: 86 };
export const APRON = { north: -27, south: 27, turnRadius: 9 };
export const BAY = { z: 0, width: 4.5, length: 15 };
export const terminalBays = [-37, -31, -23, -17, -9, -3, 5, 11, 19, 25].map(
  (x, index) => ({ x, z: BAY.z, id: String(index + 1).padStart(2, "0") }),
);
export const CITY_TRANSFORM = { x: 5, scaleX: 1.9, scaleZ: 1.6 };

export const WEST_STREET_X = -60.17;
export const TERMINAL_HALL = { west: -52, east: -42.2, north: -31, south: 23, walkwayWidth: 1.2 };
