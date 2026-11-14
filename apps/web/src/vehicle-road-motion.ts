import { sampleObservedMotion, updateObservedMotion, type GpsPosition, type ObservedMotion } from "./observed-motion";
import type { VehicleRoadPose } from "./alvorada-road-path";

export type RoadNetwork = {
  match: (point: GpsPosition, heading?: number) => VehicleRoadPose | undefined;
  path: (from: VehicleRoadPose, to: VehicleRoadPose) => VehicleRoadPose[] | undefined;
  covers: (pose: VehicleRoadPose) => boolean;
};

export type RoadMotion = { time: number; position?: VehicleRoadPose; motion?: ObservedMotion };

export function updateRoadMotion(network: RoadNetwork, previous: RoadMotion | undefined, reading: GpsPosition, now: number): RoadMotion {
  if (previous && previous.time >= reading.time) return previous;
  const position = network.match(reading, previous?.position?.heading);
  if (!position) return { time: reading.time };
  if (previous?.motion && previous.position) {
    const from = sampleObservedMotion(previous.motion, now);
    // Require a joined on-road route. A GPS jump never creates a shortcut.
    if (Math.hypot(previous.position.x - from.x, previous.position.z - from.z) < 0.035) {
      const path = network.path(previous.position, position);
      if (path?.length) {
        const candidate = updateObservedMotion(previous.motion, { ...position, time: reading.time }, now, () => path);
        if (candidate?.path) {
          const steps = Math.ceil(candidate.path.total / 0.65);
          let allowed = true;
          for (let i = 0; i <= steps && allowed; i++) {
            allowed = network.covers(sampleObservedMotion(candidate, now + candidate.duration * i / steps));
          }
          if (allowed) return { time: reading.time, position: { ...position, heading: candidate.to.heading }, motion: candidate };
        }
      }
    }
  }
  const motion = updateObservedMotion(undefined, { ...position, time: reading.time }, now);
  if (motion) {
    motion.to.heading = position.heading;
    motion.from.heading = position.heading;
  }
  return { time: reading.time, position, motion };
}
