// src/utils/medicalDocsGenerator.js
// Génération des documents médicaux complémentaires :
// - Bon d'examen
// - Compte-rendu de consultation
// - Arrêt de travail
// - Certificat médical
//
// Utilise la même charte graphique que pdfGenerator.js (ordonnance)

import { jsPDF } from 'jspdf';

/* ---------- Helpers visuels (repris de pdfGenerator.js) ---------- */

const safe = (v) => (v === null || v === undefined ? '' : String(v).trim());

const formatDate = (d) => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const ageFromBirth = (birth) => {
  if (!birth) return null;
  const b = new Date(birth);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
};

const drawHeader = (doc, etab, title) => {
  const pageW = doc.internal.pageSize.getWidth();
  const e = etab || {};
  const nom = safe(e.nom) || 'Hôpital Alpha';
  const adresse = safe(e.adresse);
  const tel = safe(e.telephone);

  // Bandeau bleu
  doc.setFillColor(30, 90, 160);
  doc.rect(0, 0, pageW, 22, 'F');

  // Nom de l'établissement
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(nom, 14, 14);

  // Coordonnées
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const coord = [adresse, tel].filter(Boolean).join('  •  ');
  if (coord) doc.text(coord, 14, 19.5);

  // Titre du document
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, pageW / 2, 32, { align: 'center' });
};

const drawPatientBlock = (doc, patient, startY = 38) => {
  const pageW = doc.internal.pageSize.getWidth();
  const boxY = startY;
  const boxH = 24;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, boxY, pageW - 28, boxH, 2, 2);

  const p = patient || {};
  const nomComplet = `${safe(p.last_name)} ${safe(p.first_name)}`.trim() || '—';
  const age = ageFromBirth(p.dob);
  const sexe = safe(p.gender) === 'M' ? 'Masculin' : safe(p.gender) === 'F' ? 'Féminin' : '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Patient', 18, boxY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(nomComplet, 40, boxY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Âge', 18, boxY + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(age !== null ? `${age} ans` : '—', 40, boxY + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Sexe', 100, boxY + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(sexe || '—', 118, boxY + 13);

  doc.setFont('helvetica', 'bold');
  doc.text('Code', 18, boxY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(safe(p.patient_code) || '—', 40, boxY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text('Né(e) le', 100, boxY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(p.dob), 118, boxY + 20);

  return boxY + boxH + 8;
};

const drawSignature = (doc, medecin, startY) => {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = medecin || {};

  const sigY = Math.min(startY, pageH - 45);
  const sigW = 70;
  const sigX = pageW - 14 - sigW;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(sigX, sigY + 22, sigX + sigW, sigY + 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(safe(m.nom) || 'Le Médecin', sigX + sigW / 2, sigY + 27, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (safe(m.specialite)) {
    doc.text(safe(m.specialite), sigX + sigW / 2, sigY + 31.5, { align: 'center' });
  }
};

const drawFooter = (doc) => {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Document généré électroniquement — valable pour une seule délivrance.',
    pageW / 2, pageH - 10, { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);
};

const drawDate = (doc, y) => {
  const today = new Date().toLocaleDateString('fr-FR');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Fait le ${today}`, 14, y);
};

/* ================================================================
   DOCUMENT 1 : BON D'EXAMEN
   ================================================================ */

export function generateBonExamen(patient, exam, medecin, etablissement, options = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(doc, etablissement, "BON D'EXAMEN");
  let y = drawPatientBlock(doc, patient);

  // Détails de l'examen
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text("Examen demandé", 14, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 90, 160);
  doc.text(safe(exam.exam_type) || '—', 20, y);
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Notes / Instructions
  if (safe(exam.notes)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Notes / Instructions', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(safe(exam.notes), pageW - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5;
  }

  // Date
  drawDate(doc, y + 15);

  // Signature
  drawSignature(doc, medecin, y + 40);

  drawFooter(doc);

  const filename = `bon-examen_${safe(patient.patient_code) || patient.last_name}_${Date.now()}.pdf`;
  if (options.download) doc.save(filename);
  else if (options.print !== false) {
    doc.autoPrint?.();
    window.open(doc.output('bloburl'), '_blank');
  }
  return doc;
}

/* ================================================================
   DOCUMENT 2 : COMPTE-RENDU DE CONSULTATION
   ================================================================ */

export function generateCompteRendu(patient, record, medecin, etablissement, options = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(doc, etablissement, 'COMPTE-RENDU DE CONSULTATION');
  let y = drawPatientBlock(doc, patient);

  // Motif
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Motif de consultation', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const motif = doc.splitTextToSize(safe(record.chief_complaint) || '—', pageW - 28);
  doc.text(motif, 14, y);
  y += motif.length * 5 + 4;

  // Diagnostic
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Diagnostic', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const diag = doc.splitTextToSize(safe(record.diagnosis) || '—', pageW - 28);
  doc.text(diag, 14, y);
  y += diag.length * 5 + 4;

  // Observations
  if (safe(record.notes)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Observations', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notes = doc.splitTextToSize(safe(record.notes), pageW - 28);
    doc.text(notes, 14, y);
    y += notes.length * 5;
  }

  drawDate(doc, y + 20);
  drawSignature(doc, medecin, y + 45);
  drawFooter(doc);

  const filename = `compte-rendu_${safe(patient.patient_code) || patient.last_name}_${record.id}.pdf`;
  if (options.download) doc.save(filename);
  else if (options.print !== false) {
    doc.autoPrint?.();
    window.open(doc.output('bloburl'), '_blank');
  }
  return doc;
}

/* ================================================================
   DOCUMENT 3 : ARRÊT DE TRAVAIL
   ================================================================ */

export function generateArretTravail(patient, data, medecin, etablissement, options = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(doc, etablissement, 'ARRÊT DE TRAVAIL');
  let y = drawPatientBlock(doc, patient);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Je soussigné, Docteur en Médecine, certifie avoir examiné :', 14, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text(`${safe(patient.first_name)} ${safe(patient.last_name)}`, 20, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Né(e) le ${formatDate(patient.dob)}`, 20, y);
  y += 12;

  doc.text('et prescris un arrêt de travail pour :', 14, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.text(safe(data.reason) || 'Raison médicale', 20, y);
  y += 12;

  // Dates
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  doc.setFont('helvetica', 'normal');
  doc.text(`Du : ${formatDate(startDate)}`, 20, y);
  doc.text(`Au : ${formatDate(endDate)}`, 110, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text(`Soit ${days} jour(s) d'arrêt.`, 20, y);
  y += 12;

  if (safe(data.authorized_exits)) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Sorties autorisées : ${safe(data.authorized_exits)}`, 20, y);
    y += 6;
  }

  drawDate(doc, 230);
  drawSignature(doc, medecin, 240);
  drawFooter(doc);

  const filename = `arret-travail_${safe(patient.patient_code) || patient.last_name}_${Date.now()}.pdf`;
  if (options.download) doc.save(filename);
  else if (options.print !== false) {
    doc.autoPrint?.();
    window.open(doc.output('bloburl'), '_blank');
  }
  return doc;
}

/* ================================================================
   DOCUMENT 4 : CERTIFICAT MÉDICAL
   ================================================================ */

export function generateCertificat(patient, data, medecin, etablissement, options = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  drawHeader(doc, etablissement, 'CERTIFICAT MÉDICAL');
  let y = drawPatientBlock(doc, patient);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Je soussigné, Docteur en Médecine, certifie avoir examiné :', 14, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text(`${safe(patient.first_name)} ${safe(patient.last_name)}`, 20, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.text(`Né(e) le ${formatDate(patient.dob)}`, 20, y);
  y += 12;

  doc.text('et certifie que :', 14, y);
  y += 7;

  const contentLines = doc.splitTextToSize(safe(data.content) || '—', pageW - 28);
  doc.text(contentLines, 20, y);
  y += contentLines.length * 5 + 8;

  doc.setFont('helvetica', 'bold');
  doc.text(`Certificat établi pour : ${safe(data.purpose) || '—'}`, 20, y);
  y += 15;

  drawDate(doc, 230);
  drawSignature(doc, medecin, 240);
  drawFooter(doc);

  const filename = `certificat_${safe(patient.patient_code) || patient.last_name}_${Date.now()}.pdf`;
  if (options.download) doc.save(filename);
  else if (options.print !== false) {
    doc.autoPrint?.();
    window.open(doc.output('bloburl'), '_blank');
  }
  return doc;
}