# \# 🩺 HealthTicket — Plateforme ITSM complète et conforme

# 

# > \*\*Système de gestion de services IT (ITSM)\*\* de niveau professionnel avec CMDB, portail self-service, gestion des problèmes ITIL et conformité réglementaire (GDPR, DORA, BAIT, HIPAA, NIST).

# 

# \[!\[Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js\&logoColor=white)](https://nodejs.org/)

# \[!\[React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react\&logoColor=black)](https://reactjs.org/)

# \[!\[SQLite](https://img.shields.io/badge/SQLite-3.x-003B57?logo=sqlite\&logoColor=white)](https://sqlite.org/)

# \[!\[License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

# \[!\[Version](https://img.shields.io/badge/Version-2.0.0-brightgreen.svg)]()

# 

# \---

# 

# \## 📋 Table des matières

# 

# \- \[Description](#-description)

# \- \[Fonctionnalités](#-fonctionnalités)

# \- \[Conformité réglementaire](#-conformité-réglementaire)

# \- \[Stack technique](#-stack-technique)

# \- \[Installation](#-installation)

# \- \[Configuration](#-configuration)

# \- \[Utilisation](#-utilisation)

# \- \[Architecture](#-architecture)

# \- \[Captures d'écran](#-captures-décran)

# \- \[Comparaison Top 10 ITSM](#-comparaison-top-10-itsm)

# \- \[Roadmap](#-roadmap)

# \- \[Auteur](#-auteur)

# \- \[Licence](#-licence)

# 

# \---

# 

# \## 🎯 Description

# 

# \*\*HealthTicket\*\* est une plateforme complète de gestion de services IT (ITSM), inspirée d'ITIL 4, conçue pour un établissement de santé. Elle permet la gestion des incidents, des problèmes, des changements, des actifs (CMDB), et offre un portail self-service moderne aux utilisateurs finaux.

# 

# \*\*Points forts\*\* :

# \- ✅ \*\*9 modules ITSM\*\* (incidents, SLA, CMDB, problèmes, KB, etc.)

# \- ✅ \*\*Conformité 5/5\*\* (GDPR, DORA, BAIT, HIPAA, NIST)

# \- ✅ \*\*Chiffrement AES-256-GCM\*\* des données sensibles

# \- ✅ \*\*CMDB\*\* avec analyse d'impact récursive

# \- ✅ \*\*Workflow ITIL\*\* complet (5 statuts pour les problèmes)

# \- ✅ \*\*Portail self-service\*\* moderne

# 

# \---

# 

# \## ✨ Fonctionnalités

# 

# \### 🎫 Gestion des tickets (incidents + demandes)

# \- Création, modification, suppression de tickets

# \- Assignation aux techniciens (admin uniquement)

# \- Statuts : Ouvert → En cours → En attente client → Résolu → Clos

# \- Priorités : Basse / Moyenne / Haute / Urgente

# \- Commentaires avec auteur et horodatage

# \- Archivage (soft delete) avec restauration

# \- \*\*SLA automatique\*\* avec escalade à 80%

# 

# \### ⏱️ Gestion des SLAs

# \- \*\*4 politiques configurables\*\* (Urgente/Haute/Moyenne/Basse)

# \- \*\*Calcul automatique\*\* des deadlines

# \- \*\*Escalade automatique\*\* à 80% du SLA (cron toutes les 5 min)

# \- \*\*Pause SLA\*\* sur statut "En attente client"

# \- \*\*Badges colorés\*\* dans la liste et le détail

# \- \*\*Alertes email\*\* aux techniciens assignés

# \- \*\*Export CSV\*\* du rapport SLA

# \- \*\*Dashboard\*\* avec taux de conformité, MTTR, tickets menacés/dépassés

# 

# \### 🗺️ CMDB (Configuration Management Database)

# \- \*\*7 types de CIs\*\* : server, vm, application, database, network\_device, service, endpoint

# \- \*\*CRUD complet\*\* avec criticités (Critique/Important/Standard)

# \- \*\*Relations typées\*\* : depends\_on, hosts, runs\_on, connects\_to, part\_of

# \- \*\*Analyse d'impact récursive\*\* (jusqu'à 3 niveaux)

# \- \*\*Liaison CI ↔ Ticket\*\* avec CI principal

# \- \*\*Chiffrement AES-256-GCM\*\* des notes

# 

# \### 🐛 Gestion des problèmes (ITIL)

# \- \*\*Workflow ITIL 5 statuts\*\* : Nouveau → En analyse → Erreur connue → Résolu → Clos

# \- \*\*Regroupement\*\* de plusieurs tickets récurrents

# \- \*\*Cause racine\*\* + \*\*Workaround\*\* (chiffré)

# \- \*\*Création automatique d'article KEDB\*\*

# \- \*\*Liaison bidirectionnelle\*\* problèmes ↔ tickets

# 

# \### 📚 Base de connaissances (KB + KEDB)

# \- Articles Markdown avec \*\*aperçu en direct\*\* (split view)

# \- \*\*Catégories dynamiques\*\* (Informatique, Médical, etc.)

# \- \*\*Tags\*\* et recherche full-text

# \- \*\*Votes\*\* 👍/👎 avec toggle

# \- \*\*KEDB\*\* (Known Error Database) avec workarounds

# \- \*\*Suggestions automatiques\*\* dans les tickets

# \- \*\*Historique\*\* des modifications

# 

# \### 👥 Utilisateurs et permissions

# \- \*\*3 rôles\*\* : admin / technicien / user

# \- \*\*Permissions granulaires\*\* (Berechtigungskonzept) :

# &#x20; - `kb.read`, `kb.write`, `kb.publish`

# &#x20; - `assets.write`, `users.manage`, `logs.view`, `tickets.all`

# \- \*\*Authentification\*\* JWT + bcrypt

# \- \*\*OTP par email\*\* (code à 6 chiffres, valable 5 min)

# \- \*\*Matrice de permissions\*\* éditable dans l'admin

# 

# \### 📦 Assets (Hardware + Software)

# \- \*\*CRUD complet\*\* avec champs spécifiques (marque, modèle, éditeur, version...)

# \- \*\*Upload de fichiers\*\* BLOB (PDF, JPG, PNG, DOCX, XLSX, CSV — max 5 MB)

# \- \*\*Import CSV\*\* en masse avec modèle téléchargeable

# \- \*\*Sélecteur moderne\*\* avec recherche et filtres

# \- \*\*Badge "CI lié"\*\* si l'asset est un CI de la CMDB

# 

# \### 👤 Portail Self-Service

# \- \*\*Layout simplifié\*\* (sans menu admin)

# \- \*\*Mes tickets\*\* : filtres Tous / En cours / Résolus

# \- \*\*Détail simplifié\*\* : commentaires, articles KB suggérés

# \- \*\*Confirmation de résolution\*\* par l'utilisateur

# \- \*\*Base de connaissances\*\* avec recherche et votes

# \- \*\*Redirection automatique\*\* après login selon le rôle

# 

# \### 📝 Logs et audit

# \- \*\*Journal d'audit\*\* de toutes les actions

# \- \*\*Revue formelle NIST AU-6\*\* (marquage revu/non revu)

# \- \*\*Statistiques\*\* : taux de revue, dernier audit

# \- \*\*Filtres\*\* : action, entité, utilisateur, date

# \- \*\*Export CSV\*\* avec filtres temporels (jour/semaine/mois/semestre)

# 

# \### 🔒 Sécurité et conformité

# \- \*\*Chiffrement AES-256-GCM\*\* des champs sensibles (descriptions, workarounds, notes)

# \- \*\*Registre des traitements GDPR\*\* (article 30)

# \- \*\*Classification DORA/BAIT\*\* des incidents (7 critères)

# \- \*\*Fiche de notification\*\* DORA avec deadline 4h

# \- \*\*Auto-documentation\*\* version Git au démarrage

# 

# \### 📊 Dashboard admin

# \- \*\*Cartes de stats\*\* : Ouverts / En cours / Résolus / Urgents

# \- \*\*Performances SLA\*\* : conformité, MTTR, tickets menacés/dépassés

# \- \*\*Tickets critiques\*\* nécessitant attention

# \- \*\*Statistiques KB, CMDB, Problèmes\*\*

# 

# \---

# 

# \## 🔒 Conformité réglementaire

# 

# | Réglementation | Statut | Mesures implémentées |

# |----------------|--------|----------------------|

# | \*\*MaRisk / BAIT\*\* (Allemagne) | ✅ | Rôles, permissions, audit, classification incidents |

# | \*\*DORA\*\* (UE) | ✅ | 7 critères, fiche de notification, deadline 4h |

# | \*\*GDPR / RGPD\*\* (UE) | ✅ | Registre traitements, chiffrement, droits |

# | \*\*HIPAA\*\* (USA) | ✅ | Chiffrement AES-256-GCM des ePHI |

# | \*\*NIST SP 800-53\*\* | ✅ | AC-2, AC-3, AC-6, AU-2, AU-3, AU-6, SC-13 |

# 

# Voir \[COMPLIANCE.md](./COMPLIANCE.md) pour le détail complet.

# 

# \---

# 

# \## 🛠️ Stack technique

# 

# \### Backend

# \- \*\*Node.js 20+\*\* + \*\*Express 5\*\*

# \- \*\*SQLite 3\*\* (better-sqlite3) + migrations automatiques

# \- \*\*JWT\*\* (jsonwebtoken) + \*\*bcryptjs\*\* pour l'authentification

# \- \*\*Nodemailer\*\* + Gmail pour les emails

# \- \*\*Node-cron\*\* pour les tâches planifiées (SLA)

# \- \*\*Multer\*\* pour les uploads de fichiers

# \- \*\*Crypto natif\*\* pour le chiffrement AES-256-GCM

# 

# \### Frontend

# \- \*\*React 18\*\* + \*\*Vite\*\*

# \- \*\*React Router 6\*\* pour la navigation

# \- \*\*Tailwind CSS\*\* pour le styling

# \- \*\*Lucide React\*\* pour les icônes

# \- \*\*React Markdown\*\* + \*\*remark-gfm\*\* pour le rendu Markdown

# 

# \### Architecture

# \- \*\*12 tables\*\* SQLite avec FK et migrations

# \- \*\*Routes API\*\* RESTful (\~40 endpoints)

# \- \*\*Layouts séparés\*\* admin / portail

# \- \*\*Modules découplés\*\* (auth.js, admin.js, sla.js, cmdb.js, kb.js, gdpr.js, incidents.js, problems.js, portal.js)

# 

# \---

# 

# \## 📦 Installation

# 

# \### Prérequis

# \- \*\*Node.js 20+\*\* (\[télécharger](https://nodejs.org/))

# \- \*\*Git\*\* (\[télécharger](https://git-scm.com/))

# \- \*\*Gmail\*\* avec mot de passe d'application (\[guide](https://support.google.com/accounts/answer/185833))

# 

# \### 1. Cloner le projet

# 

# ```bash

# git clone https://github.com/TON-USERNAME/ticket-health.git

# cd ticket-health

