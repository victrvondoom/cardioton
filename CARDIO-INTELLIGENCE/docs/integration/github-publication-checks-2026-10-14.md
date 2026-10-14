# GitHub publication checks - 2026-10-14

Target: `https://github.com/victrvondoom/cardioton.git`, branch `main`.
The consolidation and all 31 specialist module folders are included. Existing history is retained; publication uses a normal fast-forward push.

## Verified in the current tree

| Check | Result |
|---|---|
| Core offline backend pytest | 1310 passed, 3 skipped, 108 deselected |
| Core Ruff (`app tests`) | Passed |
| Core strict mypy (`app`) | Passed, 476 files |
| Backend `pip check` | Passed |
| Frontend TypeScript | Passed |
| Frontend Vitest | 352 tests in 60 files passed |
| Frontend production build | Passed; existing large-chunk warning |
| Core README contract | Passed; 4 regression tests passed |
| Root GitHub workflow YAML and source paths | All 5 parse; run directories and action source paths exist |
| Sanitized optional integration scripts | JavaScript syntax / Python AST passed; external services were not called |
| Gitleaks v8.30.1 staged tree | No leaks found after removing embedded credentials |
| Gitleaks unpublished history | No leaks found in the 3 pre-existing unpublished commits |
| Gitleaks included ZIP archives | All 6 passed, with archive traversal enabled |
| Staged file bytes versus local files | Exact match; imported hash-pinned artifacts were not normalized |
| GitHub per-file size limit | No tracked file exceeds 100 MiB |
| Git LFS | No tracked LFS pointers; fsck passed |
| Synthetic OncoTwin journey | All 8 assertions passed; database-free case draft used |
| OncoTwin stress test | All 9 scenarios failed safe |
| Authored publication repairs whitespace | Passed; whole imported snapshot limitation below |

## Publication repairs

- Restore repository-root GitHub workflows and update core working directories, dependency caches, artifact paths and manual-operation paths.
- Restore root README, license, editor settings and Render blueprint, pointing at the consolidated core.
- Update the README contract scripts for the renamed core README.
- Preserve curated anatomy meshes, source licenses and dataset provenance that a module's original ignore rules otherwise excluded.
- Replace embedded API credentials in three optional scripts with environment configuration.
- Ignore the private-key-bearing HeartAI deployment archive, local environments, keys, installed environments, caches, logs and rebuildable bundles. They remain on disk.
- Add a Gitleaks configuration containing only reviewed exact false positives: SHA-256 provenance values, a humidity field name, documentation prose and a dummy test token.

## Limits

The absorbed modules' independent Python test suites, model accuracy, hosted deployments, PostgreSQL integration tests and metered provider calls were not revalidated in this publication pass. The existing integration report documents their prior build coverage.

A whole-snapshot `git diff --cached --check` reports inherited whitespace in imported source and generated research figures. These snapshots are preserved byte for byte; this is not reported as a passing whole-snapshot whitespace check. Authored publication repairs are checked separately. The repository attributes recognize existing CRLF line endings without changing artifact bytes.

Historical consolidation counts and manifest records describe the source copy, not the exact published file count: credential-bearing archives, local state and generated files are deliberately excluded.
