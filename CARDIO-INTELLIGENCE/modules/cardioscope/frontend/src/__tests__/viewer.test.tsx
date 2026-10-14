import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import source from '../../../assets/anatomy/manifest.json';
import { AnatomyViewer } from '../anatomy/AnatomyViewer';
import { api } from '../api';
import { loadAnatomy } from '../anatomy/assets';
import type { AnatomyAssets } from '../anatomy/assets';
import type { Vessel } from '../anatomy/contract';
import type { ViewerState } from '../anatomy/state';
const context = vi.hoisted(() => ({ canvas: null as HTMLCanvasElement | null, fail: false }));
vi.mock('../api', () => ({ api: { anatomy: vi.fn() } }));
vi.mock('../anatomy/assets', () => ({ loadAnatomy: vi.fn() }));
vi.mock('@react-three/drei', () => ({ Html: () => null, OrbitControls: () => null }));
// DOM tests replace WebGL only; real mesh raycasting is checked in the browser.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, onCreated }: {
    children: ReactElement<{ onReady: () => void; onSelect: (v: Vessel) => void; state: ViewerState }>;
    onCreated: (state: { gl: { setClearColor: () => void; domElement: HTMLCanvasElement } }) => void;
  }) => {
    if (context.fail) throw new Error('Renderer initialization failed');
    const props = children.props;
    useEffect(() => props.onReady(), []);
    useEffect(() => {
      context.canvas = document.createElement('canvas');
      onCreated({ gl: { setClearColor: () => {}, domElement: context.canvas } });
    }, []);
    return <div data-testid="renderer" data-selected={props.state.selected} data-isolated={props.state.isolated}>
      {(['LAD', 'LCX', 'RCA'] as const).map(v => <button key={v} onClick={() => props.onSelect(v)}>Mesh {v}</button>)}
    </div>;
  },
}));
beforeEach(() => {
  context.fail = false;
  context.canvas = null;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as never);
  vi.mocked(api.anatomy).mockResolvedValue(source);
  vi.mocked(loadAnatomy).mockResolvedValue({ dispose: vi.fn() } as unknown as AnatomyAssets);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('synchronizes UI to scene and scene to UI selection, isolation and reset', async () => {
  render(<AnatomyViewer />);
  await waitFor(() => expect((screen.getByRole('button', { name: 'LAD' }) as HTMLButtonElement).disabled).toBe(false), { timeout: 4000 });
  fireEvent.click(screen.getByRole('button', { name: 'LAD' }));
  expect(screen.getByTestId('renderer').getAttribute('data-selected')).toBe('LAD');
  fireEvent.click(screen.getByRole('button', { name: 'Mesh LCX' }));
  expect(screen.getByRole('button', { name: 'LCX' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Selected: LCX — Left circumflex artery')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Isolate selected vessel' }));
  expect(screen.getByTestId('renderer').getAttribute('data-isolated')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
  expect(screen.getByTestId('renderer').getAttribute('data-isolated')).toBe('false');
  fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
  expect(screen.getByTestId('renderer').getAttribute('data-selected')).toBeNull();
  expect(screen.queryByText(/Model-estimated stenosis probability/)).toBeNull();
});
it('shows manifest failure and supports retry', async () => {
  vi.mocked(api.anatomy).mockRejectedValueOnce(new Error('API error 503'));
  render(<AnatomyViewer />);
  expect((await screen.findByRole('alert')).textContent).toContain('API error 503');
  expect(screen.queryByTestId('renderer')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry anatomy' }));
  expect(await screen.findByTestId('renderer')).toBeTruthy();
});
it('never mounts partial anatomy on a missing mesh', async () => {
  vi.mocked(loadAnatomy).mockRejectedValueOnce(new Error('Could not load LAD/FJ2631: HTTP 404'));
  render(<AnatomyViewer />);
  expect((await screen.findByRole('alert')).textContent).toContain('No partial anatomy is displayed');
  expect(screen.queryByTestId('renderer')).toBeNull();
});
it('shows explicit WebGL fallback without fetching meshes', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  render(<AnatomyViewer />);
  expect(screen.getByRole('alert').textContent).toContain('WebGL 2 is unavailable');
  expect(api.anatomy).not.toHaveBeenCalled();
});
it('removes the success state after WebGL context loss', async () => {
  render(<AnatomyViewer />);
  await screen.findByText('Anatomy loaded and renderer ready: 83 verified source meshes.');
  act(() => context.canvas!.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  expect(screen.getByRole('alert').textContent).toContain('context was lost');
  expect(screen.queryByTestId('renderer')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
});
it('catches renderer initialization failure without claiming successful anatomy', async () => {
  context.fail = true;
  vi.spyOn(console, 'error').mockImplementation(() => {}); // Expected React boundary diagnostic.
  render(<AnatomyViewer />);
  expect((await screen.findByRole('alert')).textContent).toContain('Renderer initialization failed');
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByTestId('renderer')).toBeNull();
});
it('disposes prepared geometry on unmount', async () => {
  const dispose = vi.fn();
  vi.mocked(loadAnatomy).mockResolvedValueOnce({ dispose } as unknown as AnatomyAssets);
  const mounted = render(<AnatomyViewer />);
  await screen.findByTestId('renderer');
  mounted.unmount();
  expect(dispose).toHaveBeenCalledOnce();
});
it('aborts the request and ignores late results after unmount', async () => {
  let resolve!: (value: typeof source) => void;
  vi.mocked(api.anatomy).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const mounted = render(<AnatomyViewer />), signal = vi.mocked(api.anatomy).mock.calls[0][0]!;
  mounted.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve(source));
  expect(loadAnatomy).not.toHaveBeenCalled();
});
it('keeps controlled card selection, prediction identity and reset synchronized with the scene', async () => {
  const { useReducer } = await import('react');
  const { INITIAL_STATE, viewerReducer } = await import('../anatomy/state');
  function Controlled() {
    const [state, dispatch] = useReducer(viewerReducer, INITIAL_STATE);
    return <><button onClick={() => dispatch({ type: 'select', vessel: 'RCA' })}>External RCA card</button>
      <AnatomyViewer viewerState={state} onAction={dispatch} vesselStates={{
        LAD: { status: 'prediction', probability: .24, modelVersion: 'test', profileFingerprint: 'test' },
        LCX: { status: 'prediction', probability: .37, modelVersion: 'test', profileFingerprint: 'test' },
        RCA: { status: 'prediction', probability: .31, modelVersion: 'test', profileFingerprint: 'test' },
      }} />
      <span data-testid="card-state">{state.selected}</span></>;
  }
  render(<Controlled />);
  await screen.findByTestId('renderer');
  fireEvent.click(screen.getByRole('button', { name: 'External RCA card' }));
  expect(screen.getByTestId('renderer').getAttribute('data-selected')).toBe('RCA');
  expect(screen.getByText('Model-estimated stenosis probability: 31.0%')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mesh LAD' }));
  expect(screen.getByTestId('card-state').textContent).toBe('LAD');
  expect(screen.getByText('Model-estimated stenosis probability: 24.0%')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Isolate selected vessel' }));
  expect(screen.getByTestId('renderer').getAttribute('data-isolated')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Posterior view' }));
  fireEvent.click(screen.getByRole('button', { name: 'Anterior view' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));
  expect(screen.getByTestId('card-state').textContent).toBe('');
  expect(screen.getByTestId('renderer').getAttribute('data-isolated')).toBe('false');
});
