/* eslint-disable @typescript-eslint/no-explicit-any */
import { useReducer, useMemo, useCallback } from 'react';
import { missionReducer } from '../core/missionReducer';
import { selectTotalFrais } from '../core/missionSelectors';
import type {
  MissionState,
  AuditEntry,
  MissionOrderData,
  MissionMember,
} from '../core/missionTypes';

const initialState: MissionState = {
  formData: {},
  members: [],
  currentMissionId: null,

  // Metadata (Phase 2 PRO)
  version: 1,
  updatedAt: null,
  lastSyncedAt: null,
  status: 'idle',
  isSyncing: false,
  isSyncingServer: false,
  syncStatus: 'synced',
  offlineQueue: [],

  // Dirty Tracking
  dirty: {
    form: false,
    members: false,
    planning: false,
  },

  // Lifecycle
  auditTrail: [],
  activeTab: 'prep',
  isSimplifiedMode: false,
  isCertified: false,
  isSubmitted: false,
  lastSavedAt: null,
};

export const useMissionState = () => {
  const [state, dispatch] = useReducer(missionReducer, initialState);

  // Sélecteurs mémorisés
  const totalFrais = useMemo(() => selectTotalFrais(state), [state.members]);

  // Indicateur global dirty (pour auto-save)
  const isDirty = useMemo(
    () => state.dirty.form || state.dirty.members || state.dirty.planning,
    [state.dirty]
  );

  // Actions métier encapsulées (Clean API)
  const setFormData = useCallback(
    (data: Partial<MissionOrderData>) => dispatch({ type: 'SET_FORM_DATA', payload: data }),
    []
  );

  const updateFormField = useCallback(
    (field: keyof MissionOrderData, value: any) =>
      dispatch({ type: 'UPDATE_FORM_FIELD', payload: { field, value } }),
    []
  );

  const addMember = useCallback(
    (member: MissionMember) => dispatch({ type: 'ADD_MEMBER', payload: member }),
    []
  );

  const updateMember = useCallback(
    (index: number, payload: Partial<MissionMember>) =>
      dispatch({ type: 'UPDATE_MEMBER', index, payload }),
    []
  );

  const removeMember = useCallback(
    (index: number) => dispatch({ type: 'REMOVE_MEMBER', index }),
    []
  );

  const setStatus = useCallback(
    (status: MissionState['status']) => dispatch({ type: 'SET_STATUS', payload: status }),
    []
  );

  const setActiveTab = useCallback(
    (tab: MissionState['activeTab']) => dispatch({ type: 'SET_ACTIVE_TAB', payload: tab }),
    []
  );

  const setSimplifiedMode = useCallback(
    (active: boolean) => dispatch({ type: 'SET_SIMPLIFIED_MODE', payload: active }),
    []
  );

  const setCertified = useCallback(
    (active: boolean) => dispatch({ type: 'SET_CERTIFIED', payload: active }),
    []
  );

  const setSubmitted = useCallback(
    (active: boolean) => dispatch({ type: 'SET_SUBMITTED', payload: active }),
    []
  );

  const loadMission = useCallback(
    (
      id: string | null,
      data: Partial<MissionOrderData>,
      members: MissionMember[],
      version?: number,
      updatedAt?: string,
      auditTrail?: AuditEntry[]
    ) =>
      dispatch({
        type: 'LOAD_MISSION',
        payload: { id, data, members, version, updatedAt, auditTrail },
      }),
    []
  );

  const resetMission = useCallback(
    (
      orderNumber: string,
      date: string,
      planning: string[],
      createdBy?: string,
      creatorId?: string
    ) =>
      dispatch({
        type: 'RESET_MISSION',
        payload: { orderNumber, date, planning, createdBy, creatorId },
      }),
    []
  );

  const clearDirty = useCallback(
    (field?: keyof MissionState['dirty']) => dispatch({ type: 'CLEAR_DIRTY', payload: field }),
    []
  );

  const setSyncStatus = useCallback(
    (status: MissionState['syncStatus']) => dispatch({ type: 'SET_SYNC_STATUS', payload: status }),
    []
  );

  const addAuditEntry = useCallback(
    (actionMsg: string, author: string, details?: string) =>
      dispatch({ type: 'ADD_AUDIT_ENTRY', payload: { action: actionMsg, author, details } }),
    []
  );

  return {
    state,
    dispatch,
    totalFrais,
    isDirty,

    // API de mutation exposée
    setFormData,
    updateFormField,
    addMember,
    updateMember,
    removeMember,
    setStatus,
    setActiveTab,
    setSimplifiedMode,
    setCertified,
    setSubmitted,
    loadMission,
    resetMission,
    clearDirty,
    setSyncStatus,
    addAuditEntry,
  };
};
