-- ============ ROLES & USERS ============

-- Table rôles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  role_id INTEGER NOT NULL REFERENCES roles(id),
  
  status VARCHAR(20) DEFAULT 'active',
  last_login TIMESTAMP,
  login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ PROJECTS & ZONES ============

-- Table projets
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  zone VARCHAR(100) NOT NULL,
  
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_households INTEGER NOT NULL,
  target_budget DECIMAL(15, 2) NOT NULL,
  
  status VARCHAR(20) DEFAULT 'planning',
  progress_percent DECIMAL(5, 2) DEFAULT 0,
  
  manager_id INTEGER REFERENCES users(id),
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ HOUSEHOLDS & ELECTRIFICATION ============

-- Table ménages
CREATE TABLE IF NOT EXISTS households (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  village VARCHAR(100),
  
  num_persons INTEGER, 
  monthly_consumption_kwh DECIMAL(8, 2),
  
  status VARCHAR(30) DEFAULT 'planned',
  installation_date DATE,
  
  estimated_cost DECIMAL(10, 2),
  actual_cost DECIMAL(10, 2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ TEAMS & OPERATIONS ============

-- Table équipes
CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  team_type VARCHAR(30) NOT NULL,
  
  supervisor_id INTEGER REFERENCES users(id),
  
  capacity_per_day INTEGER,
  status VARCHAR(20) DEFAULT 'active',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table membres d'équipe
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  role VARCHAR(50),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(team_id, user_id)
);

-- ============ DELIVERIES & WORK ============

-- Table livraisons (électrification)
CREATE TABLE IF NOT EXISTS deliveries (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id),
  household_id INTEGER REFERENCES households(id),
  
  delivery_date DATE NOT NULL,
  num_households INTEGER,
  
  status VARCHAR(20) DEFAULT 'completed',
  notes TEXT,
  
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ KPI SNAPSHOTS ============

-- Table snapshots KPI (pour historique + analytics)
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Households
  total_households INTEGER,
  electrified_households INTEGER,
  pending_households INTEGER,
  electricity_access_percent DECIMAL(5, 2),
  
  -- Budget
  total_budget DECIMAL(15, 2),
  used_budget DECIMAL(15, 2),
  remaining_budget DECIMAL(15, 2),
  percent_used DECIMAL(5, 2),
  cost_per_household DECIMAL(10, 2),
  
  -- Teams
  active_teams INTEGER,
  team_saturation_percent DECIMAL(5, 2),
  average_productivity DECIMAL(5, 2),
  
  -- Timeline
  timeline_progress_percent DECIMAL(5, 2),
  estimated_delay_days INTEGER,
  on_time BOOLEAN,
  
  -- Quality
  compliance_rate DECIMAL(5, 2),
  reserve_count INTEGER,
  quality_score DECIMAL(5, 2),
  
  -- Risk
  critical_stock_alerts INTEGER,
  village_at_risk BOOLEAN,
  risk_level VARCHAR(20),
  
  -- IGPP Score
  igpp_score DECIMAL(5, 2),
  igpp_status VARCHAR(50),
  
  snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ ALERTS & NOTIFICATIONS ============

-- Table alertes
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES users(id),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ ACTIVITY LOG ============

-- Table logs d'activité
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  description TEXT,
  
  changes JSONB,
  
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ SYNC METADATA ============

-- Table métadonnées de synchronisation (offline support)
CREATE TABLE IF NOT EXISTS sync_metadata (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER NOT NULL,
  
  last_modified TIMESTAMP,
  sync_status VARCHAR(20) DEFAULT 'synced',
  last_synced_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(project_id, entity_type, entity_id)
);

-- ============ REFRESH TOKENS ============

-- Table tokens (JWT refresh)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  revoked_by INTEGER REFERENCES users(id),
  
  user_agent TEXT,
  ip_address VARCHAR(45),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============ INSERT INITIAL DATA ============

-- Insérer les rôles
INSERT INTO roles (name, description) VALUES
  ('ADMIN', 'Administrateur système'),
  ('SUPERVISEUR', 'Superviseur de projet'),
  ('TECHNICIEN', 'Technicien terrain')
ON CONFLICT (name) DO NOTHING;

-- Insérer un utilisateur admin par défaut
-- Password: admin123 (à changer en production)
INSERT INTO users (email, password_hash, first_name, last_name, role_id, status)
SELECT 
  'admin@proquelec.com',
  '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/1Pq',
  'Admin',
  'PROQUELEC',
  id,
  'active'
FROM roles
WHERE name = 'ADMIN'
ON CONFLICT (email) DO NOTHING;

-- ============ CREATE INDEXES ============

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects(code);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_manager_id ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_households_project_id ON households(project_id);
CREATE INDEX IF NOT EXISTS idx_households_status ON households(status);
CREATE INDEX IF NOT EXISTS idx_households_village ON households(village);
CREATE INDEX IF NOT EXISTS idx_teams_project_id ON teams(project_id);
CREATE INDEX IF NOT EXISTS idx_teams_type ON teams(team_type);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_project_id ON deliveries(project_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_kpi_project_id ON kpi_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_kpi_date ON kpi_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_alerts_project_id ON alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_activity_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sync_project_id ON sync_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_metadata(sync_status);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON refresh_tokens(expires_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_email_status ON users(email, status);
CREATE INDEX IF NOT EXISTS idx_households_project_status ON households(project_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_project_date ON deliveries(project_id, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_project_action ON activity_logs(project_id, action);
