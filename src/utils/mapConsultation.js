// src/utils/mapConsultation.js
// Mappe les données Turso (patient + record + prescriptions) vers le format PDF.

function safeJson(v, fallback = []) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return fallback; }
  }
  return fallback;
}

/**
 * @param {object} patient - objet patient (MedicalRecord.jsx)
 * @param {object} record  - objet consultation (r dans MedicalRecord.jsx)
 * @param {array}  prescriptions - liste brute depuis /records/:id/prescriptions
 * @param {object} doctor  - { name, specialite, matricule } (optionnel)
 */
export function mapConsultationToPdf(patient, record, prescriptions = [], doctor = {}) {
  const p = patient || {};
  const r = record || {};

  // Le patient a `gender` (pas `sexe`), `dob` (pas `date_naissance`)
  // Le record a `doctor_name`, `chief_complaint`, `diagnosis`, `notes`

  return {
    id: r.id,
    date: r.created_at || new Date(),
    diagnostic: r.diagnosis || '',
    motif: r.chief_complaint || '',
    notes: r.notes || '',

    patient: {
      nom: p.last_name || '',
      prenom: p.first_name || '',
      date_naissance: p.dob || '',
      sexe: p.gender === 'M' ? 'M' : p.gender === 'F' ? 'F' : '',
      telephone: p.phone || '',
      adresse: p.address || '',
      code: p.patient_code || '',
      allergies: p.allergies || '',
      blood_type: p.blood_type || '',
    },

    medecin: {
      nom: r.doctor_name || doctor.name || '',
      specialite: doctor.specialite || 'Médecin traitant',
      matricule: doctor.matricule || '',
    },

    medicaments: safeJson(prescriptions).map((m) => ({
      nom: m.medication || '',
      forme: m.forme || m.form || '',
      posologie: m.dosage || '',
      duree: m.duration || '',
      quantite: m.quantite || m.quantity || '',
    })),

    etablissement: {
      nom: 'Hôpital Alpha',
      adresse: 'Yaoundé, Cameroun',
      telephone: '+237 2 22 00 00 00',
    },
  };
}