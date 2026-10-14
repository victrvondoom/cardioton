# Verified source notes and phase-one corrections

These findings come from the downloaded pinned UCI workbook and current BodyParts3D mapping/mesh files. They do not change the chosen track or architecture.

## UCI labels and source values

The checksum in `PLAN.md` matches the acquired archive. It contains 303 records, 55 candidate predictors, and four target columns, with the class counts recorded in the plan. The workbook has zero empty cells and zero exact duplicate rows; the deeper audit also found zero identical-predictor duplicate groups.

One source row contradicts the rule that overall CAD always equals the union of the three vessel labels:

| Stable content ID | Cath | LAD | LCX | RCA |
| --- | --- | --- | --- | --- |
| `d26723acc4dbfbbd31c4bc0b4161d59999cc8dc31ad86cc9f4dd021d5c939128` | Normal | Stenotic | Normal | Normal |

**Smallest correction:** Preserve all original target labels. Record the discrepancy in the audit rather than relabeling `Cath`, deriving CAD from vessels, or removing the row silently. The four classifiers remain independent as already planned.

Other preserved observations:

- `Sex` has values `Fmale` and `Male`; the misspelling is not silently rewritten.
- `VHD` includes `Moderate`, `N`, `Severe`, and `mild`; casing is retained.
- `Exertional CP` is constant (`N`) in the source. It remains in the explicit input allowlist; any future removal must be a documented, training-only preprocessing decision.
- The workbook alone does not establish the clinical units or meaning of all numeric codes/sentinels. Unit fields are `null`/undocumented. Observed numeric ranges are not assumed clinical limits.
- There is no authoritative patient ID. Content IDs and identical-predictor grouping support reproducibility, not a claim of verified patient identity or external clinical independence.

## BodyParts3D identifiers

The full upstream element table contains genuine leaf IDs with an `M` suffix, such as `FJ1656M`. A digits-only `FJ` parser rejected the whole table even though those entries are outside the selected cardiac subset.

**Smallest correction:** Accept safe `FJ` identifiers made of digits followed by uppercase letter suffixes, while rejecting paths and arbitrary filenames. The selected cardiac FMA/BP mappings and expected leaf counts are unchanged.

The actual selected subset resolves to 83 leaves. Heart-base 30 + LAD 18 + LCX 6 + RCA 29 are disjoint and preserve source coordinates. The source meshes total **59,953 vertices and 102,802 faces**, measured from their OBJ files. These are geometry counts, not rendering/performance results.

Current archive snapshot: ZIP size **64,888,505 bytes**, ETag `"3de1eb9-4dd48e9fe8d00"`, last modified **22 May 2013**. The current archive license page states CC BY 4.0 and was updated in 2025; the mesh snapshot's older modification date does not imply a newer geometry release. Source pages, checksums, snapshot headers, and required attribution are retained.

Phase one left browser rendering and named-vessel visual verification unfinished. Phase two completed the engineering browser checks described in [anatomy verification](anatomy/VERIFICATION.md); model metrics and SHAP were unimplemented at that milestone. Phase 3 development metrics are now recorded separately in [MODELING.md](MODELING.md); SHAP and holdout evaluation remain unfinished.

## Phase-two coordinate verification and source geometry

The official [coordinate diagram](https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/coordinate_system.png) confirms positive X = patient left, negative Y = anterior, and positive Z = superior. It also documents millimetres, corroborated by the `Bounds(mm)` header in all 83 acquired OBJ files. The smallest clarification is to document these verified anatomical units/axes and use a Z-up camera with negative-/positive-Y anterior/posterior presets. No source coordinates or immutable manifests were changed; no clinical dataset units were inferred.

The supplied six-leaf LCX geometry has separated small branch fragments visible in isolation. Checksums and parsed triangle counts match the source. Preserve the supplied geometry rather than inventing connections. Named coronary group mappings and shared positions remain unchanged. This is an engineering review, not independent medical/anatomical validation.

## Phase-three source-access correction

The previous safe development interface returned development rows but called full-source validation and split reconstruction first, re-encoding holdout outcomes. Phase 3 now verifies the original bytes against a new access lock, identifies membership using existing predictor-group hashes, decodes only development outcomes, and checks persisted folds without regenerating them. The original audit, feature manifest, split, anatomy mapping, source provenance and meshes were not changed. Source integration verification now uses the same boundary; original synthetic audit/split tests are retained. See [MODELING.md](MODELING.md) for details and reproduction commands.

Workbook inspection for the reader found cached formulas in **BMI** (`B2/((C2/100)*(C2/100))`) and **Obesity** (`IF(Table2[[#This Row],[BMI]]>=25,"Y","N")`) in the first data row. The smallest justified correction is to accept their immutable cached values exactly as the original Phase 1 `openpyxl` data-only loader did. No formula is executed or recalculated, no field is removed, and no clinical unit/range or decision rule is inferred from these expressions. Missing cached values or formulas in another predictor fail explicitly. This inspection did not decode holdout target cells.

Development-only modeling found zero missing predictor values, retained constant `Exertional CP`, and encountered rare allowed categories absent in some inner training folds. Those validation-only categories receive all-zero one-hot blocks; vocabularies and scalers are learned only from the training fold and persisted per fit. No row filtering, label correction or global category fitting occurred.

## Phase-six explanation compatibility corrections

No dataset field, source outcome, anatomy mapping or coordinate was corrected in Phase 6. Two runtime issues required narrowly scoped corrections: the original optional llvmlite resolution cannot run on Python 3.12, and SHAP’s interventional C++ path rounds stored tree thresholds to float32, changing a boundary branch in RCA. A separately hash-locked ARM64 SHAP runtime preserves the original lock/core package versions; an in-memory, routing-equivalent SHAP threshold adapter preserves the saved sklearn forest function. Original model and evaluation files remain unchanged. The exact diagnosis, regression tests, tolerances and sources are documented in [EXPLANATIONS.md](EXPLANATIONS.md#runtime-and-smallest-corrections).
