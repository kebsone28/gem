/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

/**
 * SCHÉMA : Membre de Mission
 */
export const missionMemberSchema = z.object({
  name: z.string().min(2, 'Le nom est requis (min 2 caract.)'),
  role: z.string().min(2, 'Le rôle est requis'),
  unit: z.string().optional(),
  dailyIndemnity: z.number().min(0, "L'indemnité doit être positive"),
  days: z.number().min(1, "La durée doit être d'au moins 1 jour"),
});

/**
 * SCHÉMA : Informations de Base de la Mission
 */
export const missionFormSchema = z.object({
  orderNumber: z.string().min(3, "N° d'ordre invalide"),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format date invalide (JJ/MM/AAAA)'),
  region: z.string().min(2, 'La destination est requise'),
  purpose: z.string().min(5, "L'objet doit être détaillé (min 5 caract.)"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  transport: z.string().default('Véhicule de service'),
  itineraryAller: z.string().optional(),
  itineraryRetour: z.string().optional(),
  features: z
    .object({
      map: z.boolean().default(true),
      expenses: z.boolean().default(false),
      inventory: z.boolean().default(false),
      ai: z.boolean().default(false),
    })
    .optional(),
});

/**
 * SCHÉMA GLOBAL : Mission Complète
 */
export const missionSchema = z.object({
  formData: missionFormSchema,
  members: z.array(missionMemberSchema).min(1, 'Au moins un membre est requis'),
  planning: z.array(z.string()).optional(),
  version: z.number().int().positive(),
});

/**
 * UTILITAIRE : Validation avec Reporting d'Erreurs
 */
export const validateMission = (data: any) => {
  const result = missionSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.format();
    return { isValid: false, errors };
  }
  return { isValid: true, data: result.data };
};
