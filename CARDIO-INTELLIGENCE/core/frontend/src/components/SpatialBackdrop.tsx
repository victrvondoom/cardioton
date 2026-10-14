/** CSS geometry only: depth never requires WebGL or a network request. */
export function SpatialBackdrop() {
  return <div className="spatial-backdrop" aria-hidden="true">
    <div className="spatial-backdrop__horizon" />
    <div className="spatial-backdrop__floor" />
    <div className="spatial-backdrop__orb spatial-backdrop__orb--near" />
    <div className="spatial-backdrop__orb spatial-backdrop__orb--far" />
  </div>;
}
