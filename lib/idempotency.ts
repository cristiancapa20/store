// Modulo plano (sin `server-only`): la clave se genera en el cliente, junto al
// ticket, porque debe sobrevivir a los reintentos del mismo ticket. Generarla
// en el servidor la ataria al clic y no deduplicaria nada.
export function newIdempotencyKey(): string {
  const webCrypto = globalThis.crypto as Crypto | undefined;
  // `randomUUID` solo existe en contexto seguro: un TPV servido por http sobre
  // una IP de la red local no lo tiene, y ahi la clave es justo lo que evita el
  // doble cobro. De ahi el respaldo.
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();

  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
