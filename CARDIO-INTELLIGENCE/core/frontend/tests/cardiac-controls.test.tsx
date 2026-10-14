import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ECGViewer } from "../src/cardiotwin/cardiac/ECGViewer";
import { ImagingComparison } from "../src/cardiotwin/cardiac/ImagingComparison";

afterEach(cleanup);

describe("cardiac image controls", () => {
  it("zooms an uncontrolled ECG and resets the view", () => {
    render(<ECGViewer imageUrl="/synthetic-ecg.png" />);
    fireEvent.click(screen.getByTitle("Zoom in"));
    expect(screen.getByText("120%")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Zoom out"));
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("updates both comparison images from either controlled viewer", () => {
    render(<ImagingComparison baseImage="/a.png" compareImage="/b.png" baseMarkers={[]} compareMarkers={[]} />);
    fireEvent.click(screen.getAllByTitle("Zoom in")[0]);
    expect(screen.getAllByText("120%")).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: "Zoom out" })[0]);
    expect(screen.getAllByText("95%")).toHaveLength(3);
  });
});
