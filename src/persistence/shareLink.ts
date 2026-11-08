/**
 * Share a circuit as a link: the circuit (and an optional note shown to whoever
 * opens it) is compressed into the address itself, after #/editor?c=. There is
 * no server: whoever has the link has the circuit. Used to send a usability
 * task, or a circuit to a friend.
 */
import { parseCircuit } from '../model';
import type { Circuit } from '../model';

const PARAM = 'c';

interface Payload {
  v: 1;
  c: Circuit;
  /** Note shown in the "what you learn here" box. */
  l?: string;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}

/** The compressed text that goes into the link. */
export async function encodeShare(circuit: Circuit, note?: string): Promise<string> {
  const payload: Payload = { v: 1, c: circuit, ...(note?.trim() ? { l: note.trim() } : {}) };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  return toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
}

export type SharedResult = { ok: true; circuit: Circuit; note: string | null } | { ok: false; error: string };

export async function decodeShare(data: string): Promise<SharedResult> {
  try {
    const bytes = await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Payload>;
    if (payload.v !== 1 || !payload.c) return { ok: false, error: 'הקישור לא מכיל מעגל.' };
    const parsed = parseCircuit(JSON.stringify(payload.c));
    if (!parsed.ok) return { ok: false, error: `המעגל בקישור לא תקין: ${parsed.errors.join('; ')}` };
    return { ok: true, circuit: parsed.circuit, note: typeof payload.l === 'string' ? payload.l : null };
  } catch {
    return { ok: false, error: 'הקישור פגום או חלקי. אולי הוא נחתך כשהועתק?' };
  }
}

/** Full address of the shared circuit, on the page we are on now. */
export function shareUrl(data: string, location: { origin: string; pathname: string } = window.location): string {
  return `${location.origin}${location.pathname}#/editor?${PARAM}=${data}`;
}

/** The shared data in an address hash (#/editor?c=…), or null. */
export function sharedData(hash: string): string | null {
  const q = hash.indexOf('?');
  if (q < 0) return null;
  return new URLSearchParams(hash.slice(q + 1)).get(PARAM);
}
