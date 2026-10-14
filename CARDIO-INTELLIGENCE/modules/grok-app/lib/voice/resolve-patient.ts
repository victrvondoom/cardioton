import { users } from "@/lib/db/grok_app__lib_db__index";
import {
  buildPatientProfile,
  DEMO_PATIENT,
  type PatientProfile,
} from "@/lib/voice/patient-profile";

/**
 * Resolves the patient for a call from request input, relying on the database
 * as the source of truth for identity.
 *
 * Priority:
 *  1. A `phone` (what the client stores at signup) → look the real user up in
 *     the DB and use their stored name + stable id (memory key).
 *  2. An explicit `patientId` (e.g. "mary-demo") → the demo persona.
 *  3. Nothing → fall back to the demo persona so local testing still works.
 *
 * The returned profile's `id` is what keys long-term memory, and
 * `preferredName` is what the companion calls them out loud.
 */
export async function resolvePatientProfile(input: {
  phone?: string;
  patientId?: string;
  name?: string;
  companionName?: string;
}): Promise<PatientProfile> {
  const phone = input.phone?.trim();
  const companionName = input.companionName?.trim() || undefined;

  if (phone) {
    try {
      const user = await users.findByPhone(phone);
      if (user) {
        return buildPatientProfile({
          id: user.id,
          preferredName: user.name,
          companionName,
        });
      }
    } catch (err) {
      console.error("[resolvePatient] DB lookup failed:", err);
    }
    // Phone given but no DB row (or DB error). Still personalize with whatever
    // name we were handed, keyed by the phone so memory stays consistent.
    if (input.name?.trim()) {
      return buildPatientProfile({
        id: phone,
        preferredName: input.name.trim(),
        companionName,
      });
    }
  }

  if (input.patientId && input.patientId !== DEMO_PATIENT.id) {
    return buildPatientProfile({
      id: input.patientId,
      preferredName: input.name?.trim() || "there",
      companionName,
    });
  }

  // Demo / local fallback.
  return DEMO_PATIENT;
}
