import type { MissionState, MissionAction, AuditEntry } from './missionTypes';

export function missionReducer(state: MissionState, action: MissionAction): MissionState {
  const now = new Date().toISOString();

  switch (action.type) {
    // ---------------------------------------------------------
    // DOMAINE : FORMULAIRE (Infos de Base)
    // ---------------------------------------------------------
    case 'SET_FORM_DATA':
      return {
        ...state,
        formData: { ...state.formData, ...action.payload },
        updatedAt: now,
        version: state.version + 1,
        dirty: { ...state.dirty, form: true }
      };

    case 'UPDATE_FORM_FIELD':
      return {
        ...state,
        formData: { ...state.formData, [action.payload.field]: action.payload.value },
        updatedAt: now,
        version: state.version + 1,
        dirty: { ...state.dirty, form: true }
      };

    // ---------------------------------------------------------
    // DOMAINE : MEMBRES (RH & Indemnités)
    // ---------------------------------------------------------
    case 'ADD_MEMBER':
      return {
        ...state,
        members: [...state.members, action.payload],
        updatedAt: now,
        version: state.version + 1,
        dirty: { ...state.dirty, members: true }
      };

    case 'UPDATE_MEMBER': {
      const newMembers = [...state.members];
      newMembers[action.index] = { ...newMembers[action.index], ...action.payload };
      return {
        ...state,
        members: newMembers,
        updatedAt: now,
        version: state.version + 1,
        dirty: { ...state.dirty, members: true }
      };
    }
    
    case 'SET_SUBMITTED':
      return {
        ...state,
        isSubmitted: action.payload,
        formData: { ...state.formData, isSubmitted: action.payload },
        updatedAt: now,
        version: state.version + 1
      };

    case 'REMOVE_MEMBER':
      return {
        ...state,
        members: state.members.filter((_, i) => i !== action.index),
        updatedAt: now,
        version: state.version + 1,
        dirty: { ...state.dirty, members: true }
      };

    // ---------------------------------------------------------
    // DOMAINE : SYNCHRONISATION & CYCLE DE VIE
    // ---------------------------------------------------------
    case 'LOAD_MISSION':
      return {
        ...state,
        currentMissionId: action.payload.id,
        formData: action.payload.data,
        members: action.payload.members,
        version: action.payload.version || 1,
        updatedAt: action.payload.updatedAt || now,
        auditTrail: action.payload.auditTrail || [],
        status: 'success',
        syncStatus: 'synced',
        dirty: { form: false, members: false, planning: false },
        isCertified: !!action.payload.data.isCertified,
        isSubmitted: !!action.payload.data.isSubmitted
      };

    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };

    case 'RESET_MISSION':
      return {
        ...state,
        currentMissionId: `temp-${crypto.randomUUID()}`,
        formData: {
          orderNumber: action.payload.orderNumber,
          date: action.payload.date,
          planning: action.payload.planning,
          features: { map: true, expenses: false, inventory: false, ai: false },
          transport: 'Véhicule de service',
          createdBy: action.payload.createdBy,
          creatorId: action.payload.creatorId
        },
        members: [],
        version: 1,
        updatedAt: now,
        auditTrail: [],
        status: 'idle',
        dirty: { form: true, members: false, planning: true },
        isCertified: false,
        isSubmitted: false
      };

    case 'CLEAR_DIRTY':
      if (action.payload) {
        return {
          ...state,
          dirty: { ...state.dirty, [action.payload]: false }
        };
      }
      return {
        ...state,
        dirty: { form: false, members: false, planning: false }
      };

    case 'SET_STATUS':
      return { ...state, status: action.payload };

    // ---------------------------------------------------------
    // DOMAINE : AUDIT & WORKFLOW
    // ---------------------------------------------------------
    case 'ADD_AUDIT_ENTRY': {
      const entry: AuditEntry = {
        ...action.payload,
        id: crypto.randomUUID(),
        timestamp: now
      };
      return {
        ...state,
        auditTrail: [entry, ...state.auditTrail].slice(0, 50) // Garder les 50 derniers
      };
    }

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_SIMPLIFIED_MODE':
      return { ...state, isSimplifiedMode: action.payload };

    case 'SET_CERTIFIED': {
      const isNowCertified = action.payload;
      let newOrderNumber = state.formData.orderNumber;
      
      // Génération automatique du N° d'ordre si validation et manquant
      if (isNowCertified && !newOrderNumber) {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 900) + 100;
        newOrderNumber = `MO-${year}-${random}`;
      }
      return { 
        ...state, 
        isCertified: isNowCertified,
        formData: {
          ...state.formData,
          orderNumber: newOrderNumber,
          isCertified: isNowCertified
        },
        updatedAt: now,
        version: state.version + 1
      };
    }

    default:
      return state;
  }
}
