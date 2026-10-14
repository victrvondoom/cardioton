# Editable report and rendering

The delivered PDF is ready to open. Its editable source is [report_source.py](report_source.py); numbers are read from [CLAIMS.json](CLAIMS.json) and checked against the saved aggregate-result SHA-256. Text, spacing, native vector bars and workflow boxes are authored in Python; the real PNG screenshots remain separate assets. Six pages are explicit, with overflow assertions and deterministic ReportLab metadata. It performs no inference, fitting, holdout evaluation or outcome decoding.

The delivered document was rendered in a separate document runtime using ReportLab **4.4.9**, Pillow **12.3.0**, and pypdf **6.10.0**. These are document tools, not new V1 dependencies. Do not install them into the frozen `.venv` or edit its locks.

To rebuild in a separate disposable document environment from the repository root:

```sh
python3 -m venv .runtime/submission-report
.runtime/submission-report/bin/python -m pip install reportlab==4.4.9 Pillow==12.3.0 pypdf==6.10.0
.runtime/submission-report/bin/python docs/submission/report_source.py
.runtime/submission-report/bin/python -c 'from pypdf import PdfReader; assert len(PdfReader("output/pdf/CardioScope-Track-A-Report.pdf").pages) == 6'
```

Output: `output/pdf/CardioScope-Track-A-Report.pdf`. Network is needed for fresh document-tool installation, not rendering after installation. Page rendering for inspection used Poppler `pdftoppm`; all six final pages were visually reviewed. Check the final text/figures after edits and retain the absolute six-page maximum. A cross-platform byte-identical PDF rebuild is not claimed.

## Final polish and crop provenance

Page 4 now emphasizes the real posterior LCX selection with heart and all vessels shown; Page 5 enlarges two positive and two negative factors from the same existing CAD explanation. The full captures are preserved. [Screenshot provenance](SCREENSHOT_PROVENANCE.json) records source hashes and integer crop rectangles; the report builder verifies every capture hash and exact crop pixels before rendering. No scientific content is composited or annotated into the screenshots. The report adds TN/FP/FN/TP interpretation and keeps publication administration in [PUBLICATION.md](PUBLICATION.md), rather than its scientific limitations page.

The latest polish checks are recorded in [POLISH_VERIFICATION.json](POLISH_VERIFICATION.json). [VERIFICATION.json](VERIFICATION.json) retains the earlier submission-preparation run and its original PDF hash as historical evidence. The current PDF hash belongs to the polish record.
