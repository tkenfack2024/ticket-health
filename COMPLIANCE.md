\# HealthTicket — Document de Conformité



\*\*Version :\*\* 1.0

\*\*Dernière mise à jour :\*\* 17 octobre 2026

\*\*Statut :\*\* Document de travail — en cours de mise en conformité



\---



\## 1. Vue d'ensemble



\*\*HealthTicket\*\* est une plateforme ITSM (IT Service Management) permettant la gestion des tickets, des assets, des utilisateurs et de la base de connaissances pour un établissement de santé.



Ce document a pour objectif de :

\- Recenser les réglementations applicables

\- Documenter l'état de conformité actuel

\- Identifier les mesures en place et manquantes

\- Définir une roadmap de mise en conformité



\*\*Périmètre :\*\* l'application HealthTicket (backend Node.js/Express, frontend React, base SQLite).



\---



\## 2. Réglementations applicables



| Réglementation | Zone | Domaine | Applicabilité |

|----------------|------|---------|---------------|

| \*\*MaRisk / BAIT\*\* | Allemagne | Secteur financier | ⚠️ Applicable si usage financier |

| \*\*DORA\*\* | UE | Résilience opérationnelle numérique | ⚠️ Applicable si services numériques critiques |

| \*\*GDPR / RGPD\*\* | UE | Protection des données personnelles | ✅ \*\*Applicable\*\* (données personnelles traitées) |

| \*\*HIPAA\*\* | USA | Données de santé | ⚠️ Applicable si patientèle américaine |

| \*\*NIST SP 800-53\*\* | USA | Contrôles de sécurité | ✅ Recommandé (référentiel international) |

| \*\*ISO/IEC 27001\*\* | International | Système de management de la sécurité | ✅ Recommandé |



\*\*Légende :\*\*

\- ✅ = Applicable et actuellement en cours

\- ⚠️ = Applicable sous conditions

\- ❌ = Non applicable



\---



\## 3. Mesures techniques en place



\### 3.1 Authentification et gestion des accès



| Mesure | Implémentation | Réglementation couverte |

|--------|----------------|-------------------------|

| \*\*Authentification JWT\*\* | Tokens signés (bcrypt + JWT) | GDPR, NIST AC-2 |

| \*\*OTP par email\*\* | Code à 6 chiffres, expiration 5 min | GDPR, NIST IA-2 |

| \*\*Rôles\*\* | admin / technicien / user | NIST AC-2, AC-3 |

| \*\*Permissions granulaires\*\* | Table `user\_permissions` | NIST AC-6, BAIT Berechtigung |

| \*\*Politique de mot de passe\*\* | Minimum 6 caractères | NIST IA-5 |

| \*\*Session expirable\*\* | JWT avec expiration 7 jours | NIST AC-12 |



\### 3.2 Journalisation et audit



| Mesure | Implémentation | Réglementation couverte |

|--------|----------------|-------------------------|

| \*\*Journal d'activité\*\* | Table `logs` (create/update/delete/login) | NIST AU-2, AU-3 |

| \*\*Horodatage\*\* | `datetime('now', 'localtime')` | NIST AU-8 |

| \*\*Traçabilité utilisateur\*\* | `user\_id` + `user\_name` dans chaque log | NIST AU-9 |

| \*\*Logs système\*\* | Démarrage, escalades SLA, envoi d'emails | NIST AU-6 |



\### 3.3 Gestion des incidents et SLA



| Mesure | Implémentation | Réglementation couverte |

|--------|----------------|-------------------------|

| \*\*Tickets avec cycle de vie\*\* | Ouvert → En cours → En attente client → Résolu | ITIL 4 |

| \*\*Politiques SLA\*\* | Response + Resolution par priorité | ITIL 4, NIST SI-4 |

| \*\*Escalade automatique\*\* | Cron job toutes les 5 min à 80% du SLA | NIST SI-4, BAIT |

| \*\*Pause SLA\*\* | Statut "En attente client" | ITIL 4 |

| \*\*Notifications email\*\* | Alerte à l'escalade | NIST SI-4 |



\### 3.4 Gestion des changements et de la connaissance



| Mesure | Implémentation | Réglementation couverte |

|--------|----------------|-------------------------|

| \*\*Base de connaissances\*\* | Articles Markdown avec catégories | ITIL 4 Knowledge Management |

| \*\*KEDB\*\* | Known Error Database avec workarounds | ITIL 4 |

| \*\*Historique des modifications\*\* | Table `kb\_article\_history` | NIST AU-9, BAIT |

| \*\*Suggestions automatiques\*\* | Basées sur mots-clés du ticket | ITIL 4 |



\### 3.5 Archivage et rétention



| Mesure | Implémentation | Réglementation couverte |

|--------|----------------|-------------------------|

| \*\*Archivage des tickets\*\* | Soft delete (`archived = 1`) | GDPR (conservation) |

| \*\*Restauration\*\* | Possibilité de restaurer | ITIL 4 |

| \*\*Suppression définitive\*\* | Réservée aux admins | GDPR (droit à l'effacement) |



\### 3.6 Auto-documentation



| Mesure | Implémentation | Réglementation couverte |

|--------|----------------|-------------------------|

| \*\*Version système\*\* | `package.json` + commit Git | NIST CM-8 |

| \*\*Log de démarrage\*\* | Version + hash commit + auteur | NIST CM-2, CM-3 |



\---



\## 4. Mesures partielles ou manquantes



\### 4.1 Points critiques à implémenter



| Mesure | Statut | Priorité | Point plan |

|--------|--------|----------|------------|

| \*\*Registre des traitements GDPR\*\* | ❌ Absent | 🔴 Haute | Point 2 |

| \*\*Revue formelle des logs\*\* | ❌ Absent | 🔴 Haute | Point 3 |

| \*\*Classification incidents DORA/BAIT\*\* | ⚠️ Partiel | 🟡 Moyenne | Point 4 |

| \*\*Chiffrement champs sensibles\*\* | ❌ Absent | 🔴 Haute | Point 5 |



\### 4.2 Mesures à prévoir (roadmap long terme)



| Mesure | Réglementation | Effort |

|--------|----------------|--------|

| \*\*Politique de sécurité\*\* signée | BAIT, NIST | 🟡 Moyen |

| \*\*Analyse de risque formelle\*\* | BAIT, DORA, NIST RA-3 | 🔴 Élevé |

| \*\*Registre des tiers ICT\*\* | DORA | 🔴 Élevé |

| \*\*Tests de résilience\*\* | DORA | 🔴 Élevé |

| \*\*Notification incidents majeurs\*\* | DORA | 🔴 Élevé |

| \*\*DPIA\*\* (Data Protection Impact Assessment) | GDPR | 🔴 Élevé |

| \*\*DPA avec sous-traitants\*\* | GDPR | 🟡 Moyen |

| \*\*Chiffrement DB au repos\*\* | HIPAA, NIST | 🟢 Faible (roadmap) |

| \*\*Revue périodique des accès\*\* | NIST AC-2 | 🟡 Moyen |

| \*\*Plan de réponse aux incidents\*\* | NIST IR-4 | 🟡 Moyen |



\---



\## 5. Conformité par réglementation



\### 5.1 MaRisk / BAIT (Allemagne)



\*\*Applicabilité :\*\* ⚠️ Si HealthTicket est utilisé dans un contexte financier ou régulé en Allemagne.



\*\*Mesures en place :\*\*

\- ✅ Gestion des accès par rôle

\- ✅ Permissions granulaires

\- ✅ Journal d'audit

\- ✅ Documentation de version



\*\*Mesures manquantes :\*\*

\- ❌ Politique de sécurité formelle

\- ❌ Analyse de risque documentée

\- ❌ Rapport périodique à la direction

\- ❌ Schutzbedarfsfeststellung (détermination des besoins de protection)

\- ❌ Gestion des menaces et vulnérabilités



\*\*Roadmap :\*\*

1\. Rédiger une politique de sécurité (3 mois)

2\. Implémenter le processus d'analyse de risque (6 mois)

3\. Mettre en place le reporting à la direction (3 mois)



\### 5.2 DORA (UE)



\*\*Applicabilité :\*\* ⚠️ Si HealthTicket est utilisé comme service numérique critique dans l'UE.



\*\*Mesures en place :\*\*

\- ✅ Documentation des incidents (via tickets)

\- ✅ Journal d'audit

\- ✅ SLA et escalade



\*\*Mesures manquantes :\*\*

\- ❌ Classification formelle des incidents majeurs (critères DORA)

\- ❌ Notification à l'autorité (BaFin) en 3 étapes

\- ❌ Registre des prestataires ICT tiers

\- ❌ Tests de résilience annuels

\- ❌ Fonction de contrôle ICT indépendante



\*\*Roadmap :\*\*

1\. Ajouter la classification DORA aux tickets (point 4) — 1 mois

2\. Créer le registre des tiers (3 mois)

3\. Mettre en place le reporting à l'autorité (6 mois)



\### 5.3 GDPR / RGPD (UE)



\*\*Applicabilité :\*\* ✅ \*\*HealthTicket traite des données personnelles\*\* (noms, emails, descriptions de tickets pouvant contenir des données sensibles).



\*\*Mesures en place :\*\*

\- ✅ Authentification sécurisée

\- ✅ Contrôle d'accès (rôles + permissions)

\- ✅ Journalisation des accès

\- ✅ Suppression possible des données (archivage + suppression définitive)

\- ✅ Minimisation des données (seuls les champs nécessaires)



\*\*Mesures manquantes :\*\*

\- ❌ Registre des traitements (article 30)

\- ❌ Droit d'accès formel (Subject Access Request)

\- ❌ Droit à l'effacement formalisé (article 17)

\- ❌ Droit à la portabilité (article 20)

\- ❌ Politique de rétention des données

\- ❌ Chiffrement des données sensibles au repos

\- ❌ DPA avec sous-traitants (Gmail pour OTP)

\- ❌ DPIA (si traitements à risque)



\*\*Roadmap :\*\*

1\. Créer le registre des traitements (point 2) — 1 semaine

2\. Implémenter les droits GDPR (2 mois)

3\. Documenter le DPA Gmail (1 mois)



\### 5.4 HIPAA (USA)



\*\*Applicabilité :\*\* ⚠️ Si HealthTicket traite des données de santé de patients américains ou d'entités couvertes par HIPAA.



\*\*Mesures en place :\*\*

\- ✅ Contrôle d'accès basé sur les rôles

\- ✅ Journalisation des actions



\*\*Mesures manquantes :\*\*

\- ❌ Chiffrement des ePHI (Electronic Protected Health Information)

\- ❌ BAA (Business Associate Agreement) avec Gmail

\- ❌ Timeout automatique de session

\- ❌ Chiffrement en transit (HTTPS — actuellement HTTP)

\- ❌ Plan de réponse aux incidents HIPAA

\- ❌ Formation du personnel documentée



\*\*Roadmap :\*\*

1\. Chiffrer les champs sensibles (point 5) — 2 mois

2\. Migrer vers HTTPS (1 semaine)

3\. Signer les BAA avec les fournisseurs (1 mois)



\### 5.5 NIST SP 800-53 (USA / International)



\*\*Applicabilité :\*\* ✅ Recommandé comme référentiel international pour tout système d'information.



\*\*Mesures en place (sur les contrôles de base) :\*\*

\- ✅ AC-2 : Account Management

\- ✅ AC-6 : Least Privilege

\- ⚠️ AC-3 : Access Enforcement (partiel)

\- ⚠️ AU-2 : Audit Events (partiel)

\- ✅ AU-3 : Content of Audit Records



\*\*Mesures manquantes :\*\*

\- ❌ AU-6 : Audit Review, Analysis, Reporting

\- ❌ RA-3 : Risk Assessment

\- ❌ CA-7 : Continuous Monitoring

\- ❌ IR-4 : Incident Handling (processus formel)

\- ❌ CP-2 : Contingency Plan



\*\*Roadmap :\*\*

1\. Implémenter la revue des logs (point 3) — 2 semaines

2\. Documenter le plan de réponse aux incidents (2 mois)

3\. Mettre en place le monitoring continu (3 mois)



\---



\## 6. Processus de mise à jour



Ce document doit être :

\- \*\*Revu\*\* trimestriellement (au moins)

\- \*\*Mis à jour\*\* à chaque nouvelle fonctionnalité

\- \*\*Versionné\*\* via Git

\- \*\*Approuvé\*\* par la direction



\*\*Responsable :\*\* Responsable IT / RSSI

\*\*Fréquence :\*\* Trimestrielle minimum



\---



\## 7. Contact et escalade



Pour toute question relative à la conformité :



\- \*\*Responsable IT :\*\* \[À compléter]

\- \*\*RSSI / DPO :\*\* \[À compléter]

\- \*\*Direction :\*\* \[À compléter]



\---



\## 8. Historique du document



| Version | Date | Changements | Auteur |

|---------|------|-------------|--------|

| 1.0 | 17/10/2026 | Version initiale | Équipe HealthTicket |



\---



\*\*Document en cours de construction.\*\* Les sections marquées ❌ font l'objet de chantiers en cours.



\*\*Prochaine mise à jour prévue :\*\* \[À définir]

