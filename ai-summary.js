/*
MediKiosk AI Summary client configuration.
The doctor dashboard calls the authenticated server endpoint directly.
Do NOT put a real API key in this file.
*/
window.MEDIKIOSK_AI_CONFIG = Object.assign({
  enabled: true,
  endpoint: "/api/doctors/patient/:id/ai-summary"
}, window.MEDIKIOSK_AI_CONFIG || {});
