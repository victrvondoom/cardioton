"""Generate small, fictional report fixtures; never reads patient information."""

from datetime import UTC, datetime
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def main() -> None:
    destination = Path(__file__).resolve().parents[2] / "output" / "cardio-demo"
    destination.mkdir(parents=True, exist_ok=True)
    date = datetime.now(UTC).isoformat()
    examples = {
        "synthetic-angiography": ["Report type: Coronary angiography", "LAD stenosis, 70%. Segment unspecified.", "LVEF 30%."],
        "synthetic-unresolved": ["Report type: Cardiovascular consultation", "Cardiac disease documented. Anatomical location unspecified."],
    }
    for name, findings in examples.items():
        lines = ["SYNTHETIC FICTIONAL CARDIOVASCULAR REPORT", f"Study date: {date}",
                 "Author: Synthetic demonstration clinician", *findings,
                 "Educational fixture. No real patient. Not a clinical document."]
        pdf = canvas.Canvas(str(destination / f"{name}.pdf"), pagesize=A4)
        pdf.setTitle(name)
        text = pdf.beginText(50, 780)
        text.setFont("Helvetica", 11)
        text.setLeading(20)
        for line in lines:
            text.textLine(line)
        pdf.drawText(text)
        pdf.save()
        (destination / f"{name}.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Fictional PDF and text fixtures: {destination}")


if __name__ == "__main__":
    main()
