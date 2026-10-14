# Duplicate filename resolution

- Files whose name was shared with another file: **2473**.
- Renamed to a unique name: **984** (`rename-map.csv`). Every import, path and
  module reference to them was rewritten.
- Kept under a shared name, each with a recorded reason: **1490**
  (`kept-duplicate-names.csv`).
- Shared names with no recorded reason: **0**.

## How a name was resolved

Only files whose name (case-insensitive) occurs more than once were touched. A renamed file stays
in its folder and becomes `<module>__<last two folders>__<name>`. Python test files keep the
`test_` prefix pytest looks for, and JS/TS files keep their full name so `.test.ts`, `.module.css`
and similar suffixes survive. Companion files (Jest snapshots, `.d.ts`, `.pyi`, source maps) are
renamed together with their file. References were rewritten in four passes:

1. JS/TS module specifiers: `import`, `require`, dynamic `import()`, `vi.mock`/`jest.mock`,
   `new URL()`, tsconfig `paths` and `@/` aliases. Each is resolved against the pre-rename tree.
2. Python `import` / `from … import`, including relative, multi-line and notebook imports.
3. Dotted module paths in commands and configs: `uvicorn app.main:app`, `python -m …`,
   `celery -A …`, entry points, `mock.patch("pkg.mod.x")`.
4. Path and filename mentions in text, scoped to the same module, checking that the folders
   written before the name match where the file actually is. `/public` assets are matched
   as web-root URLs.

After each pass every runtime file was scanned for an old name that no longer exists. Any such
name was put back and the whole consolidation re-run from the originals, until no runtime file
pointed at a missing name.

## Why some names are still shared

Renaming these would break the program that uses them. The table counts files per reason:

| Reason | Files |
|---|---:|
| module builds file names of this type at run time | 243 |
| Python tooling finds it by name | 190 |
| referenced by a path that could not be rewritten safely | 173 |
| named inside a data, evidence or provenance record | 118 |
| tool reads this folder's files by name | 96 |
| build system reads it by name | 95 |
| dotfile configuration read by name | 80 |
| Next.js App Router file convention | 65 |
| JavaScript tooling finds it by name | 62 |
| tool configuration discovered by name | 54 |
| web entry page or file requested at a fixed URL | 40 |
| pip requirements file | 37 |
| its package is imported by a computed module name (core/backend/app/agents/manifest.py:44) | 33 |
| referenced by bare name (no extension) in module code | 32 |
| LaTeX resolves \input and \bibliography by name | 32 |
| TypeScript compiler configuration | 28 |
| CMake / 3D Slicer project: file names are build targets and Slicer module names | 20 |
| Docker build file | 16 |
| imported by a pickled model artifact | 15 |
| native Android project: resource and class names | 12 |
| AI agent tooling reads it by name | 8 |
| deployment or ML platform reads it by name | 7 |
| generated and read by Next.js | 5 |
| Expo Router: the file name is the route | 5 |
| listed by name in its package __init__.py | 5 |
| Docker Compose file | 4 |
| its package is imported by a computed module name (modules/cortwin/tests/test_leakage_boundary.py:127) | 4 |
| native iOS project | 4 |
| Next.js metadata file convention | 2 |
| migration history: discovered by folder and name | 2 |
| React Native / Expo entry point | 1 |
| Next.js pages router: the file name is the route | 1 |
| repository front page: code hosts and editors open README.md at the root | 1 |

Most common names still shared:

| Name | Copies |
|---|---:|
| `__init__.py` | 160 |
| `cmakelists.txt` | 85 |
| `.gitignore` | 46 |
| `page.tsx` | 32 |
| `design.md` | 29 |
| `requirements.md` | 29 |
| `tasks.md` | 29 |
| `package.json` | 29 |
| `requirements.txt` | 29 |
| `package-lock.json` | 27 |
| `readme.md` | 26 |
| `route.ts` | 26 |
| `index.html` | 23 |
| `tsconfig.json` | 19 |
| `conftest.py` | 19 |
| `dockerfile` | 16 |
| `.dockerignore` | 12 |
| `vite.config.ts` | 12 |
| `postcss.config.js` | 11 |
| `metrics.json` | 9 |
| `.gitkeep` | 9 |
| `.env.example` | 8 |
| `tailwind.config.ts` | 8 |
| `orchestrator.py` | 8 |
| `schemas.py` | 8 |

## Leftover mentions of old names

No code, config, script or HTML file mentions a pre-rename name.
269 mentions remain in 49 prose files (READMEs, notes, changelogs). Most of
them name a file in another folder with the same name, so rewriting them would guess.
They are listed in `stale-references.csv`.
