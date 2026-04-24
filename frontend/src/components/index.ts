 
// ═══════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM CENTRALISÉ - EXPORT DE TOUS LES COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════

// Design Tokens
export {
  DESIGN_TOKENS,
  COMMON_CLASSES,
  getColor,
  getSpacing,
  getRadius,
  getShadow,
} from '../styles/tokens';

// Analytics
export { analytics, withAnalytics, useDesignSystemAnalytics } from '../utils/designSystemAnalytics';

// Layout Components
export {
  PageHeader,
  PageContainer,
  Section,
  CardGrid,
  StatsGrid,
  ContentArea,
  SidebarLayout,
} from './layout';

// Page Components
export { StatsPage } from './pages';

// UI Components (existing)
export {
  Button,
  Card,
  Badge,
  Input,
  Select,
  Alert,
  Tabs,
  StatCard,
  Pagination,
  Modal,
  Skeleton,
} from './UI';

// Dashboard Components (existing)
export {
  KPICard,
  StatusBadge,
  ProgressBar,
  ActionBar,
  ActivityFeed,
  AlertPanel,
  ModulePageShell,
} from './dashboards/DashboardComponents';

//
