import { GROUPS } from './contract';
import type { GroupName, Vessel } from './contract';

export type View = 'anterior' | 'posterior';
export interface ViewerState {
  selected: Vessel | null;
  isolated: boolean;
  view: View;
  cameraRevision: number;
  focus: boolean;
}
export type ViewerAction =
  | { type: 'select'; vessel: Vessel }
  | { type: 'view'; view: View }
  | { type: 'isolate' }
  | { type: 'show-all' }
  | { type: 'reset' };
export const INITIAL_STATE: ViewerState = {
  selected: null, isolated: false, view: 'anterior', cameraRevision: 0, focus: false,
};
export function visibleGroups(state: ViewerState): readonly GroupName[] {
  return state.isolated && state.selected ? [state.selected] : GROUPS;
}
export function viewerReducer(state: ViewerState, action: ViewerAction): ViewerState {
  switch (action.type) {
    case 'select': return {
      ...state, selected: action.vessel, focus: true,
      view: action.vessel === 'LCX' ? 'posterior' : 'anterior',
      cameraRevision: state.cameraRevision + 1,
    };
    case 'view': return { ...state, view: action.view, focus: false, cameraRevision: state.cameraRevision + 1 };
    case 'isolate': return state.selected ? { ...state, isolated: true } : state;
    case 'show-all': return { ...state, isolated: false };
    case 'reset': return { ...INITIAL_STATE, cameraRevision: state.cameraRevision + 1 };
  }
}
