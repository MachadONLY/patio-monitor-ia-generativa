// Solar elevation and azimuth from fractional year and UTC time.
// Scene coordinates use east for +X and geographic south for +Z.
export function alvoradaSun(time: Date) {
  const latitude = -23.001922 * Math.PI / 180;
  const longitude = -43.366102;
  const hours = time.getUTCHours() + time.getUTCMinutes() / 60;
  const day = (Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate()) -
    Date.UTC(time.getUTCFullYear(), 0, 1)) / 86400000;
  const yearAngle = 2 * Math.PI / 365 * (day + (hours - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(yearAngle) - 0.032077 * Math.sin(yearAngle) -
    0.014615 * Math.cos(2 * yearAngle) - 0.040849 * Math.sin(2 * yearAngle));
  const declination = 0.006918 - 0.399912 * Math.cos(yearAngle) + 0.070257 * Math.sin(yearAngle) -
    0.006758 * Math.cos(2 * yearAngle) + 0.000907 * Math.sin(2 * yearAngle) -
    0.002697 * Math.cos(3 * yearAngle) + 0.00148 * Math.sin(3 * yearAngle);
  const angle = (hours * 15 + longitude + equation / 4 - 180) * Math.PI / 180;
  return [
    -Math.cos(declination) * Math.sin(angle),
    Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(angle),
    -Math.cos(latitude) * Math.sin(declination) + Math.sin(latitude) * Math.cos(declination) * Math.cos(angle),
  ] as const;
}
