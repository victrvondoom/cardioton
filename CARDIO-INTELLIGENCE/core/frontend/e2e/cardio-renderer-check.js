// Browser-local measurement; renders the real GLB and exercises actual context loss.
async (page) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Heart + evidence", exact: true }).click();
  await page.getByRole("button", { name: "Illustrative motion", exact: true }).click();
  const canvas = page.locator(".anatomy-viewport canvas");
  await canvas.scrollIntoViewIfNeeded();
  const measurements = await page.evaluate(async () => {
    const fiber = await import("/node_modules/.vite/deps/@react-three_fiber.js");
    const state = [...fiber._roots.values()].map(root => root.store.getState()).find(state => state.gl.domElement.isConnected && state.gl.domElement.closest(".anatomy-viewport"));
    if (!state) throw new Error("No active anatomy renderer");
    const gl = state.gl;
    await new Promise(resolve => setTimeout(resolve, 750));
    const start = gl.info.render.frame, began = performance.now();
    await new Promise(resolve => setTimeout(resolve, 2000));
    const elapsed = performance.now() - began;
    const result = { frames: gl.info.render.frame - start, seconds: elapsed / 1000, fps: (gl.info.render.frame - start) / (elapsed / 1000), drawCalls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, dpr: gl.getPixelRatio(), renderer: gl.getContext().getParameter(gl.getContext().RENDERER) };
    return result;
  });
  await page.getByRole("button", { name: "Illustrative motion", exact: true }).click();
  const idleFrames = await page.evaluate(async () => {
    const fiber = await import("/node_modules/.vite/deps/@react-three_fiber.js");
    const gl = [...fiber._roots.values()].map(root => root.store.getState().gl).find(gl => gl.domElement.isConnected && gl.domElement.closest(".anatomy-viewport"));
    await new Promise(resolve => setTimeout(resolve, 750));
    const start = gl.info.render.frame;
    await new Promise(resolve => setTimeout(resolve, 1000));
    const frames = gl.info.render.frame - start;
    gl.getContext().getExtension("WEBGL_lose_context").loseContext();
    return frames;
  });
  await page.getByText("3D rendering unavailable", { exact: true }).waitFor();
  await page.getByRole("button", { name: /^Select Left ventricle(?:$|:)/ }).click();
  await page.getByRole("heading", { name: "Left ventricle", exact: true }).waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "output/playwright/cardio-intelligence-context-loss.png", fullPage: true });
  return { ...measurements, idleFramesInOneSecond: idleFrames, contextLossFallback: true, fallbackStructureSelection: true };
}
