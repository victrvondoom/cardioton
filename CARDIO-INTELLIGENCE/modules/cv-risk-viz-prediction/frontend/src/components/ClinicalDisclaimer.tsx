export default function ClinicalDisclaimer() {
  return (
    <div className="panel border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90 leading-relaxed">
      <strong className="text-amber-300">Clinical disclaimer:</strong> Research and educational
      decision-support prototype only. Predictions are not a medical diagnosis and do not replace
      formal clinical assessment or diagnostic imaging. A predicted 80% probability of LAD stenosis
      does <em>not</em> mean the LAD is physically 80% blocked; the 3D visualization is a schematic
      risk map, not patient-specific lesion localization.
    </div>
  )
}
