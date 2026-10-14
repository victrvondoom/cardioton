"""SlicerHeart (3D Slicer cardiac extension) integration layer for CardioTon.

Upstream: https://github.com/SlicerHeart/SlicerHeart (BSD 3-Clause).
The vendored snapshot lives in the unified repository at `modules/slicerheart/`.
It is kept untouched and attributed: this package adapts or bridges selected
capabilities; it never rewrites upstream files and never invents medical outputs.

Runtime reality (verified by inspection of the vendored source):
67 of 88 upstream Python modules import `slicer`, `vtk`, `qt` or `ctk`, so they
only execute inside a 3D Slicer runtime. The parts that run in the FastAPI
process are the pure numpy/csv statistics ported in `annulus_shape` and the
static reference data in `catalog` / `valve_metrics`. Everything else is
bridged through `bridge` (explicit job specs + honest unavailability) rather
than re-implemented or faked.
"""
