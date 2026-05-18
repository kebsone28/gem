import type { ModuleManifest } from './types';
import { PERMISSIONS, ROLES } from '../security/permissions';

import { manifest as homeManifest } from '../../modules/home/manifest';
import { manifest as dashboardManifest } from '../../modules/dashboard/manifest';
import { manifest as simulationManifest } from '../../modules/simulation/manifest';
import { manifest as chargesManifest } from '../../modules/charges/manifest';
import { manifest as bordereauManifest } from '../../modules/bordereau/manifest';
import { manifest as cahierManifest } from '../../modules/cahier/manifest';
import { manifest as sharedocManifest } from '../../modules/sharedoc/manifest';
import { manifest as pv_automationManifest } from '../../modules/pv_automation/manifest';
import { manifest as terrainManifest } from '../../modules/terrain/manifest';
import { manifest as communicationManifest } from '../../modules/communication/manifest';
import { manifest as planningManifest } from '../../modules/planning/manifest';
import { manifest as formationManifest } from '../../modules/formation/manifest';
import { manifest as logistiqueManifest } from '../../modules/logistique/manifest';
import { manifest as atelierManifest } from '../../modules/atelier/manifest';
import { manifest as approvalManifest } from '../../modules/approval/manifest';
import { manifest as missionManifest } from '../../modules/mission/manifest';
import { manifest as modulesManifest } from '../../modules/modules/manifest';
import { manifest as usersManifest } from '../../modules/users/manifest';
import { manifest as diagnosticManifest } from '../../modules/diagnostic/manifest';
import { manifest as kobo_terminalManifest } from '../../modules/kobo_terminal/manifest';
import { manifest as ged_os_toolboxManifest } from '../../modules/ged_os_toolbox/manifest';
import { manifest as ged_os_collectManifest } from '../../modules/ged_os_collect/manifest';
import { manifest as organizationManifest } from '../../modules/organization/manifest';
import { manifest as settingsManifest } from '../../modules/settings/manifest';
import { manifest as securityManifest } from '../../modules/security/manifest';
import { manifest as ai_configManifest } from '../../modules/ai_config/manifest';
import { manifest as adminAgentManifest } from '../../modules/admin_agent/manifest';
import { manifest as kobo_mappingManifest } from '../../modules/kobo_mapping/manifest';
import { manifest as project_creationManifest } from '../../modules/project_creation/manifest';
import { manifest as project_editManifest } from '../../modules/project_edit/manifest';
import { manifest as helpManifest } from '../../modules/help/manifest';
import { manifest as loginManifest } from '../../modules/login/manifest';
import { manifest as mission_verificationManifest } from '../../modules/mission_verification/manifest';
import { manifest as agricultureManifest } from '../../modules/agriculture/manifest';
import { manifest as mesManifest } from '../../modules/mes/manifest';

export const MODULE_REGISTRY: Record<string, ModuleManifest> = {
  home: homeManifest,
  dashboard: dashboardManifest,
  simulation: simulationManifest,
  charges: chargesManifest,
  bordereau: bordereauManifest,
  cahier: cahierManifest,
  sharedoc: sharedocManifest,
  pv_automation: pv_automationManifest,
  terrain: terrainManifest,
  communication: communicationManifest,
  planning: planningManifest,
  formation: formationManifest,
  logistique: logistiqueManifest,
  atelier: atelierManifest,
  approval: approvalManifest,
  mission: missionManifest,
  modules: modulesManifest,
  users: usersManifest,
  diagnostic: diagnosticManifest,
  kobo_terminal: kobo_terminalManifest,
  ged_os_toolbox: ged_os_toolboxManifest,
  ged_os_collect: ged_os_collectManifest,
  organization: organizationManifest,
  settings: settingsManifest,
  security: securityManifest,
  ai_config: ai_configManifest,
  admin_agent: adminAgentManifest,
  kobo_mapping: kobo_mappingManifest,
  project_creation: project_creationManifest,
  project_edit: project_editManifest,
  help: helpManifest,
  login: loginManifest,
  mission_verification: mission_verificationManifest,
  agriculture: agricultureManifest,
  mes: mesManifest,
};

export const getAllModules = () => Object.values(MODULE_REGISTRY);
export const getModule = (key: string) => MODULE_REGISTRY[key] || null;
