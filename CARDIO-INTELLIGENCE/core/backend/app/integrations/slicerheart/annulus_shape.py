"""Cohort annulus-shape statistics — adaptation of SlicerHeart's
``ValveBatchExport/HeartValveBatchAnalysis/annulus_shape_analysis.py``.

Upstream (BSD 3-Clause, SlicerHeart Contributors):
https://github.com/SlicerHeart/SlicerHeart

What was adapted and why:
* The pure numpy/csv core (contour extraction from exported rows, landmark
  ordering, per-segment resampling, size-normalization scale factors, cohort
  mean shape) is ported here almost verbatim so it runs inside the CardioTon
  FastAPI process.
* ``vtkProcrustesAlignmentFilter`` (rigid groupwise alignment to the first
  contour, then shift to the cohort centroid) is replaced by the equivalent
  rigid alignment computed with the numpy Kabsch algorithm. Semantics are
  preserved: translation + rotation only, no scaling; all contours aligned to
  the first contour, then shifted so the cohort centroid is at the mean
  centroid instead of the first case's centroid.
* All Slicer-specific behaviour (scene nodes, model tubes, subject hierarchy,
  progress callbacks) is intentionally omitted: this module returns numbers.

Scientific scope: these are population shape statistics over contours that a
user supplies from SlicerHeart's ValveBatchExport. They are research outputs
with no clinical interpretation attached.
"""

from __future__ import annotations

from typing import Any

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float64]

REQUIRED_COLUMNS = (
    "Filename",
    "Phase",
    "Valve",
    "AnnulusContourX",
    "AnnulusContourY",
    "AnnulusContourZ",
    "AnnulusContourLabel",
)


class ContourDataError(ValueError):
    """Raised when the supplied cohort export cannot be analysed."""


def get_unique_column_values(rows: list[dict[str, str]], column_name: str) -> list[str] | None:
    """Unique values of a column, in order of first occurrence (upstream behaviour)."""
    used: list[str] = []
    seen: set[str] = set()
    for row in rows:
        if column_name not in row:
            return None
        value = row[column_name]
        if value not in seen:
            seen.add(value)
            used.append(value)
    return used


def get_annulus_contour_points(
    rows: list[dict[str, str]], annulus_filename: str, annulus_phase: str, valve_type: str
) -> list[Any]:
    """Point coordinates and label->index map for one case/phase/valve (upstream logic)."""
    rows_for_annulus = [
        row
        for row in rows
        if row.get("Filename") == annulus_filename
        and row.get("Phase") == annulus_phase
        and row.get("Valve") == valve_type
    ]
    if not rows_for_annulus:
        raise ValueError(f"No contour rows for {annulus_filename} / {annulus_phase} / {valve_type}")
    coordinates = [
        [float(row["AnnulusContourX"]), float(row["AnnulusContourY"]), float(row["AnnulusContourZ"])]
        for row in rows_for_annulus
    ]
    # Upstream keeps the last occurrence of each label.
    labels = {
        row["AnnulusContourLabel"]: i
        for i, row in enumerate(rows_for_annulus)
        if row["AnnulusContourLabel"] != ""
    }
    return [np.array(coordinates), labels]


def order_annulus_contour_points(
    annulus_point_coordinates: FloatArray, labels: dict[str, int], label_order: list[str]
) -> list[Any]:
    """Order contour points so the first point is the first label (upstream logic)."""
    number_of_annulus_points = annulus_point_coordinates.shape[0]
    if label_order[0] not in labels:
        raise ValueError(
            f"First label ({label_order[0]}) is not defined for contour. Defined labels: {list(labels.keys())}"
        )

    starting_point_index = labels[label_order[0]]

    # Compute label indexes so that the first label's index becomes 0
    second_label_index = (labels[label_order[1]] - starting_point_index) % number_of_annulus_points
    third_label_index = (labels[label_order[2]] - starting_point_index) % number_of_annulus_points
    need_to_reverse = second_label_index > third_label_index

    # Compute new point indexes
    point_indexes: list[int] = []
    point_indexes.extend(range(starting_point_index, number_of_annulus_points))
    point_indexes.extend(range(0, starting_point_index))
    if need_to_reverse:
        point_indexes.reverse()
        point_indexes = [point_indexes[-1]] + point_indexes[:-1]

    # Compute new label indexes
    new_labels: dict[str, int] = {}
    last_index = -1
    for label in label_order:
        new_index = point_indexes.index(labels[label])
        new_labels[label] = new_index
        if new_index <= last_index == need_to_reverse:
            raise ValueError(
                f"Cannot get contour points in desired order. Required order: {label_order}. Defined labels: {list(labels.keys())}"
            )
        last_index = new_index

    new_annulus_point_coordinates = annulus_point_coordinates[point_indexes]
    return [new_annulus_point_coordinates, new_labels]


def resample_annulus_contour_points(
    annulus_point_coordinates: FloatArray,
    labels: dict[str, int],
    label_order: list[str],
    resampled_number_of_points_per_segment: int,
) -> FloatArray:
    """Resample each contour segment to a fixed number of points (upstream logic)."""
    number_of_annulus_points = annulus_point_coordinates.shape[0]
    interpolated = np.zeros([len(label_order) * resampled_number_of_points_per_segment, 3])
    for label_index in range(len(label_order)):
        start_index = labels[label_order[label_index]]
        end_index = (
            labels[label_order[label_index + 1]]
            if label_index + 1 < len(label_order)
            else number_of_annulus_points - 1
        )
        number_of_points_per_segment = end_index - start_index
        if number_of_points_per_segment < 2:
            raise ValueError(
                f"Segment {label_order[label_index]} needs at least 2 points, got {number_of_points_per_segment}"
            )
        for axis in range(3):
            interpolated[
                label_index * resampled_number_of_points_per_segment:(label_index + 1) * resampled_number_of_points_per_segment,
                axis,
            ] = np.interp(
                np.linspace(0, number_of_points_per_segment - 1, resampled_number_of_points_per_segment),
                range(number_of_points_per_segment),
                annulus_point_coordinates[start_index:end_index, axis],
            )
    return interpolated


def _rigid_transform_to(reference: FloatArray, moving: FloatArray) -> FloatArray:
    """4x4 rigid transform (rotation + translation, no scale) aligning ``moving`` to ``reference``.

    Kabsch algorithm — numpy replacement for vtkProcrustesAlignmentFilter with
    SetModeToRigidBody(). Point correspondence is established upstream by the
    landmark-based resampling, so a direct correspondence solution is valid.
    """
    ref_centroid = reference.mean(axis=0)
    mov_centroid = moving.mean(axis=0)
    ref_centered = reference - ref_centroid
    mov_centered = moving - mov_centroid
    covariance = mov_centered.T @ ref_centered
    u, _, vt = np.linalg.svd(covariance)
    d = np.eye(3)
    if np.linalg.det(vt.T @ u.T) < 0:
        d[2, 2] = -1.0
    rotation = vt.T @ d @ u.T
    transform = np.eye(4)
    transform[:3, :3] = rotation
    transform[:3, 3] = ref_centroid - rotation @ mov_centroid
    return transform


def align_annulus_contours(all_annulus_point_coordinates: FloatArray) -> FloatArray:
    """Rigidly align contours to the first contour, then shift to the cohort centroid.

    Same semantics as upstream ``get_annulus_to_mean_annulus_transforms`` +
    ``align_annulus_contours`` with rigid alignment: no scaling, alignment to
    the first case, final shift from the first case's centroid to the average
    centroid of all cases.
    """
    number_of_cases = all_annulus_point_coordinates.shape[0]
    reference = all_annulus_point_coordinates[0]
    aligned = np.empty_like(all_annulus_point_coordinates)
    for case_index in range(number_of_cases):
        transform = _rigid_transform_to(reference, all_annulus_point_coordinates[case_index])
        points = all_annulus_point_coordinates[case_index]
        aligned[case_index] = points @ transform[:3, :3].T + transform[:3, 3]
    first_case_centroid = all_annulus_point_coordinates[0].mean(axis=0)
    average_centroid = all_annulus_point_coordinates.mean(axis=(0, 1))
    aligned = aligned + (average_centroid - first_case_centroid)
    return aligned


def compute_scale_factors(rows: list[dict[str, str]], valve_type: str | None = None,
                          annulus_phases: list[str] | None = None) -> dict[str, float]:
    """Per-case relative scale factors (upstream logic; mean size normalized to cohort mean)."""
    annulus_filenames = get_unique_column_values(rows, "Filename")
    if not annulus_filenames:
        raise ContourDataError("No rows with a Filename column value")

    if annulus_phases is None:
        annulus_phases = get_unique_column_values(rows, "Phase")
    if not annulus_phases:
        raise ContourDataError("No rows with a Phase column value")
    if valve_type is None:
        valve_types = get_unique_column_values(rows, "Valve")
        if not valve_types:
            raise ContourDataError("No rows with a Valve column value")
        valve_type = valve_types[0]

    mean_sizes: list[float] = []
    mean_sizes_filenames: list[str] = []
    for annulus_filename in annulus_filenames:
        mean_sizes_for_filename: list[float] = []
        for annulus_phase in annulus_phases:
            try:
                coordinates, _labels = get_annulus_contour_points(rows, annulus_filename, annulus_phase, valve_type)
            except ValueError:
                continue
            relative_point_coords = coordinates - coordinates.mean(axis=0)
            distances = np.linalg.norm(relative_point_coords, axis=1)
            mean_sizes_for_filename.append(distances.mean())
        if not mean_sizes_for_filename:
            continue
        mean_sizes.append(float(np.array(mean_sizes_for_filename).mean()))
        mean_sizes_filenames.append(annulus_filename)

    if not mean_sizes:
        raise ContourDataError(f"Could not find valid contours for valve {valve_type}")

    mean_sizes_array = np.array(mean_sizes)
    scale_factors_array = mean_sizes_array.mean() / mean_sizes_array
    return {
        mean_sizes_filenames[case_index]: float(scale_factors_array[case_index])
        for case_index in range(len(scale_factors_array))
    }


def analyze_cohort(
    rows: list[dict[str, str]],
    label_order: list[str],
    *,
    valve_type: str | None = None,
    annulus_phases: list[str] | None = None,
    number_of_points_per_segment: int = 30,
    normalize_size: bool = False,
) -> dict[str, Any]:
    """Per-phase cohort mean annulus shape over exported contour rows.

    Returns per phase: the mean and standard deviation of the rigidly aligned
    resampled contours, mean landmark positions, per-case scale factors and
    the list of skipped cases (matching upstream's tolerant skip behaviour).
    """
    if len(label_order) != len(set(label_order)):
        raise ContourDataError(f"Duplicate elements in label order: {label_order}")
    if len(label_order) < 3:
        raise ContourDataError("At least 3 landmark labels are required")
    if number_of_points_per_segment < 2 or number_of_points_per_segment > 200:
        raise ContourDataError("number_of_points_per_segment must be between 2 and 200")

    annulus_filenames = get_unique_column_values(rows, "Filename")
    if not annulus_filenames:
        raise ContourDataError("No cases found (Filename column empty)")

    if annulus_phases is None:
        annulus_phases = get_unique_column_values(rows, "Phase")
    if not annulus_phases:
        raise ContourDataError("No phases found (Phase column empty)")
    if valve_type is None:
        valve_types = get_unique_column_values(rows, "Valve")
        if not valve_types:
            raise ContourDataError("No valve types found (Valve column empty)")
        valve_type = valve_types[0]

    scale_factors = compute_scale_factors(rows, valve_type, annulus_phases) if normalize_size else None

    number_of_annulus_segments = len(label_order)
    points_per_contour = number_of_annulus_segments * number_of_points_per_segment
    phases_result: list[dict[str, Any]] = []
    skipped_cases: list[str] = []

    for annulus_phase in annulus_phases:
        collected: list[FloatArray] = []
        phase_skipped: list[str] = []
        for annulus_filename in annulus_filenames:
            try:
                coordinates, labels = get_annulus_contour_points(rows, annulus_filename, annulus_phase, valve_type)
                if scale_factors is not None and annulus_filename in scale_factors:
                    coordinates = coordinates * scale_factors[annulus_filename]
                ordered_coordinates, ordered_labels = order_annulus_contour_points(coordinates, labels, label_order)
                resampled = resample_annulus_contour_points(
                    ordered_coordinates, ordered_labels, label_order, number_of_points_per_segment
                )
                collected.append(resampled)
            except (ValueError, KeyError, IndexError):
                phase_skipped.append(annulus_filename)
                continue

        if not collected:
            skipped_cases.extend(phase_skipped)
            continue

        all_coordinates = np.stack(collected)
        aligned = align_annulus_contours(all_coordinates)
        mean_contour = aligned.mean(axis=0)
        std_contour = aligned.std(axis=0)
        landmark_indices = list(range(0, points_per_contour, number_of_points_per_segment))
        landmark_positions = [
            {"label": label_order[i], "position": mean_contour[landmark_indices[i]].tolist()}
            for i in range(number_of_annulus_segments)
        ]
        phases_result.append(
            {
                "phase": annulus_phase,
                "cases": all_coordinates.shape[0],
                "skipped_cases": phase_skipped,
                "mean_contour_points": mean_contour.tolist(),
                "std_contour_points": std_contour.tolist(),
                "landmark_positions": landmark_positions,
                "mean_contour_centroid_mm": mean_contour.mean(axis=0).tolist(),
            }
        )
        skipped_cases.extend(phase_skipped)

    if not phases_result:
        raise ContourDataError(
            f"No valid contours found for valve {valve_type} with labels {label_order}"
        )

    return {
        "valve_type": valve_type,
        "label_order": label_order,
        "points_per_segment": number_of_points_per_segment,
        "size_normalized": normalize_size,
        "scale_factors": scale_factors,
        "phases": phases_result,
        "skipped_cases": sorted(set(skipped_cases)),
        "units": "mm (contours as exported by SlicerHeart ValveBatchExport)",
    }
