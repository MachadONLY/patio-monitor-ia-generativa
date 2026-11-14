type Point = { x: number; z: number };

export type GpsPosition = { x: number; z: number; time: number };
export type VisualPose = { x: number; z: number; heading: number };

export type ObservedMotion = {
  reading: GpsPosition;
  from: VisualPose;
  to: VisualPose;
  startsAt: number;
  duration: number;
  path?: { points: Point[]; lengths: number[]; total: number };
};

function shortestAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function pathHeading(path: NonNullable<ObservedMotion["path"]>, index: number, progress: number) {
  const { points, lengths } = path;
  const a = points[index];
  const b = points[index + 1];
  const angle = Math.atan2(b.x - a.x, b.z - a.z);
  const before = points[index - 1];
  const after = points[index + 2];
  const easing = (phase: number) => Math.max(0, Math.min(1, phase));
  if (progress < 0.5 && before && lengths[index - 1] > 0) {
    const previous = Math.atan2(a.x - before.x, a.z - before.z);
    return angle + shortestAngle(angle, previous) * (1 - easing(progress * lengths[index] / 5)) * 0.5;
  }
  if (progress >= 0.5 && after && lengths[index + 1] > 0) {
    const next = Math.atan2(after.x - b.x, after.z - b.z);
    return angle + shortestAngle(angle, next) * (1 - easing((1 - progress) * lengths[index] / 5)) * 0.5;
  }
  return angle;
}

export function sampleObservedMotion(motion: ObservedMotion, now: number): VisualPose {
  if (motion.duration === 0 || now >= motion.startsAt + motion.duration) return motion.to;
  const progress = Math.max(0, (now - motion.startsAt) / motion.duration);
  if (motion.path) {
    const { points, lengths, total } = motion.path;
    let remaining = progress * total;
    for (let index = 0; index < lengths.length; index++) {
      if (remaining <= lengths[index] && lengths[index] > 0) {
        const a = points[index];
        const b = points[index + 1];
        const fraction = remaining / lengths[index];
        return { x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction,
          heading: pathHeading(motion.path, index, fraction) };
      }
      remaining -= lengths[index];
    }
  }
  const turn = shortestAngle(motion.from.heading, motion.to.heading);
  return {
    x: motion.from.x + (motion.to.x - motion.from.x) * progress,
    z: motion.from.z + (motion.to.z - motion.from.z) * progress,
    heading: motion.from.heading + turn * Math.min(1, progress * 2),
  };
}

export function updateObservedMotion(
  motion: ObservedMotion | undefined,
  reading: GpsPosition,
  now: number,
  mappedPath?: (from: Point, to: Point) => Point[] | undefined,
): ObservedMotion | undefined {
  if (![reading.x, reading.z, reading.time].every(Number.isFinite)) return motion;
  if (motion && reading.time <= motion.reading.time) return motion;

  const from = motion ? sampleObservedMotion(motion, now) : { ...reading, heading: 0 };
  const dx = motion ? reading.x - motion.reading.x : 0;
  const dz = motion ? reading.z - motion.reading.z : 0;
  const distance = Math.hypot(dx, dz);
  const seconds = motion ? (reading.time - motion.reading.time) / 1000 : 0;
  const onContinuousTrack = seconds > 0 && seconds <= 60 && distance <= 220 && distance / seconds <= 33;
  const ready = onContinuousTrack && distance >= 2;
  const points = ready && motion && Math.hypot(from.x - motion.to.x, from.z - motion.to.z) < 2
    ? mappedPath?.(from, reading)
    : undefined;
  const lengths = points?.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.z - points[index].z));
  const path = points && lengths ? { points, lengths, total: lengths.reduce((sum, length) => sum + length, 0) } : undefined;
  const before = points?.at(-2);
  const heading = before ? Math.atan2(reading.x - before.x, reading.z - before.z) : onContinuousTrack && distance >= 2 ? Math.atan2(dx, dz) : motion?.to.heading ?? 0;
  return {
    reading,
    from: motion && !motion.duration && motion.startsAt === 0 ? { ...from, heading } : from,
    to: { x: reading.x, z: reading.z, heading },
    startsAt: motion ? now : 0,
    path,
    duration: ready ? Math.max(650, Math.min(12_000, seconds * 820, distance * 155)) : 0,
  };
}
