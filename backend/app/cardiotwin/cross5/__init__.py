"""CROSS-5 — multiscale intersection engine for CardioTon.

Five reference frames:

  FRAME 01  CardioTwin     — human cardiac anatomy, CAD prediction (existing)
  FRAME 02  CardioEarth    — planetary health, environment (existing components)
  FRAME 03  CardioFlow     — coronary vascular microphysics (new)
  FRAME 04  CardioChronos — biological time, longitudinal physiology (new)
  FRAME 05  CardioCity     — urban systems, healthcare access (new)

The frames are *linked, never physically merged*: each frame keeps its own
coordinate system, units and observation semantics. The intersection engine
connects them only through explicitly typed evidence records and documented
mathematical relations; unsupported combinations are reported as unsupported
instead of being invented.
"""
