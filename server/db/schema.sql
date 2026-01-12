-- Personas table (the 6 board members)
CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    output_schema TEXT,  -- JSON schema for validation
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (one per board meeting)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'draft',  -- draft, running, complete, archived
    category TEXT,  -- career, project, finance
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

-- Memos table (Chair's input)
CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    context TEXT,  -- JSON array
    decision_required TEXT NOT NULL,
    options TEXT,  -- JSON array
    constraints TEXT,  -- JSON object
    success_metrics TEXT,  -- JSON array
    questions_for_board TEXT,  -- JSON array
    attachments TEXT,  -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Responses table (each persona's response)
CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    position TEXT,
    top_reasons TEXT,  -- JSON array
    top_risks TEXT,  -- JSON array
    recommended_modifications TEXT,  -- JSON array
    validation_metrics TEXT,  -- JSON object
    confidence TEXT,  -- low, medium, high
    raw_analysis TEXT,
    tokens_used INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (persona_id) REFERENCES personas(id)
);

-- Decisions table (finalized outcomes)
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    decision_statement TEXT NOT NULL,
    rationale TEXT,
    execution_guardrails TEXT,  -- JSON array
    pre_mortem TEXT,  -- JSON object
    assumption_to_test TEXT,
    review_date TEXT,
    outcome TEXT,  -- filled in later
    retrospective TEXT,  -- filled in later
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Actions table (next steps from each session)
CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    decision_id TEXT,
    action TEXT NOT NULL,
    owner TEXT DEFAULT 'Chair',
    due_date TEXT,
    status TEXT DEFAULT 'open',  -- open, in_progress, complete, cancelled
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

-- Tags table (for categorization and search)
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON sessions(category);
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
