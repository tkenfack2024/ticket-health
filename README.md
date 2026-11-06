```markdown
# 🩺 HealthTicket — Plateforme de gestion sanitaire et ITSM

> **Solution intégrée** pour établissements de santé (cabinets, cliniques, hôpitaux) : **Dossier Patient Informatisé (DPI)**, gestion des tickets, assets, SLA, base de connaissances, et conformité réglementaire (Cameroun, Afrique, UE).

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-3.x-003B57?logo=sqlite&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-Multi--tenant-4FF8D2?logo=turso&logoColor=black)
![Version](https://img.shields.io/badge/Backend-1.4.0-brightgreen.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

---

## 📋 Table des matières

- [Description](#-description)
- [Fonctionnalités](#-fonctionnalités)
- [Conformité réglementaire](#-conformité-réglementaire)
- [Stack technique](#-stack-technique)
- [Installation](#-installation)
- [Architecture](#-architecture)
- [Tests automatisés](#-tests-automatisés)
- [Roadmap Produit](#-roadmap-produit)
- [Auteur](#-auteur)

---

## 🎯 Description

**HealthTicket** est une plateforme **double** :
1. **Un Dossier Patient Informatisé (DPI)** pour les établissements de santé : gestion des patients, consultations, ordonnances, examens, lits et salle d'attente.
2. **Un système ITSM** (ITIL 4) pour le support technique : tickets, SLA, CMDB, problèmes, changements.

**Points forts :**
- ✅ **DPI fonctionnel** (patients, visites, prescriptions, examens, lits, salle d'attente)
- ✅ **ITSM complet** (9 modules : tickets, SLA, CMDB, problèmes, changements, KB, assets, catalogue, fournisseurs)
- ✅ **Multi-tenant** (Turso) avec isolation stricte des données par établissement
- ✅ **Journalisation 100% Turso** (traçabilité NIST AU-2, AU-9)
- ✅ **Chiffrement AES-256-GCM** des données sensibles (NIR, allergies, descriptions)
- ✅ **Import/Export patients** chiffré avec détection de doublons
- ✅ **Conformité documentée** (Cameroun, Afrique, UE) — voir [COMPLIANCE.md](./COMPLIANCE.md)

---

## ✨ Fonctionnalités

### 🏥 Dossier Patient Informatisé (DPI)
- **Gestion des patients** : création, modification, suppression, recherche
- **Consultations** : motif, diagnostic, notes cliniques (chiffrées)
- **Ordonnances** : médicaments, dosage, durée, statut
- **Examens** : demandes, résultats, upload de fichiers (PDF, JPG)
- **Salle d'attente** : suivi des patients en attente de consultation
- **Suivi médical** : prescriptions actives, examens en cours
- **Lits & tables** : réservation, occupation, libération automatique (cron 6h)
- **Import/Export patients** : export chiffré, import avec dry-run, conversion CSV → .enc

### 🎫 Gestion des tickets (incidents + demandes)
- Création, modification, suppression de tickets
- Assignation aux techniciens
- Statuts : Ouvert → En cours → En attente client → Résolu → Clos
- Priorités : Basse / Moyenne / Haute / Urgente
- Commentaires avec auteur et horodatage
- Archivage (soft delete) avec restauration
- **SLA automatique** avec escalade à 80%

### ⏱️ Gestion des SLAs
- 4 politiques configurables (Urgente/Haute/Moyenne/Basse)
- Calcul automatique des deadlines
- Escalade automatique à 80% du SLA (cron toutes les 5 min)
- Pause SLA sur statut "En attente client"
- Badges colorés dans la liste et le détail
- Alertes email aux techniciens assignés
- Export CSV du rapport SLA

### 🗺️ CMDB (Configuration Management Database)
- 7 types de CIs : server, vm, application, database, network_device, service, endpoint
- CRUD complet avec criticités (Critique/Important/Standard)
- Relations typées : depends_on, hosts, runs_on, connects_to, part_of
- Analyse d'impact récursive (jusqu'à 3 niveaux)
- Liaison CI ↔ Ticket avec CI principal
- Chiffrement AES-256-GCM des notes

### 🐛 Gestion des problèmes (ITIL)
- Workflow ITIL 5 statuts : Nouveau → En analyse → Erreur connue → Résolu → Clos
- Regroupement de plusieurs tickets récurrents
- Cause racine + Workaround (chiffré)
- Création automatique d'article KEDB
- Liaison bidirectionnelle problèmes ↔ tickets

### 📚 Base de connaissances (KB + KEDB)
- Articles Markdown avec aperçu en direct (split view)
- Catégories dynamiques (Informatique, Médical, etc.)
- Tags et recherche full-text
- Votes 👍/👎 avec toggle
- KEDB (Known Error Database) avec workarounds
- Suggestions automatiques dans les tickets
- Historique des modifications

### 👥 Utilisateurs et permissions
- 3 rôles de base : admin / technicien / user
- Rôles métier personnalisés (Médecin, Infirmier, Secrétaire, etc.)
- Permissions granulaires
- Authentification JWT + bcrypt
- OTP par email (code à 6 chiffres, valable 5 min)
- Matrice de permissions éditable dans l'admin

### 📦 Assets (Hardware + Software)
- CRUD complet avec champs spécifiques
- Upload de fichiers BLOB (PDF, JPG, PNG, DOCX, XLSX, CSV — max 5 MB)
- Import CSV en masse avec modèle téléchargeable
- Sélecteur moderne avec recherche et filtres
- Badge "CI lié" si l'asset est un CI de la CMDB

### 👤 Portail Self-Service
- Layout simplifié (sans menu admin)
- Mes tickets : filtres Tous / En cours / Résolus
- Détail simplifié : commentaires, articles KB suggérés
- Confirmation de résolution par l'utilisateur
- Base de connaissances avec recherche et votes
- Catalogue de services (demandes)
- Réservation de tables/lits (desksharing)

### 📝 Logs et audit
- Journal d'audit de toutes les actions (SQLite + Turso)
- Revue formelle NIST AU-6 (marquage revu/non revu)
- Statistiques : taux de revue, dernier audit
- Filtres : action, entité, utilisateur, date
- Export CSV avec filtres temporels

### 🔒 Sécurité et conformité
- Chiffrement AES-256-GCM des champs sensibles
- Registre des traitements GDPR (article 30)
- Classification DORA/BAIT des incidents (7 critères)
- Fiche de notification DORA avec deadline 4h
- Import/Export patients chiffré avec journalisation
- Auto-documentation version Git au démarrage

---

## 🔒 Conformité réglementaire

| Réglementation | Statut | Couverture |
|----------------|--------|------------|
| **Loi camerounaise n°2024/017** | 🟡 Partielle | Registre, chiffrement, journalisation ✅ · DPIA ❌ |
| **Loi camerounaise n°2010/012** | 🟡 Partielle | Contrôles techniques ✅ · Plan incidents ❌ |
| **GDPR / RGPD (UE)** | 🟡 Partielle | Registre, chiffrement, droits ✅ · DPIA ❌ |
| **HIPAA (USA)** | 🟡 Partielle | Chiffrement ✅ · BAA ❌ · HTTPS ❌ |
| **DORA (UE)** | 🟡 Partielle | Classification, tiers ICT ✅ · Tests résilience ❌ |
| **NIST SP 800-53** | 🟢 Bonne | 8 contrôles sur 12 couverts (dont AU-2, AU-6, AU-9) |
| **ISO/IEC 27001** | 🟡 Partielle | 4 domaines sur 8 couverts |

📄 **Détail complet :** [COMPLIANCE.md](./COMPLIANCE.md)

---

## 🛠️ Stack technique

### Backend
- **Node.js 20+** + **Express 5**
- **SQLite 3** (better-sqlite3) + migrations automatiques
- **Turso** (LibSQL) pour le multi-tenant
- **JWT** (jsonwebtoken) + **bcryptjs**
- **Nodemailer** + Gmail pour les emails
- **Node-cron** pour les tâches planifiées (SLA, lits, backups)
- **Multer** pour les uploads de fichiers
- **Crypto natif** pour le chiffrement AES-256-GCM

### Frontend
- **React 19** + **Vite 8**
- **React Router 7**
- **Tailwind CSS 4**
- **Lucide React** pour les icônes
- **React Markdown** + **remark-gfm**
- **Recharts** pour les graphiques
- **jsPDF** + **html2canvas** pour les PDF

### Architecture
- **~25 tables** SQLite avec FK et migrations
- **~80 endpoints API** RESTful
- **Layouts séparés** admin / portail
- **Modules découplés** (auth.js, admin.js, sla.js, cmdb.js, patients.js, etc.)

---

## 📦 Installation

### Prérequis
- **Node.js 20+**
- **Git**
- **Gmail** avec mot de passe d'application

### 1. Cloner le projet
```bash
git clone https://github.com/TON-USERNAME/ticket-health.git
cd ticket-health
```

### 2. Backend
```bash
cd backend
npm install
# Créer un fichier .env avec les variables (voir .env.example)
node seed-test.js entreprise-alpha
node server.js
```

### 3. Frontend
```bash
cd ..  # retour à la racine
npm install
npm run dev
```

L'application est accessible sur `http://localhost:5173`.

---

## 🧪 Tests automatisés

Le projet dispose de **12 scripts de test API** pour valider le bon fonctionnement des routes et de la journalisation Turso.

Ils se lancent avec le serveur backend actif :
```bash
cd backend
node test-problems-api.js
node test-gdpr-api.js
node test-risks-api.js
# etc.
```

Chaque script teste un module complet (Créer → Modifier → Supprimer) et vérifie que les logs sont bien écrits sur Turso.

---

## 🚀 Roadmap Produit

### Phase 1 : Consolidation & Sécurité (Court terme)
- [ ] MFA Obligatoire (Admin, Médecin, Technicien)
- [ ] Finaliser le portail self-service en Turso
- [ ] Audit de sécurité OWASP ZAP

### Phase 2 : UX & IA (Moyen terme)
- [ ] Formulaire de signalement "3 clics" pour les soignants
- [ ] Classification automatique des tickets par IA
- [ ] Module "Quoi de neuf ?" (Changelog)

### Phase 3 : Métier & International (Long terme)
- [ ] CMDB Biomédicale (équipements médicaux)
- [ ] Liaison DPI ↔ Ticket (impact patient)
- [ ] API HL7 / FHIR

---

## 👤 Auteur

**Kenfack Ghislain** — Développeur Fullstack
- GitHub : [@tkenfack2024](https://github.com/tkenfack2024)

---

## 📄 Licence

MIT
```

---

### 🎯 3. Objectifs Prioritaires (Résumé exécutif)

Voici les objectifs à intégrer dans ton suivi de projet (Tu peux les copier dans ton outil de gestion de tâches comme Trello, Notion ou GitHub Projects).

**Légende :**
- 🔴 **P1 (Critique) :** À faire absolument, sécurité ou bugs bloquants.
- 🟠 **P2 (Important) :** Fort impact sur l'expérience utilisateur ou la compétitivité.
- 🟡 **P3 (Souhaitable) :** Amélioration continue.
- 🟢 **P4 (Optionnel) :** Nice-to-have, long terme.

| Priorité | Objectif | Catégorie | Effort |
| :--- | :--- | :--- | :--- |
| 🔴 **P1** | **MFA Obligatoire** (Authentification à deux facteurs) | Sécurité | Moyen |
| 🔴 **P1** | **Sécuriser migrations Turso** (retirer les `ALTER TABLE` du démarrage) | Technique | Faible |
| 🔴 **P1** | **Finaliser `portal.js` en Turso** (fin de la dette technique) | Technique | Moyen |
| 🔴 **P1** | **Mettre à jour `seed-catalog.js`** (activer les services par défaut) | Bug | Faible |
| 🟠 **P2** | **Formulaire "3 Clics"** (Photo + Loc + Envoi, sans champs ITIL) | UX | Moyen |
| 🟠 **P2** | **Classification IA des tickets** (Catégorie/Priorité auto) | IA | Moyen |
| 🟠 **P2** | **Module "Quoi de neuf ?"** (Changelog pour informer le personnel) | UX | Faible |
| 🟠 **P2** | **Suggestions KB intelligentes** (IA dans le formulaire) | IA | Moyen |
| 🟡 **P3** | **Assistant IA contextuel** (Résumé des longs tickets) | IA | Moyen |
| 🟡 **P3** | **Notifications Temps Réel (SSE)** (Dashboard & Salle d'attente) | UX/Tech | Moyen |
| 🟡 **P3** | **Liaison DPI ↔ Ticket** (Impact patient en cas de panne) | Métier | Élevé |
| 🟡 **P3** | **CMDB Biomédicale** (Lits, pousse-seringues, calibration) | Métier | Élevé |
| 🟢 **P4** | **Détection d'anomalies sur les logs** (Sécurité proactive) | IA/Sécurité | Élevé |
| 🟢 **P4** | **API HL7 / FHIR** (Intégration labos/radiologie) | Intégration | Très élevé |
