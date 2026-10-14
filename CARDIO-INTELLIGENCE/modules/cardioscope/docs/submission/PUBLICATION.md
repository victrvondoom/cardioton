# Publication and license decision note

**Publication route: separate clean public export, authorized by the owner.** The original archival history must not be pushed. All 256 protected V1 files, original organizer PDFs and the archival tag remain preserved. GitHub publication and hosted CI are authorized; video and Devpost are the user's separate tasks.

## Owner license and export decisions

The owner selected the standard **MIT License**, with **Copyright (c) 2026 CardioScope contributors**. See [LICENSE](../../LICENSE) and [license scope](LICENSE_DECISION.md). MIT applies to project-authored code/content where appropriate; UCI data, BodyParts3D anatomy, dependencies and organizer documents retain their own terms.

Organizer-PDF redistribution permission is still not established. The authorized publication route is a **separate fresh-history public export omitting all seven documents**. The archival repository, original tag, organizer PDFs and research records remain preserved. No history rewriting or deletion is authorized or necessary.

## Organizer PDF inventory

All seven files below are tracked only in the original archival tree and entered its history in commit `c759138` (`cardioscope-v1.0.0`). They are absent from this fresh-history public export. Deleting them only in a later archival commit would leave historical blobs accessible, which is why no archival history is copied.

| Local reference file | Pages | Public redistribution |
|---|---:|---|
| `Problem Statements.pdf` | 2 | Not established |
| `Track A.pdf` | 4 | Not established |
| `Track B.pdf` | 3 | Not established |
| `Track C.pdf` | 3 | Not established |
| `Track D.pdf` | 3 | Not established |
| `Multimodal AI Hackathon 2026 - Submission Guidelines.pdf` | 1 | Not established |
| `Multimodal AI Hackathon 2026 - Prize Pool.pdf` | 1 | Not established |

Total: 7 PDFs, 17 pages. Existing local [historical summary](HACKATHON_REFERENCE.md) records their provenance and organizer-hosted Drive URLs. Track A requires a maximum-six-page report and a 3-10-minute YouTube demo; the general guidelines require public GitHub, English narration/subtitles and every teammate on Devpost. The deadline comes from the participant-supplied announcement, not the PDFs: **15 October 2026, 00:15 IST**. Confirm this with the official opportunity before submission.

## Safe publication procedure

1. Keep the current repository, original tag, exact scientific files and research history as the local frozen archive. Do not rewrite it, delete reference files, retag V1 or alter model/evaluation hashes.
2. Apply the owner-selected MIT license to project-authored content and retain all separate upstream terms. PDF permission is unresolved, so omit the seven inventoried files from the export.
3. If permission is absent, create a **separate clean public snapshot/repository with no copied `.git` directory**, omitting exactly the seven organizer PDFs. This leaves the local archive untouched and avoids publishing unauthorized historical blobs.
4. Preserve all app-required frozen bytes and attribution: four V1 pipelines, source/schema/split/search/provenance, aggregate final evidence/receipt, deterministic SHAP background/config/lock, current-source license/mapping tables and 83 meshes. Do not replace protected receipts, predictions or source bytes merely to make the export convenient.
5. Preserve the research documentation and protocols/results with explicit research-only status. Large per-fit traces may be supplied as an owner-approved checksum-verified archive alongside the public source, with paths/availability disclosed; do not silently discard reproducibility evidence or claim a missing archive is available. The existing local evidence remains complete.
6. In the separate copy only, replace organizer-PDF local links in historical docs/PLAN with their recorded organizer-hosted URLs, and explain why local reference PDFs are absent. Do not copy private attachment paths, home directories, environments, build caches, dotenv files or browser state.
7. Add the MIT code LICENSE and retain `THIRD_PARTY_NOTICES.md` plus dependency notices required for redistributed images/binaries. Do not claim the selected code license covers dataset/anatomy rights.
8. Run the scientific byte verifier and clean-clone setup/build checks in the export. The original Git tag remains in the local archive; a clean public snapshot has different history. Document this distinction rather than fabricating the same tag/commit identity. V2.1's historical baseline seal expects its archived experiment commit, not the newly edited submission README.
9. Run a final history/tree secret/path/license review. Test README/report links in the actual public export. Only then create/push the owner-authorized public GitHub repository.
10. After approved publication, check the **first actual hosted CI run** separately; do not describe local Ubuntu results as GitHub Actions having passed. Test URLs logged-out/incognito before Devpost submission.

No destructive history rewrite has been performed or is needed for the separate-snapshot route. Any alternative involving destructive rewriting requires explicit user approval.

## Current repository audit and distribution caveats

The machine-readable [repository audit](REPOSITORY_AUDIT.json) records tracked and research sizes, PDF-history inventory, scoped credential/path/cache checks and artifact availability. The submission verification record gives current build/test/link/PDF checks. Scans are scoped engineering checks, not a guarantee against every possible secret.

`.gitignore` excludes environments, runtime caches, frontend dependency/build output, logs, editor files and dotenv variants. `.dockerignore` excludes the corresponding host caches and `.git`. Docker's current `COPY artifacts` includes research evidence as inert files; V1 inference loads only the frozen V1 namespace. This adds image/context size after research, so the historical 338 MB image size is not claimed for a newly rebuilt full repository. No research model is wired into the product or deployed by this phase.

The source data are published UCI research records, with no verified true patient IDs. The prepared screenshots use the explicitly public development example; no submitted private profile or personal browser chrome is included. Saved scientific source/outcome files are protected and were not edited. The documentation phase reads saved aggregate metrics only, never decodes reserved workbook outcomes or repeats the final evaluation.

## Attribution verification

- Dataset: [UCI Extension of Z-Alizadeh Sani](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset), DOI [10.24432/C5461K](https://doi.org/10.24432/C5461K), CC BY 4.0. Retain source credit and license links for the workbook, subsets and report.
- Anatomy: [current BodyParts3D archive license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), updated 27 February 2025, specifies CC BY 4.0. Required credit: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Group subtraction/shared transformation are documented adaptations; the 83 source OBJ leaves are unchanged. The older website's different license is not applied to unrelated archives.
- Runtime: preserve upstream license/notice files when redistributing packages, binaries or containers. See `DEPENDENCY_LICENSES.json` for installed product-package metadata and lock identifiers, and the existing root third-party notice. Package metadata alone does not replace original license texts. [DEPENDENCY_NOTICES.txt](DEPENDENCY_NOTICES.txt) preserves the license/notice texts found in the installed product packages. `webgl-constants` omits a metadata license field, but its installed LICENSE explicitly supplies MIT; this is recorded rather than guessed. Container base-image notices and isolated experimental-environment notices must also be retained if distributed.

MIT selection and the separate-export route are owner-approved. Video recording/upload, both teammates' Devpost identities, YouTube/Devpost URLs and final deadline confirmation remain the user's tasks. Current publication/CI results are recorded separately when they actually complete.

## Public-export provenance

[PUBLIC_EXPORT.json](PUBLIC_EXPORT.json) records exclusions, the approved working-tree source, and documentation-only adaptations. Two intentional historical console transcripts had a personal checkout path replaced by `<ARCHIVAL_ROOT>` in this copy only, with before/after hashes recorded. Scientific result files, all 256 protected V1 files, model outputs, SHAP and anatomy remain unchanged. No environments, dependency folders, caches or local Git history are published.

## Current GitHub publication status

[AbhikRao/CardioScope](https://github.com/AbhikRao/CardioScope) was created as a public repository. GitHub rejected the initial `main` push because the current OAuth token lacks `workflow` scope. No code/tag is pushed yet, and Actions has no run. [PUBLICATION_RESULT.json](PUBLICATION_RESULT.json) records safe verification, exact local commit/tag, the permission blocker and resume commands. No credential workaround, workflow removal, force-push or history rewrite was attempted.
