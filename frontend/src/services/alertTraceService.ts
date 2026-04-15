/**
 * SERVICE : AlertTraceService (Axe 3 — Plan d'Amélioration Continue GEM-SAAS)
 * Enregistrement du statut de livraison des alertes SMS/Email pour la traçabilité
 * juridique et l'audit des notifications envoyées aux prestataires terrain.
 */

import { db } from '../store/db';

export type AlertChannel = 'SMS' | 'EMAIL' | 'WHATSAPP' | 'PUSH';
export type AlertStatus = 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING';

export interface AlertTrace {
  id: string;
  pvId?: string;             // Lien vers le PV généré
  householdId?: string;      // Lien vers le ménage concern
  projectId?: string;
  type: string;              // Type de PV (PVNC, PVR, PVHSE...)
  channel: AlertChannel;
  recipient: string;         // Numéro ou email du destinataire
  message: string;           // Corps du message envoyé
  status: AlertStatus;
  sentAt: string;
  deliveredAt?: string;
  errorReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Enregistre une trace d'alerte dans Dexie pour auditabilité complète.
 * Cette trace peut être consultée pour prouver qu'une notification a bien
 * été émise en cas de contestation contractuelle.
 */
export const traceAlert = async (
  alert: Omit<AlertTrace, 'id' | 'sentAt'>
): Promise<AlertTrace> => {
  const trace: AlertTrace = {
    ...alert,
    id: crypto.randomUUID(),
    sentAt: new Date().toISOString(),
  };

  // Stocker dans la table notifications avec un type 'system'
  await db.notifications.add({
    id: trace.id,
    projectId: trace.projectId,
    missionId: trace.pvId,
    type: 'system',
    title: `[${trace.channel}] ${trace.type} → ${trace.recipient}`,
    message: `Statut: ${trace.status} | ${trace.message.slice(0, 100)}...`,
    sender: 'AlertTraceService',
    createdAt: trace.sentAt,
    read: false,
    archived: false,
  });

  return trace;
};

/**
 * Simule l'envoi SMS via un prestataire Twilio/AfricasTalking (architecture offline-first).
 * En production, remplacer le simulateur par un vrai appel API backend.
 */
export const sendSMSAlert = async (params: {
  pvId: string;
  householdId: string;
  projectId: string;
  pvType: string;
  phoneNumber: string;
  message: string;
}): Promise<AlertTrace> => {
  const { pvId, householdId, projectId, pvType, phoneNumber, message } = params;

  // Simuler un délai réseau (en prod: appel à /api/notifications/sms)
  await new Promise((r) => setTimeout(r, 800));

  // Simuler un succès dans 90% des cas
  const success = Math.random() > 0.1;

  const trace = await traceAlert({
    pvId,
    householdId,
    projectId,
    type: pvType,
    channel: 'SMS',
    recipient: phoneNumber,
    message,
    status: success ? 'SENT' : 'FAILED',
    errorReason: success ? undefined : 'Numéro invalide ou réseau indisponible',
    metadata: {
      provider: 'AfricasTalking',
      simulated: true,
      timestamp: Date.now(),
    },
  });

  return trace;
};

/**
 * Simule l'envoi Email via SendGrid/MailerSend.
 */
export const sendEmailAlert = async (params: {
  pvId: string;
  householdId: string;
  projectId: string;
  pvType: string;
  email: string;
  subject: string;
  body: string;
}): Promise<AlertTrace> => {
  const { pvId, householdId, projectId, pvType, email, subject, body } = params;

  await new Promise((r) => setTimeout(r, 600));

  const success = Math.random() > 0.05;

  const trace = await traceAlert({
    pvId,
    householdId,
    projectId,
    type: pvType,
    channel: 'EMAIL',
    recipient: email,
    message: `Objet: ${subject} | ${body.slice(0, 100)}`,
    status: success ? 'SENT' : 'FAILED',
    errorReason: success ? undefined : 'Adresse email invalide',
    metadata: {
      provider: 'SendGrid',
      subject,
      simulated: true,
    },
  });

  return trace;
};

/**
 * Envoie une double notification (SMS + Email) et retourne les deux traces.
 * Point d'entrée principal pour le déclenchement automatique depuis PVAutomation.
 */
export const dispatchPVAlerts = async (params: {
  pvId: string;
  householdId: string;
  projectId: string;
  pvType: string;
  phoneNumber?: string;
  email?: string;
  prestataireName?: string;
  numerolot?: string;
}): Promise<{ smsTrace?: AlertTrace; emailTrace?: AlertTrace }> => {
  const {
    pvId,
    householdId,
    projectId,
    pvType,
    phoneNumber,
    email,
    prestataireName = 'Prestataire',
    numerolot = '—',
  } = params;

  const result: { smsTrace?: AlertTrace; emailTrace?: AlertTrace } = {};

  const message =
    `[GEM-PROQUELEC] PV ${pvType} emis pour le lot ${numerolot}. ` +
    `Veuillez consulter votre espace GEM pour les details et actions requises.`;

  if (phoneNumber) {
    result.smsTrace = await sendSMSAlert({
      pvId,
      householdId,
      projectId,
      pvType,
      phoneNumber,
      message,
    });
  }

  if (email) {
    result.emailTrace = await sendEmailAlert({
      pvId,
      householdId,
      projectId,
      pvType,
      email,
      subject: `[URGENT] PV ${pvType} — Lot ${numerolot} — Action requise`,
      body: `Bonjour ${prestataireName},\n\nUn procès-verbal de type ${pvType} a été automatiquement généré pour le lot ${numerolot}. Veuillez prendre connaissance du document et y apposer votre signature dans les meilleurs délais.\n\nCordialement,\nLa Direction PROQUELEC`,
    });
  }

  return result;
};
