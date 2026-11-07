/** Demo response wording; emergency guidance follows Saskatchewan Health Authority.
 * https://www.saskhealthauthority.ca/your-health/conditions-illnesses-services-wellness/all-z/healthline-8-1-1
 */
export function safetyResponse(symptom: string): string {
  return /chest pain|breath|stroke|emergency/i.test(symptom)
    ? "Call 911 immediately for chest pain, breathing difficulty, or a possible emergency. Do not wait for a care-team callback."
    : "Please call HealthLine 811 or go to emergency. If you believe this is an emergency, call 911 immediately.";
}
