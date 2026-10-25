// src/utils/pdfGenerator.js
// Génération d'ordonnances PDF côté frontend.
// Dépendances : jspdf, jspdf-autotable
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ---------- Helpers ---------- */

const safe = (v) => (v === null || v === undefined ? '' : String(v).trim());

const formatDate = (d) => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

const formatDateTime = (d) => {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
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

/* ---------- En-tête ---------- */

const drawHeader = (doc, etab) => {
  const pageW = doc.internal.pageSize.getWidth();
  const e = etab || {};
  const nom = safe(e.nom) || 'Hôpital Alpha';
  const adresse = safe(e.adresse);
  const tel = safe(e.telephone);

  // Bandeau
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

  doc.setTextColor(0, 0, 0);
};

/* ---------- Bloc patient ---------- */

const drawPatientBlock = (doc, patient, medecin, dateConsult) => {
  const pageW = doc.internal.pageSize.getWidth();
  const y0 = 30;

  // Titre
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ORDONNANCE MÉDICALE', pageW / 2, y0, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date : ${formatDateTime(dateConsult)}`, pageW - 14, y0, { align: 'right' });

  // Cadre patient
  const boxY = y0 + 6;
  const boxH = 26;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, boxY, pageW - 28, boxH, 2, 2);

  const p = patient || {};
  const nomComplet = `${safe(p.nom)} ${safe(p.prenom)}`.trim() || '—';
  const age = ageFromBirth(p.date_naissance);
  const sexe = safe(p.sexe) === 'M' ? 'Masculin'
             : safe(p.sexe) === 'F' ? 'Féminin' : '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
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
  doc.text('Né(e) le', 18, boxY + 20);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(p.date_naissance), 40, boxY + 20);

  if (safe(p.telephone)) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tél.', 100, boxY + 20);
    doc.setFont('helvetica', 'normal');
    doc.text(safe(p.telephone), 118, boxY + 20);
  }

  if (safe(p.adresse)) {
    doc.setFont('helvetica', 'bold');
    doc.text('Adresse', 18, boxY + 27);
    doc.setFont('helvetica', 'normal');
    doc.text(safe(p.adresse), 40, boxY + 27);
  }

  return boxY + boxH + 6;
};

/* ---------- Diagnostic + médicaments ---------- */

const drawBody = (doc, consultation, startY) => {
  const pageW = doc.internal.pageSize.getWidth();
  let y = startY;

  // Diagnostic
  if (safe(consultation.diagnostic)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Diagnostic', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const diagLines = doc.splitTextToSize(safe(consultation.diagnostic), pageW - 28);
    doc.text(diagLines, 14, y);
    y += diagLines.length * 5 + 4;
  }

  // Médicaments
  const meds = Array.isArray(consultation.medicaments) ? consultation.medicaments : [];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Prescription', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Médicament', 'Forme', 'Posologie', 'Durée', 'Quantité']],
    body: meds.map((m, i) => [
      i + 1,
      safe(m.nom) || '—',
      safe(m.forme),
      safe(m.posologie),
      safe(m.duree),
      safe(m.quantite),
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 90, 160], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      3: { cellWidth: 40 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 },
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // Notes
  if (safe(consultation.notes)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Recommandations', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(safe(consultation.notes), pageW - 28);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 4.5 + 4;
  }

  return y;
};

/* ---------- Signature / pied ---------- */

const drawFooter = (doc, medecin, startY) => {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = medecin || {};

  // Bloc signature à droite
  const sigY = Math.min(startY + 10, pageH - 50);
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
  if (safe(m.matricule)) {
    doc.text(`N° ${safe(m.matricule)}`, sigX + sigW / 2, sigY + 35.5, { align: 'center' });
  }

  // Pied de page
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'Document généré électroniquement — valable pour une seule délivrance.',
    pageW / 2, pageH - 10, { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);
};

/* ---------- Fonction principale ---------- */

/**
 * Génère et ouvre (ou télécharge) une ordonnance PDF.
 * @param {object} consultation - objet décrit dans la doc (§3)
 * @param {object} [options]
 * @param {boolean} [options.print=true]  - ouvre la boîte d'impression
 * @param {string}  [options.filename]    - nom du fichier si download
 * @param {boolean} [options.download=false] - télécharge au lieu d'imprimer
 */
export function generateOrdonnancePDF(consultation, options = {}) {
  const { print = true, download = false, filename } = options;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  drawHeader(doc, consultation.etablissement);

  const yPatient = drawPatientBlock(
    doc,
    consultation.patient,
    consultation.medecin,
    consultation.date || new Date()
  );

  const yBody = drawBody(doc, consultation, yPatient);

  drawFooter(doc, consultation.medecin, yBody);

  const safeName = `${safe(consultation.patient?.nom) || 'patient'}`
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const file = filename || `ordonnance_${safeName}_${Date.now()}.pdf`;

  if (download) {
    doc.save(file);
  } else if (print) {
    doc.autoPrint?.();
    const blobUrl = doc.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    doc.save(file);
  }

  return doc;
}

export default generateOrdonnancePDF;