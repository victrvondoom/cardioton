"""Integration matrix for the vendored SlicerHeart modules.

Every classification below was made by inspecting the actual upstream code
(imports, entry points, resources), not from the project name. The two
classifications that matter at runtime:

* ``fastapi_python`` — runs inside the CardioTon backend process today.
* ``slicer_runtime`` — requires a 3D Slicer runtime (slicer/vtk/qt/ctk imports
  or C++ loadable modules); reachable only through the bridge, which reports
  honest unavailability until that runtime is configured.

``status`` records what is actually wired into CardioTon at the moment.
"""

from __future__ import annotations

from typing import Any, Literal

Classification = Literal[
    "reuse_directly",
    "adapt",
    "bridge",
    "convert",
    "reference_only",
    "exclude",
]
Runtime = Literal["fastapi_python", "slicer_runtime", "static_assets", "slicer_cpp_build"]
Status = Literal["wired", "available_via_bridge", "documented_only", "not_integrated"]

SPEED: dict[Runtime, str] = {
    "fastapi_python": "Runs in the CardioTon backend process.",
    "slicer_runtime": "Requires a 3D Slicer runtime; exposed through the bridge job contract only.",
    "static_assets": "Static resources; convertible or reference material.",
    "slicer_cpp_build": "Requires the SlicerHeart C++ SuperBuild toolchain (ITK/VTK).",
}


def _entry(
    module: str,
    capability: str,
    classification: Classification,
    runtime: Runtime,
    status: Status,
    cardiotwin_touchpoints: list[str],
    notes: str,
) -> dict[str, Any]:
    return {
        "module": module,
        "upstream_capability": capability,
        "classification": classification,
        "classification_speed": SPEED[runtime],
        "runtime": runtime,
        "status": status,
        "cardiotwin_touchpoints": cardiotwin_touchpoints,
        "notes": notes,
    }


def _not_importable(note: str) -> str:
    return f"{note} Imports slicer/vtk/qt, so it cannot run inside the FastAPI process."


def integration_matrix() -> list[dict[str, Any]]:
    """Complete classification of the vendored SlicerHeart modules."""
    return [
        _entry(
            "ValveBatchExport/HeartValveBatchAnalysis",
            "Population-wise annulus shape statistics from exported contour CSVs "
            "(ordering, resampling, size normalization, rigid alignment, mean shape).",
            "adapt",
            "fastapi_python",
            "wired",
            ["research/annulus-shape API", "research dashboards"],
            "Pure numpy/csv core ported to integrations/slicerheart/annulus_shape.py with attribution. "
            "vtkProcrustesAlignmentFilter replaced by an equivalent numpy rigid (Kabsch) alignment; "
            "Slicer scene/model visual outputs omitted.",
        ),
        _entry(
            "ValveQuantification (ValveQuantificationLib)",
            "Automatic heart valve annulus, leaflet and papillary metrics "
            "(mitral, tricuspid, aortic/cAVC, LVAD inflow valve presets).",
            "reference_only",
            "slicer_runtime",
            "available_via_bridge",
            ["anatomy terminology for agents", "valve-metric definitions API"],
            _not_importable(
                "Metric vocabulary and definitions are exposed as reference data; actual "
                "computation on imaging data only happens in a 3D Slicer runtime via the bridge."
            ),
        ),
        _entry(
            "ValveAnnulusAnalysis (HeartValveLib)",
            "Valve modelling library: annulus contours, leaflets, papillary models, "
            "probe-position presets with RAS transforms.",
            "adapt",
            "slicer_runtime",
            "available_via_bridge",
            ["valve-metric definitions API (Constants.py probe presets)"],
            _not_importable(
                "Constants.py is pure reference data and is served through the valve-metrics "
                "API; the modelling classes need a Slicer runtime."
            ),
        ),
        _entry(
            "ValveSegmentation",
            "Volumetric segmentation of heart valves.",
            "bridge",
            "slicer_runtime",
            "available_via_bridge",
            ["bridge job catalogue"],
            _not_importable("Segmentation executes on medical image volumes inside Slicer."),
        ),
        _entry(
            "LeafletAnalysis",
            "Valve leaflet surface models from segmented valve volumes.",
            "bridge",
            "slicer_runtime",
            "available_via_bridge",
            ["bridge job catalogue"],
            _not_importable(""),
        ),
        _entry(
            "ValvePapillaryAnalysis",
            "Papillary muscles and chordae angles/lengths.",
            "bridge",
            "slicer_runtime",
            "available_via_bridge",
            ["bridge job catalogue"],
            _not_importable(""),
        ),
        _entry(
            "OrificeArea",
            "Cross-sectional area of openings (e.g. regurgitant orifice area).",
            "bridge",
            "slicer_runtime",
            "available_via_bridge",
            ["bridge job catalogue"],
            _not_importable(""),
        ),
        _entry(
            "PDAQuantification",
            "Patent ductus arteriosus quantification.",
            "bridge",
            "slicer_runtime",
            "available_via_bridge",
            ["bridge job catalogue"],
            _not_importable(""),
        ),
        _entry(
            "AnnulusShapeAnalyzer",
            "Population-wise observation UI on dynamic annular shape.",
            "reference_only",
            "slicer_runtime",
            "documented_only",
            ["research methodology reference"],
            _not_importable("The underlying batch statistics are integrated via the adapted annulus_shape module."),
        ),
        _entry(
            "EAMapReader",
            "Electroanatomical map import (NavX, Carto3, Rhythmia).",
            "bridge",
            "slicer_runtime",
            "available_via_bridge",
            ["bridge job catalogue (EP workflows)"],
            _not_importable("File decoding plus scene interaction; needs Slicer. Candidate for future EP integration."),
        ),
        _entry(
            "EchoVolumeRender",
            "3D/4D echo volume rendering with distance-dependent colouring.",
            "bridge",
            "slicer_cpp_build",
            "documented_only",
            [],
            "Includes C++ VTK rendering plugin; browser rendering uses CardioTon's own WebGL stack instead.",
        ),
        _entry(
            "ValveView",
            "Heart valve visualisation via two rotating orthogonal reslice planes.",
            "reference_only",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable("Feature is built into 3D Slicer >= 4.11 core; no CardioTon re-implementation planned."),
        ),
        _entry(
            "VirtualCathLab",
            "C-arm angio suite simulation, fluoroscopy generation, device display.",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable("Surgical-planning simulation; out of scope for the current risk twin demo."),
        ),
        _entry(
            "CardiacDeviceSimulator / CardiacDeviceSimulatorExtender",
            "Cardiac implant placement evaluation (devices, deformation, compression).",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable("Implant placement planning requires Slicer interaction."),
        ),
        _entry(
            "ValveClipDeviceSimulator / TCAVValveSimulator / AsdVsdDeviceSimulator",
            "Device-specific placement simulators (MitraClip G4 clips, TCAV, ASD/VSD occluders).",
            "convert",
            "static_assets",
            "documented_only",
            [],
            "Small binary STL device models (e.g. ValveClipDeviceSimulator/Resources/Models/*.stl) are browser-"
            "convertible to GLB for future device-placement scenes; not yet converted. The simulator logic itself "
            "needs a Slicer runtime.",
        ),
        _entry(
            "BafflePlanner",
            "Virtual planning of intracardiac baffle surfaces.",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable(""),
        ),
        _entry(
            "ValveFemExport",
            "FEM export of valve leaflets and chordae for FEBio closure simulation.",
            "reference_only",
            "slicer_runtime",
            "documented_only",
            ["hemodynamics module methodology reference"],
            _not_importable("Methodology is relevant to future FSI coupling; CardioTon's hemodynamics uses its own validated 0D solver."),
        ),
        _entry(
            "ImportExportSimulationModel",
            "Import/export of simulation meshes with RAS/LPS and unit-system conversion.",
            "reference_only",
            "slicer_runtime",
            "documented_only",
            ["coordinate-system conventions documented in integration docs"],
            _not_importable("RAS/LPS and CGS/mm-g-s conversion conventions adopted as documented practice for any future mesh exchange."),
        ),
        _entry(
            "FEBioMeshIO",
            "FEBio FEM mesh IO for 3D Slicer.",
            "exclude",
            "slicer_cpp_build",
            "not_integrated",
            [],
            "C++ loadable module for the Slicer application; not usable from the web stack.",
        ),
        _entry(
            "ImportMimics",
            "Materialise Mimics/3-matic project import (volumes, models, annulus curves).",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable(""),
        ),
        _entry(
            "Reconstruct4DCineMRI",
            "Reconstruction of Cartesian volumes from sparse cine-MRI frames.",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable(""),
        ),
        _entry(
            "DicomUltrasoundPlugin",
            "DICOM plugins for 3D/4D cardiac ultrasound (Philips, GE, Eigen, Siemens, Samsung, Canon, Hitachi).",
            "bridge",
            "slicer_cpp_build",
            "documented_only",
            ["cardiac-imaging ingestion roadmap"],
            "C++/Python DICOM plugins built against Slicer's DICOM framework; relevant when an imaging ingestion "
            "pipeline behind the bridge is provisioned.",
        ),
        _entry(
            "Philips4dUsDicomPatcher / Philips4dUsReader",
            "Fix and read Philips QLAB 4D echo DICOM exports.",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable("DICOM repair runs against Slicer's DICOM database."),
        ),
        _entry(
            "KretzFileReader / GeUsMovieReader / UltrasoundImage3dReader / TomTecUcdPlugin",
            "Vendor ultrasound readers (GE Kretz vol, GE movie, Eigen Artemis 3D US, TomTec UCD).",
            "bridge",
            "slicer_cpp_build",
            "documented_only",
            [],
            "Vendor-format decoders built as Slicer IO plugins; some require vendor SDKs (GE Image3dAPI DLL).",
        ),
        _entry(
            "PhaseSymmetryFilter",
            "ITK phase-symmetry image filter.",
            "exclude",
            "slicer_cpp_build",
            "not_integrated",
            [],
            "ITK C++ filter requiring the SuperBuild toolchain; not part of the current integration.",
        ),
        _entry(
            "ConformalTextureMapping",
            "Conformal texture mapping of 3D models.",
            "reference_only",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable("CardioTon's browser heart rendering uses its own material pipeline; kept as reference."),
        ),
        _entry(
            "FluoroFlowCalculator",
            "Qp-split estimation from fluoroscopy sequences.",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable("Qt GUI + Slicer scene interaction."),
        ),
        _entry(
            "CartoExport",
            "Export models for Carto EP mapping systems.",
            "bridge",
            "slicer_runtime",
            "documented_only",
            [],
            _not_importable(""),
        ),
        _entry(
            "LeafletMoldGenerator / ValveMoldCreator",
            "3D-printable mold generation for silicone valve phantoms.",
            "exclude",
            "slicer_runtime",
            "not_integrated",
            [],
            "Physical manufacturing tooling for bench phantoms; not applicable to the digital-twin platform.",
        ),
        _entry(
            "SuperBuild (CMake)",
            "Build system for SlicerHeart and its C++ dependencies.",
            "exclude",
            "slicer_cpp_build",
            "not_integrated",
            [],
            "Only relevant when provisioning a dedicated Slicer runtime worker; documented in the bridge setup guide.",
        ),
    ]


def catalog_summary() -> dict[str, Any]:
    matrix = integration_matrix()
    by_classification: dict[str, int] = {}
    by_runtime: dict[str, int] = {}
    for item in matrix:
        by_classification[item["classification"]] = by_classification.get(item["classification"], 0) + 1
        by_runtime[item["runtime"]] = by_runtime.get(item["runtime"], 0) + 1
    wired = [item["module"] for item in matrix if item["status"] == "wired"]
    return {
        "modules_classified": len(matrix),
        "by_classification": by_classification,
        "by_runtime": by_runtime,
        "wired_into_cardioton": wired,
        "runtime_requirements": SPEED,
    }
