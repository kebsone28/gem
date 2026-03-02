-- =============================================
-- Electrification de Masse — PostgreSQL Schema
-- Version: 001 (initial)
-- =============================================

-- Users & Authentication
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(200),
    role            VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('admin', 'supervisor', 'agent')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id              VARCHAR(100) PRIMARY KEY,
    name            VARCHAR(300) NOT NULL,
    status          VARCHAR(50) DEFAULT 'active',
    start_date      DATE,
    end_date        DATE,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Zones
CREATE TABLE IF NOT EXISTS zones (
    id              VARCHAR(100) PRIMARY KEY,
    project_id      VARCHAR(100) REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(300) NOT NULL,
    code            VARCHAR(50),
    polygon         JSONB,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE IF NOT EXISTS teams (
    id              VARCHAR(100) PRIMARY KEY,
    project_id      VARCHAR(100) REFERENCES projects(id) ON DELETE CASCADE,
    zone_id         VARCHAR(100) REFERENCES zones(id) ON DELETE SET NULL,
    name            VARCHAR(200) NOT NULL,
    type            VARCHAR(100),
    members_count   INTEGER DEFAULT 0,
    config          JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Households (main data table)
CREATE TABLE IF NOT EXISTS households (
    id              VARCHAR(200) PRIMARY KEY,
    project_id      VARCHAR(100) REFERENCES projects(id) ON DELETE CASCADE,
    kobo_id         VARCHAR(200),
    
    -- Location
    zone            VARCHAR(200),
    commune         VARCHAR(200),
    village         VARCHAR(200),
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    location        JSONB DEFAULT '{}',
    
    -- Owner
    owner           JSONB DEFAULT '{}',
    
    -- Status pipeline
    status          VARCHAR(100) DEFAULT 'Attente démarrage',
    status_history  JSONB DEFAULT '[]',
    
    -- Teams assigned
    assigned_teams  JSONB DEFAULT '[]',
    
    -- Material (from Kobo livreur)
    material        JSONB DEFAULT '{}',
    
    -- Delivery tracking
    delivery        JSONB DEFAULT '{}',
    
    -- Work time
    work_time       JSONB DEFAULT '{}',
    
    -- Progression
    progression     DOUBLE PRECISION DEFAULT 0,
    etapes_realisees JSONB DEFAULT '[]',
    
    -- Technical info
    tech_info       JSONB DEFAULT '{}',
    
    -- Notes & photos
    notes           JSONB DEFAULT '[]',
    photos          JSONB DEFAULT '[]',
    
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    synced_at       TIMESTAMPTZ
);

-- Deliveries (standalone tracking)
CREATE TABLE IF NOT EXISTS deliveries (
    id              SERIAL PRIMARY KEY,
    household_id    VARCHAR(200) REFERENCES households(id) ON DELETE CASCADE,
    agent           VARCHAR(200),
    date            TIMESTAMPTZ,
    type            VARCHAR(100),
    device_id       VARCHAR(200),
    signature       TEXT,
    validation_status VARCHAR(100),
    duration_minutes INTEGER,
    notes           TEXT,
    data            JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Sync logs
CREATE TABLE IF NOT EXISTS sync_logs (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type            VARCHAR(50), -- 'push', 'pull', 'kobo_import'
    status          VARCHAR(50) DEFAULT 'pending',
    records_count   INTEGER DEFAULT 0,
    data            JSONB DEFAULT '{}',
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

-- ====== Indexes ======
CREATE INDEX IF NOT EXISTS idx_households_project ON households(project_id);
CREATE INDEX IF NOT EXISTS idx_households_zone ON households(zone);
CREATE INDEX IF NOT EXISTS idx_households_status ON households(status);
CREATE INDEX IF NOT EXISTS idx_households_commune ON households(commune);
CREATE INDEX IF NOT EXISTS idx_households_kobo ON households(kobo_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_household ON deliveries(household_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_agent ON deliveries(agent);
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);
CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON sync_logs(user_id);

-- ====== Default Admin User ======
-- Password: admin123 (bcrypt hash)
INSERT INTO users (username, password_hash, display_name, role)
VALUES ('admin', '$2b$10$rQ8K4x5l6YqZ1O2I3p4nEeG7H8j9k0L1m2N3o4P5q6R7s8T9u0V1w', 'Administrateur', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ====== Updated_at trigger ======
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_households_updated_at
    BEFORE UPDATE ON households
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
