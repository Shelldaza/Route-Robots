import type {
  IncidentSelection,
} from '../../components/incident-map-editor'

export type EditorScope =
  | 'segment'
  | 'street_section'

export type EditorPhase =
  | 'idle'
  | 'editing'
  | 'locating'
  | 'modified'
  | 'confirmed'
  | 'saving'

type Snapshot = {
  selection: IncidentSelection | null
  scope: EditorScope
  phase: 'idle' | 'modified' | 'confirmed'
}

export type EditorState = {
  phase: EditorPhase
  selection: IncidentSelection | null
  scope: EditorScope
  backup: Snapshot | null
}

export const initialEditorState: EditorState = {
  phase: 'idle',
  selection: null,
  scope: 'segment',
  backup: null,
}

export type EditorAction =
  | {
    type:
      | 'begin'
      | 'locate'
      | 'located'
      | 'confirm'
      | 'cancel'
      | 'save'
      | 'saveFailed'
      | 'saved'
      | 'discard'
  }
  | {
    type: 'select'
    selection: IncidentSelection
  }
  | {
    type: 'scope'
    scope: EditorScope
  }

export function isEditing(state: EditorState) {
  return (
    state.phase === 'editing'
    || state.phase === 'locating'
  )
}

// Una ubicación modificada debe confirmarse antes de guardarse.
// Cancelar restaura la selección y el alcance que existían al comenzar.
export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  if (action.type === 'saved') {
    return {
      ...initialEditorState,
      scope: state.scope,
    }
  }

  if (state.phase === 'saving') {
    return action.type === 'saveFailed'
      ? { ...state, phase: 'confirmed' }
      : state
  }

  switch (action.type) {
    case 'begin':
      if (
        state.phase === 'editing'
        || state.phase === 'locating'
      ) {
        return state
      }

      return {
        ...state,
        phase: 'editing',
        backup: {
          selection: state.selection,
          scope: state.scope,
          phase: state.phase,
        },
      }

    case 'locate':
      return isEditing(state)
        ? { ...state, phase: 'locating' }
        : state

    case 'located':
      return state.phase === 'locating'
        ? { ...state, phase: 'editing' }
        : state

    case 'select':
      return isEditing(state)
        ? {
          ...state,
          phase: 'editing',
          selection: action.selection,
        }
        : state

    case 'scope': {
      const selection =
        state.selection?.mode === 'segment'
        && action.scope === 'segment'
          ? {
            ...state.selection,
            segments: state.selection.segments.slice(0, 1),
          }
          : state.selection

      return {
        ...state,
        scope: action.scope,
        selection,
        phase: isEditing(state)
          ? state.phase
          : selection
            ? 'modified'
            : 'idle',
      }
    }

    case 'confirm':
      return (
        state.phase === 'editing'
        && state.selection
      )
        ? {
          ...state,
          phase: 'confirmed',
          backup: null,
        }
        : state

    case 'cancel':
      return isEditing(state) && state.backup
        ? {
          ...state.backup,
          backup: null,
        }
        : state

    case 'save':
      return (
        state.phase === 'confirmed'
        && state.selection
      )
        ? { ...state, phase: 'saving' }
        : state

    case 'discard':
      return {
        ...initialEditorState,
        scope: state.scope,
      }

    default:
      return state
  }
}