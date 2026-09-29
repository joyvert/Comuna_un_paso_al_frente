// Utilidad para limpiar y formatear números de teléfono para enlaces de WhatsApp
export function formatWhatsAppUrl(telefono, mensaje = "") {
  if (!telefono) return null;
  // Quitar caracteres no numéricos
  let digits = String(telefono).replace(/\D/g, "");
  
  if (!digits) return null;

  // Si empieza por 0 (ej: 04141234567, 0424..., 0412...), convertir a código de país de Venezuela (58)
  if (digits.startsWith("0")) {
    digits = "58" + digits.substring(1);
  } else if (!digits.startsWith("58") && digits.length === 10) {
    // Si tiene 10 dígitos sin el 0 (ej: 4141234567)
    digits = "58" + digits;
  }

  const encodedMsg = mensaje ? `?text=${encodeURIComponent(mensaje)}` : "";
  return `https://wa.me/${digits}${encodedMsg}`;
}
