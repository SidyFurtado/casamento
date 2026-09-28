/**
 * Integration boundary. The UI only consumes { status, message }.
 * Replace this adapter after the external guest system contract is supplied.
 * That system owns validation, WhatsApp delivery and guest code issuance.
 * Do not persist guest input or manufacture a success/code in the preview.
 * Future printable codes must use the code issued by that system.
 */
export const rsvpService = Object.freeze({
  mode: 'preview',
  async submit(_guest) {
    return {
      status: 'unavailable',
      message: 'Esta é só uma prévia. Nenhum dado foi enviado e sua presença ainda não foi confirmada. As confirmações serão abertas em breve.',
    };
  },
});
