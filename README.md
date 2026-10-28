# 🩺 HealthTicket — Plateforme de gestion sanitaire et ITSM

> **Solution intégrée** pour établissements de santé (cabinets, cliniques, hôpitaux) : **Dossier Patient Informatisé (DPI)**, gestion des tickets, assets, SLA, base de connaissances, et conformité réglementaire (Cameroun, Afrique, UE).

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-3.x-003B57?logo=sqlite&logoColor=white)
![Turso](https://img.shields.io/badge/Turso-Multi--tenant-4FF8D2?logo=turso&logoColor=black)
![Version](https://img.shields.io/badge/Version-2.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

---

## 📋 Table des matières

- [Description](#-description)
- [Fonctionnalités](#-fonctionnalités)
- [Conformité réglementaire](#-conformité-réglementaire)
- [Stack technique](#-stack-technique)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Utilisation](#-utilisation)
- [Architecture](#-architecture)
- [Roadmap](#-roadmap)
- [Auteur](#-auteur)
- [Licence](#-licence)

---

## 🎯 Description

**HealthTicket** est une plateforme **double** :
1. **Un Dossier Patient Informatisé (DPI)** pour les établissements de santé : gestion des patients, consultations, ordonnances, examens, lits et salle d'attente.
2. **Un système ITSM** (ITIL 4) pour le support technique : tickets, SLA, CMDB, problèmes, changements.

**Points forts :**
- ✅ **DPI fonctionnel** (patients, visites, prescriptions, examens, lits, salle d'attente)
- ✅ **ITSM complet** (9 modules : tickets, SLA, CMDB, problèmes, changements, KB, assets, catalogue, fournisseurs)
- ✅ **Multi-tenant** (Turso) avec isolation des données par établissement
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
- Permissions granulaires :
  - `kb.read`, `kb.write`, `kb.publish`
  - `assets.write`, `users.manage`, `logs.view`, `tickets.all`
  - `medical.read`, `patients.convert`
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
- Redirection automatique après login selon le rôle

### 📝 Logs et audit

- Journal d'audit de toutes les actions
- Revue formelle NIST AU-6 (marquage revu/non revu)
- Statistiques : taux de revue, dernier audit
- Filtres : action, entité, utilisateur, date
- Export CSV avec filtres temporels

### 🔒 Sécurité et conformité

- Chiffrement AES-256-GCM des champs sensibles (NIR, allergies, descriptions)
- Registre des traitements GDPR (article 30)
- Classification DORA/BAIT des incidents (7 critères)
- Fiche de notification DORA avec deadline 4h
- Import/Export patients chiffré avec journalisation
- Auto-documentation version Git au démarrage

### 📊 Dashboard admin

- Cartes de stats : Ouverts / En cours / Résolus / Urgents
- Performances SLA : conformité, MTTR, tickets menacés/dépassés
- Tickets critiques nécessitant attention
- Statistiques KB, CMDB, Problèmes

---

## 🔒 Conformité réglementaire

HealthTicket est conçu pour être **conforme** aux réglementations suivantes :

| Réglementation | Statut | Couverture |
|----------------|--------|------------|
| **Loi camerounaise n°2024/017** | 🟡 Partielle | Registre, chiffrement, journalisation ✅ · DPIA ❌ |
| **Loi camerounaise n°2010/012** | 🟡 Partielle | Contrôles techniques ✅ · Plan incidents ❌ |
| **Convention de Malabo (UA)** | 🟡 Partielle | Référentiel régional |
| **GDPR / RGPD (UE)** | 🟡 Partielle | Registre, chiffrement, droits ✅ · DPIA ❌ |
| **HIPAA (USA)** | 🟡 Partielle | Chiffrement ✅ · BAA ❌ · HTTPS ❌ |
| **MaRisk / BAIT (Allemagne)** | 🟡 Partielle | Contrôles techniques ✅ · Politique signée ❌ |
| **DORA (UE)** | 🟡 Partielle | Classification ✅ · Notification BaFin ❌ |
| **NIST SP 800-53** | 🟢 Bonne | 7 contrôles sur 12 couverts |
| **ISO/IEC 27001** | 🟡 Partielle | 4 domaines sur 8 couverts |

**⚠️ Aucune réglementation n'est à 100 % couverte.** Ce tableau est **honnête** et reflète l'état réel du projet.

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