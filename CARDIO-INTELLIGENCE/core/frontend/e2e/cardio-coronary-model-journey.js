async (page) => {
  const predictionPromise = page.waitForResponse(response => response.url().endsWith("/cardiotwin/predict") && response.request().method() === "POST", { timeout: 45000 });
  await page.goto("http://127.0.0.1:5195/cardiotwin");
  const response = await predictionPromise;
  if (!response.ok()) throw new Error("Existing coronary prediction failed");
  const prediction = await response.json();
  await page.getByRole("link", { name: /^3D Cardiovascular Intelligence/ }).click();
  await page.getByRole("button", { name: "Coronary explorer", exact: true }).click();
  const region = page.getByRole("region", { name: "Existing coronary model session", exact: true });
  const expected = (prediction.vessels.LAD.probability * 100).toFixed(1);
  await region.getByRole("button", { name: `LAD · ${expected}% model probability`, exact: true }).click();
  await page.getByRole("heading", { name: "Left anterior descending artery", exact: true }).waitFor();
  if (!(await region.innerText()).includes("not linked to the selected report case")) throw new Error("Model and clinical evidence were conflated");
  await page.getByLabel("Replay date · end of day UTC", { exact: true }).fill("2026-08-10");
  await region.getByText("The imported model estimate is unavailable at this historical boundary or its contract is invalid.", { exact: true }).waitFor();
  if (await region.getByRole("button", { name: /model probability/ }).count()) throw new Error("Current model output leaked into historical replay");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await region.getByRole("button", { name: `LAD · ${expected}% model probability`, exact: true }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/playwright/cardio-intelligence-coronary-model.png", fullPage: true });
  return { existingPredictionSucceeded: true, vesselProbabilitiesTransferred: true, patientInputsTransferred: false, independentModelLabel: true, historicalExclusion: true };
}
