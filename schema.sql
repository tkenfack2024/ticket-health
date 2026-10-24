CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ouvert',
    description TEXT,
    assignee TEXT DEFAULT '-',
    creator TEXT DEFAULT 'Utilisateur',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  , created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL, asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL, archived INTEGER NOT NULL DEFAULT 0, archived_at TEXT, sla_response_deadline TEXT, sla_resolution_deadline TEXT, sla_paused_at TEXT, sla_paused_total_minutes INTEGER NOT NULL DEFAULT 0, resolved_at TEXT, sla_escalated INTEGER NOT NULL DEFAULT 0, incident_type TEXT NOT NULL DEFAULT 'standard', is_dora_major INTEGER NOT NULL DEFAULT 0, dora_criteria TEXT, dora_notification_date TEXT);

CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author TEXT NOT NULL DEFAULT 'Utilisateur',
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  );

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'technicien', 'user')),
    active INTEGER NOT NULL DEFAULT 1,
    otp_code TEXT,
    otp_expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  , custom_role TEXT);

CREATE TABLE modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Box',
    color TEXT DEFAULT 'slate',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

CREATE TABLE assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('hardware', 'software')),
    name TEXT NOT NULL,
    category TEXT,
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    location TEXT,
    assigned_to INTEGER,
    status TEXT NOT NULL DEFAULT 'En service',
    purchase_date TEXT,
    warranty_end TEXT,
    editor TEXT,
    version TEXT,
    license_key TEXT,
    license_expires_at TEXT,
    license_count INTEGER,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')), asset_tag TEXT, room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
  );

CREATE TABLE logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')), reviewed INTEGER NOT NULL DEFAULT 0, reviewed_by TEXT, reviewed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

CREATE TABLE asset_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BLOB NOT NULL,
    uploaded_by INTEGER,
    uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
  );

CREATE TABLE sla_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      priority TEXT UNIQUE NOT NULL,
      response_minutes INTEGER NOT NULL,
      resolution_minutes INTEGER NOT NULL,
      escalation_percent INTEGER NOT NULL DEFAULT 80,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    );

CREATE TABLE kb_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'BookOpen',
      color TEXT DEFAULT 'blue',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

CREATE TABLE kb_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      summary TEXT,
      category_id INTEGER,
      tags TEXT,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
      is_known_error INTEGER NOT NULL DEFAULT 0,
      workaround TEXT,
      author_id INTEGER,
      author_name TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      helpful_yes INTEGER NOT NULL DEFAULT 0,
      helpful_no INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE kb_article_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      old_content TEXT,
      new_content TEXT,
      changed_by_id INTEGER,
      changed_by_name TEXT,
      changed_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE
    );

CREATE TABLE kb_article_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      linked_by_id INTEGER,
      linked_by_name TEXT,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(article_id, ticket_id),
      FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

CREATE TABLE kb_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      helpful INTEGER NOT NULL,
      voted_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(article_id, user_id),
      FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

CREATE TABLE user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    granted_by_id INTEGER,
    granted_by_name TEXT,
    granted_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(user_id, permission_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE gdpr_processing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      data_categories TEXT,
      purpose TEXT,
      legal_basis TEXT,
      data_subjects TEXT,
      recipients TEXT,
      retention_period TEXT,
      security_measures TEXT,
      data_location TEXT,
      is_sensitive INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      updated_by TEXT
    );

CREATE TABLE configuration_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE,
      type TEXT NOT NULL CHECK(type IN (
        'server', 'vm', 'application', 'database',
        'network_device', 'service', 'endpoint'
      )),
      description TEXT,
      status TEXT NOT NULL DEFAULT 'En service',
      environment TEXT DEFAULT 'Production',
      location TEXT,
      owner TEXT,
      criticality TEXT NOT NULL DEFAULT 'Standard',
      asset_id INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    );

CREATE TABLE ci_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      child_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL CHECK(relation_type IN (
        'depends_on', 'hosts', 'runs_on', 'connects_to', 'part_of'
      )),
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(parent_id, child_id, relation_type),
      FOREIGN KEY (parent_id) REFERENCES configuration_items(id) ON DELETE CASCADE,
      FOREIGN KEY (child_id) REFERENCES configuration_items(id) ON DELETE CASCADE
    );

CREATE TABLE ticket_cis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      ci_id INTEGER NOT NULL,
      is_primary INTEGER NOT NULL DEFAULT 0,
      linked_by_id INTEGER,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(ticket_id, ci_id),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (ci_id) REFERENCES configuration_items(id) ON DELETE CASCADE
    );

CREATE TABLE problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      symptoms TEXT,
      root_cause TEXT,
      workaround TEXT,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN (
        'new', 'analyzing', 'known_error', 'resolved', 'closed'
      )),
      priority TEXT NOT NULL DEFAULT 'Moyenne',
      category TEXT,
      assigned_to TEXT,
      detected_at TEXT DEFAULT (datetime('now', 'localtime')),
      resolved_at TEXT,
      kb_article_id INTEGER,
      created_by INTEGER,
      created_by_name TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (kb_article_id) REFERENCES kb_articles(id) ON DELETE SET NULL
    );

CREATE TABLE problem_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      problem_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      linked_by_id INTEGER,
      linked_by_name TEXT,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(problem_id, ticket_id),
      FOREIGN KEY (problem_id) REFERENCES problems(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

CREATE TABLE user_notifications_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    notify_ticket_assigned INTEGER NOT NULL DEFAULT 1,
    notify_status_changed INTEGER NOT NULL DEFAULT 1,
    notify_new_comment INTEGER NOT NULL DEFAULT 1,
    notify_sla_exceeded INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

CREATE TABLE service_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      icon TEXT DEFAULT 'Package',
      color TEXT DEFAULT 'blue',
      form_fields TEXT,
      sla_hours INTEGER DEFAULT 24,
      requires_approval INTEGER NOT NULL DEFAULT 1,
      approver_role TEXT DEFAULT 'admin',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    );

CREATE TABLE service_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      ticket_id INTEGER,
      requester_id INTEGER NOT NULL,
      form_data TEXT,
      status TEXT NOT NULL DEFAULT 'pending_approval' CHECK(status IN (
        'pending_approval', 'approved', 'rejected', 'delivered'
      )),
      approved_by INTEGER,
      approved_at TEXT,
      rejection_reason TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
      FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      change_type TEXT NOT NULL DEFAULT 'normal' CHECK(change_type IN ('standard', 'normal', 'emergency')),
      category TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN (
        'draft', 'analyzing', 'pending_approval', 'scheduled',
        'in_progress', 'implemented', 'rolled_back', 'closed'
      )),
      priority TEXT NOT NULL DEFAULT 'Moyenne',
      risk_level TEXT DEFAULT 'medium' CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
      impact_analysis TEXT,
      affected_cis TEXT,
      requested_by INTEGER,
      assigned_to INTEGER,
      approved_by INTEGER,
      approved_at TEXT,
      rejection_reason TEXT,
      scheduled_start TEXT,
      scheduled_end TEXT,
      implementation_plan TEXT,
      rollback_plan TEXT,
      implemented_at TEXT,
      closed_at TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT,
      FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE change_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      change_id INTEGER NOT NULL,
      ticket_id INTEGER NOT NULL,
      linked_by INTEGER,
      linked_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(change_id, ticket_id),
      FOREIGN KEY (change_id) REFERENCES changes(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    );

CREATE TABLE suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      contract_type TEXT,
      contract_start TEXT,
      contract_end TEXT,
      status TEXT DEFAULT 'Actif' CHECK(status IN ('Actif', 'Inactif', 'En attente')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

CREATE TABLE supplier_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      uploaded_by INTEGER,
      uploaded_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE risks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      probability INTEGER NOT NULL CHECK(probability BETWEEN 1 AND 5),
      impact INTEGER NOT NULL CHECK(impact BETWEEN 1 AND 5),
      score INTEGER GENERATED ALWAYS AS (probability * impact) VIRTUAL,
      mitigation_plan TEXT,
      owner TEXT,
      status TEXT DEFAULT 'Ouvert' CHECK(status IN ('Ouvert', 'En cours', 'Mitigé', 'Clos')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT
    );

CREATE TABLE sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

CREATE TABLE floors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

CREATE TABLE rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Bureau', 'Magasin', 'Salle de réunion', 'Salle d''opération', 'Autre')),
      code TEXT UNIQUE,
      capacity INTEGER DEFAULT 1,
      FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
    );

CREATE TABLE physical_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('Lit', 'Table de travail')),
      name TEXT NOT NULL,
      unique_code TEXT UNIQUE NOT NULL,
      room_id INTEGER,
      status TEXT DEFAULT 'Disponible' CHECK(status IN ('Disponible', 'Occupé', 'En maintenance', 'Hors service')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
    );

CREATE TABLE resource_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      booking_date TEXT NOT NULL,
      slot TEXT NOT NULL CHECK(slot IN ('Matin', 'Après-midi', 'Journée complète')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')), patient_name TEXT, patient_dob TEXT, start_date TEXT, end_date TEXT,
      UNIQUE(resource_id, booking_date, slot),
      FOREIGN KEY (resource_id) REFERENCES physical_resources(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

CREATE TABLE patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_code TEXT UNIQUE NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT CHECK(gender IN ('M', 'F', 'Autre')),
      phone TEXT,
      address TEXT,
      nir TEXT,
      blood_type TEXT,
      allergies TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

CREATE TABLE visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER,
      reason TEXT,
      status TEXT DEFAULT 'En attente' CHECK(status IN ('En attente', 'En consultation', 'Terminé', 'Annulé')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      started_at TEXT,
      finished_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      medication TEXT NOT NULL,
      dosage TEXT,
      duration TEXT,
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Terminée', 'Annulée')),
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

CREATE TABLE exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      exam_type TEXT NOT NULL,
      status TEXT DEFAULT 'En attente' CHECK(status IN ('En attente', 'En cours', 'Résultat disponible')),
      result_notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')), file_data BLOB, file_name TEXT,
      FOREIGN KEY (record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

CREATE TABLE medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      visit_id INTEGER,
      doctor_id INTEGER NOT NULL,
      chief_complaint TEXT,
      diagnosis TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
    );

CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
  );

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_code TEXT NOT NULL,
    PRIMARY KEY (role_id, permission_code),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_code) REFERENCES permissions(code) ON DELETE CASCADE
  );

