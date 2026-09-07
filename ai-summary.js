/* Gemini AI Summary client configuration. No API key belongs here. */
window.MEDIKIOSK_AI_CONFIG = Object.assign({
  enabled: true,
  provider: "gemini",
  endpoint: "/api/doctors/patient/:id/ai-summary"
}, window.MEDIKIOSK_AI_CONFIG || {});
