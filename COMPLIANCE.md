# HealthTicket — Document de Conformité

**Version :** 2.0
**Dernière mise à jour :** 28 octobre 2026
**Statut :** Document de travail — en cours de mise en conformité

---

## 1. Vue d'ensemble

**HealthTicket** est une plateforme ITSM (IT Service Management) permettant la gestion des tickets, des assets, des utilisateurs, de la base de connaissances et du Dossier Patient Informatisé (DPI) pour un établissement de santé.

Ce document a pour objectif de :
- Recenser les réglementations applicables
- Documenter l'état de conformité actuel
- Identifier les mesures en place et manquantes
- Définir une roadmap de mise en conformité

**Périmètre :** l'application HealthTicket (backend Node.js/Express, frontend React, base SQLite + Turso).

---

## 2. Réglementations applicables

### 2.1 Cadre africain et camerounais

| Réglementation | Zone | Domaine | Applicabilité |
|----------------|------|---------|---------------|
| **Loi n°2024/017** (Cameroun) | Cameroun | Protection des données personnelles | ✅ **Applicable** (données de santé incluses, Art. 19) |
| **Loi n°2010/012** (Cameroun) | Cameroun | Cybersécurité et cybercriminalité | ✅ **Applicable** |
| **Convention de Malabo** (Union Africaine) | Afrique | Cybersécurité et protection des données | ⚠️ **Applicable** (pas encore ratifiée par le Cameroun, référentiel régional) |

### 2.2 Cadre international

| Réglementation | Zone | Domaine | Applicabilité |
|----------------|------|---------|---------------|
| **GDPR / RGPD** | UE | Protection des données personnelles | ✅ **Applicable** (si patients UE) |
| **HIPAA** | USA | Données de santé | ⚠️ **Applicable** (si patientèle américaine) |
| **MaRisk / BAIT** | Allemagne | Secteur financier | ⚠️ **Applicable** (si usage financier) |
| **DORA** | UE | Résilience opérationnelle numérique | ⚠️ **Applicable** (si services numériques critiques) |
| **NIST SP 800-53** | USA | Contrôles de sécurité | ✅ **Recommandé** (référentiel international) |
| **ISO/IEC 27001** | International | Système de management de la sécurité | ✅ **Recommandé** |

**Légende :**
- ✅ = Applicable et actuellement en cours
- ⚠️ = Applicable sous conditions
- ❌ = Non applicable

---

## 3. Mesures techniques en place

### 3.1 Authentification et gestion des accès

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Authentification JWT** | Tokens signés (bcrypt + JWT) | Loi 2024/017, RGPD, NIST AC-2 |
| **OTP par email** | Code à 6 chiffres, expiration 5 min | Loi 2024/017, RGPD, NIST IA-2 |
| **Rôles** | admin / technicien / user | NIST AC-2, AC-3 |
| **Permissions granulaires** | Table `user_permissions` + `patients.convert` | NIST AC-6 |
| **Politique de mot de passe** | Minimum 6 caractères | NIST IA-5 |
| **Session expirable** | JWT avec expiration 7 jours | NIST AC-12 |

### 3.2 Journalisation et audit

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Journal d'activité** | Table `logs` (create/update/delete/login/export/import/convert) | Loi 2024/017 (Art. 37), RGPD, NIST AU-2, AU-3 |
| **Horodatage** | `datetime('now', 'localtime')` | NIST AU-8 |
| **Traçabilité utilisateur** | `user_id` + `user_name` dans chaque log | NIST AU-9 |
| **Logs système** | Démarrage, escalades SLA, envoi d'emails | NIST AU-6 |

### 3.3 Gestion des incidents et SLA

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Tickets avec cycle de vie** | Ouvert → En cours → En attente client → Résolu | ITIL 4 |
| **Politiques SLA** | Response + Resolution par priorité | ITIL 4, NIST SI-4 |
| **Escalade automatique** | Cron job toutes les 5 min à 80% du SLA | NIST SI-4 |
| **Pause SLA** | Statut "En attente client" | ITIL 4 |
| **Notifications email** | Alerte à l'escalade | NIST SI-4 |

### 3.4 Gestion des changements et de la connaissance

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Base de connaissances** | Articles Markdown avec catégories | ITIL 4 Knowledge Management |
| **KEDB** | Known Error Database avec workarounds | ITIL 4 |
| **Historique des modifications** | Table `kb_article_history` | NIST AU-9 |
| **Suggestions automatiques** | Basées sur mots-clés du ticket | ITIL 4 |

### 3.5 Archivage et rétention

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Archivage des tickets** | Soft delete (`archived = 1`) | Loi 2024/017, RGPD (conservation) |
| **Restauration** | Possibilité de restaurer | ITIL 4 |
| **Suppression définitive** | Réservée aux admins | Loi 2024/017, RGPD (droit à l'effacement) |

### 3.6 Auto-documentation

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Version système** | `package.json` + commit Git | NIST CM-8 |
| **Log de démarrage** | Version + hash commit + auteur | NIST CM-2, CM-3 |

### 3.7 Chiffrement et protection des données

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Chiffrement au repos (champs sensibles)** | AES-256-GCM (crypto natif Node.js) — **ACTIF** depuis le 28/10/2026 | Loi 2024/017 (Art. 36), RGPD, HIPAA, NIST SC-13 |
| **Champs chiffrés** | descriptions tickets, workarounds KEDB, NIR patients, allergies patients | Loi 2024/017, RGPD, HIPAA (ePHI) |
| **Clé de chiffrement** | Variable d'environnement `ENCRYPTION_KEY` (32 bytes hex) | NIST SC-12 |
| **Format de chiffrement** | [version:1][iv:12][authTag:16][ciphertext] | AES-GCM authentifié |
| **Rétrocompatibilité** | Détection auto (préfixe "ENC:") | — |

### 3.8 Registre des traitements GDPR

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Registre des traitements** | Table `gdpr_processing` (5 traitements seed) | Loi 2024/017 (Art. 35), RGPD Article 30 |
| **Interface admin** | Page `/admin` → onglet RGPD | Loi 2024/017, RGPD |
| **Export CSV** | Bouton "Exporter CSV" | RGPD |
| **CRUD complet** | Créer, modifier, supprimer | RGPD |

### 3.9 Classification des incidents (DORA/BAIT)

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Types d'incident** | Standard / Sécurité / Majeur | BAIT |
| **Critères DORA** | 7 critères configurables | DORA Article 18 |
| **Classification auto** | ≥ 2 critères = incident majeur | DORA |
| **Fiche de notification** | API `/api/incidents/:id/notification` | DORA (délai 4h) |

### 3.10 Revue des logs (NIST AU-6)

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Revue formelle** | Marquage "revu" par utilisateur | NIST AU-6 |
| **Traçabilité** | `reviewed_by`, `reviewed_at` | NIST AU-9 |
| **Statistiques** | Taux de revue, dernier audit | NIST AU-6 |
| **Action en masse** | Sélection multiple + marquage | NIST AU-6 |

### 3.11 Import/Export/Convert patients (nouveau — 28/10/2026)

| Mesure | Implémentation | Réglementation couverte |
|--------|----------------|-------------------------|
| **Export chiffré** | Fichier `.enc` (AES-256-GCM) avec mot de passe utilisateur | Loi 2024/017 (Art. 36), RGPD Art. 32 |
| **Import dry-run** | Aperçu (preview) avant validation | Loi 2024/017, RGPD Art. 5 (minimisation) |
| **Détection doublons** | `patient_code` + `nom + prénom + date naissance` | RGPD Art. 5 (exactitude) |
| **Transaction** | Insertion atomique en SQLite (`db.transaction`) | NIST SI-10 |
| **Journalisation** | Table `logs` : `export`, `import`, `convert` | Loi 2024/017 (Art. 37), RGPD Art. 30 |
| **Accès restreint** | `adminOnly` + permission `patients.convert` | Loi 2024/017, NIST AC-6 |
| **Pas de stockage serveur** | Stream direct au navigateur | Loi 2024/017, RGPD Art. 32 |
| **Conversion CSV → .enc** | Mapping FR → EN, chiffrement en mémoire | Loi 2024/017 (Art. 36) |

---

## 4. Mesures partielles ou manquantes

### 4.1 Points critiques — État actuel

| Mesure | Statut | Date | Détails |
|--------|--------|------|---------|
| **Registre des traitements** | ✅ **Implémenté** | 17/10/2026 | Article 30 RGPD, Art. 35 Loi 2024/017 |
| **Revue formelle des logs** | ✅ **Implémenté** | 17/10/2026 | NIST AU-6 |
| **Classification incidents DORA/BAIT** | ✅ **Implémenté** | 17/10/2026 | 7 critères DORA |
| **Chiffrement champs sensibles** | ✅ **Implémenté et actif** | 28/10/2026 | AES-256-GCM, clé en `.env` |
| **Import/Export/Convert patients** | ✅ **Implémenté** | 28/10/2026 | Chiffrement + journalisation + permission dédiée |

**Tous les points critiques sont maintenant couverts.** ✅

### 4.2 Mesures à prévoir (roadmap long terme)

| Mesure | Réglementation | Effort |
|--------|----------------|--------|
| **Politique de sécurité** signée | Loi 2024/017, BAIT, NIST | 🟡 Moyen |
| **Analyse de risque formelle** | Loi 2024/017, BAIT, DORA, NIST RA-3 | 🔴 Élevé |
| **Registre des tiers ICT** | DORA | 🔴 Élevé |
| **Tests de résilience** | DORA | 🔴 Élevé |
| **Notification incidents majeurs** | Loi 2024/017 (Art. 40), DORA | 🔴 Élevé |
| **DPIA** (Data Protection Impact Assessment) | Loi 2024/017 (Art. 38), RGPD | 🔴 Élevé |
| **DPA avec sous-traitants** | RGPD | 🟡 Moyen |
| **Chiffrement DB au repos** | HIPAA, NIST | 🟢 Faible (roadmap) |
| **Revue périodique des accès** | NIST AC-2 | 🟡 Moyen |
| **Plan de réponse aux incidents** | NIST IR-4 | 🟡 Moyen |
| **Déclaration à l'autorité camerounaise** | Loi 2024/017 | ⏳ En attente (autorité non opérationnelle) |

---

## 5. Conformité par réglementation

### 5.1 Loi camerounaise n°2024/017 (Protection des données)

**Applicabilité :** ✅ **Applicable** (données de santé incluses, Article 19).

**Mesures en place :**
- ✅ Registre des traitements (Art. 35)
- ✅ Chiffrement des données sensibles (Art. 36)
- ✅ Journalisation des accès (Art. 37)
- ✅ Notification des violations (Art. 40 — mécanisme en place via les logs)
- ✅ Droit d'accès et d'effacement (via archivage/suppression)

**Mesures manquantes :**
- ❌ DPIA formelle (Art. 38)
- ❌ Désignation d'un DPO (si requis)
- ⏳ Déclaration à l'autorité (en attente de l'opérationnalisation)
- ❌ Politique de rétention documentée

**Roadmap :**
1. Rédiger la DPIA (3 mois)
2. Documenter la politique de rétention (1 mois)
3. Préparer la déclaration à l'autorité (dès qu'elle est opérationnelle)

### 5.2 Loi camerounaise n°2010/012 (Cybersécurité)

**Applicabilité :** ✅ **Applicable**.

**Mesures en place :**
- ✅ Contrôle d'accès
- ✅ Journalisation
- ✅ Chiffrement
- ✅ Sauvegardes

**Mesures manquantes :**
- ❌ Plan de réponse aux incidents formel
- ❌ Tests d'intrusion documentés
- ❌ Sensibilisation du personnel

**Roadmap :**
1. Rédiger le plan de réponse aux incidents (2 mois)
2. Planifier un test d'intrusion (6 mois)

### 5.3 Convention de Malabo (Union Africaine)

**Applicabilité :** ⚠️ **Applicable** (référentiel régional, non ratifiée par le Cameroun).

**Mesures en place :**
- ✅ Les mêmes que pour la Loi 2024/017

**Mesures manquantes :**
- ❌ Coopération internationale formalisée
- ❌ Mécanisme de notification transfrontalier

### 5.4 GDPR / RGPD (UE)

**Applicabilité :** ✅ **Applicable** (si patients UE).

**Mesures en place :**
- ✅ Authentification sécurisée
- ✅ Contrôle d'accès
- ✅ Journalisation
- ✅ Chiffrement des données sensibles
- ✅ Registre des traitements
- ✅ Import/Export chiffré

**Mesures manquantes :**
- ❌ DPIA (Art. 35)
- ❌ DPA avec sous-traitants (Gmail, Turso, Render)
- ❌ Droit à la portabilité formel
- ❌ Politique de rétention documentée

### 5.5 HIPAA (USA)

**Applicabilité :** ⚠️ **Applicable** (si patientèle américaine).

**Mesures en place :**
- ✅ Chiffrement AES-256-GCM des ePHI (NIR, allergies)
- ✅ Journalisation
- ✅ Contrôle d'accès

**Mesures manquantes :**
- ❌ BAA (Business Associate Agreement) avec Gmail
- ❌ Timeout automatique de session (JWT 7 jours)
- ❌ HTTPS en production
- ❌ Plan de réponse aux incidents HIPAA
- ❌ Formation du personnel documentée

### 5.6 MaRisk / BAIT (Allemagne)

**Applicabilité :** ⚠️ **Applicable** (si usage financier).

**Mesures en place :**
- ✅ Gestion des accès par rôle
- ✅ Permissions granulaires
- ✅ Journal d'audit
- ✅ Classification des incidents

**Mesures manquantes :**
- ❌ Politique de sécurité formelle
- ❌ Analyse de risque documentée
- ❌ Schutzbedarfsfeststellung
- ❌ Gestion des menaces et vulnérabilités

### 5.7 DORA (UE)

**Applicabilité :** ⚠️ **Applicable** (si services numériques critiques).

**Mesures en place :**
- ✅ Classification des incidents (7 critères)
- ✅ Fiche de notification
- ✅ SLA et escalade

**Mesures manquantes :**
- ❌ Registre des prestataires ICT tiers
- ❌ Tests de résilience annuels
- ❌ Notification à l'autorité (BaFin)
- ❌ Fonction de contrôle ICT indépendante

### 5.8 NIST SP 800-53 (USA / International)

**Applicabilité :** ✅ **Recommandé**.

**Mesures en place :**
- ✅ AC-2 : Account Management
- ✅ AC-6 : Least Privilege
- ✅ AU-2 : Audit Events
- ✅ AU-3 : Content of Audit Records
- ✅ AU-6 : Audit Review, Analysis, Reporting
- ✅ SC-13 : Cryptographic Protection

**Mesures manquantes :**
- ❌ RA-3 : Risk Assessment
- ❌ CA-7 : Continuous Monitoring
- ❌ IR-4 : Incident Handling
- ❌ CP-2 : Contingency Plan

### 5.9 ISO/IEC 27001

**Applicabilité :** ✅ **Recommandé**.

**Mesures en place :**
- ✅ A.5 : Politiques de sécurité (partiel)
- ✅ A.9 : Contrôle d'accès
- ✅ A.12 : Sécurité des opérations
- ✅ A.18 : Conformité

**Mesures manquantes :**
- ❌ A.6 : Organisation de la sécurité
- ❌ A.8 : Gestion des actifs
- ❌ A.14 : Acquisition et développement
- ❌ A.16 : Gestion des incidents

---

## 6. Processus de mise à jour

Ce document doit être :
- **Revu** trimestriellement (au moins)
- **Mis à jour** à chaque nouvelle fonctionnalité
- **Versionné** via Git
- **Approuvé** par la direction

**Responsable :** Responsable IT / RSSI
**Fréquence :** Trimestrielle minimum

---

## 7. Contact et escalade

Pour toute question relative à la conformité :

- **Responsable IT :** [À compléter]
- **RSSI / DPO :** [À compléter]
- **Direction :** [À compléter]

---

## 8. Historique du document

| Version | Date | Changements | Auteur |
|---------|------|-------------|--------|
| 1.0 | 17/10/2026 | Version initiale | Équipe HealthTicket |
| 2.0 | 28/10/2026 | Ajout cadre camerounais (Loi 2024/017, Loi 2010/012) et africain (Malabo) ; ajout section Import/Export/Convert ; activation ENCRYPTION_KEY ; mise à jour honnête des statuts | Équipe HealthTicket |

---

**Document en cours de construction.** Les sections marquées ❌ font l'objet de chantiers en cours.

**Prochaine mise à jour prévue :** Janvier 2027