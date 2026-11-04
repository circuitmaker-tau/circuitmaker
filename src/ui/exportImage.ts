/**
 * Save the circuit or the timing diagram as a PNG image, for homework and
 * reports. The picture is drawn from the page itself (html-to-image), at twice
 * the screen resolution, on the editor's black background.
 */
import { getNodesBounds, getViewportForBounds } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import { toPng } from 'html-to-image';
import { fileNameFor } from '../persistence/persistence';

const BACKGROUND = '#000000';
const PADDING = 40;

function download(dataUrl: string, name: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const pngName = (circuitName: string, suffix: string) =>
  fileNameFor(circuitName).replace(/\.json$/, `${suffix}.png`);

/** The whole circuit, whatever part of it is in view. */
export async function exportCircuitImage(nodes: Node[], circuitName: string): Promise<void> {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || nodes.length === 0) return;
  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + 2 * PADDING);
  const height = Math.ceil(bounds.height + 2 * PADDING);
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, 1, 1, PADDING);
  const dataUrl = await toPng(viewport, {
    backgroundColor: BACKGROUND,
    width,
    height,
    pixelRatio: 2,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x}px, ${y}px) scale(${zoom})` },
  });
  download(dataUrl, pngName(circuitName, ''));
}

/** The timing diagram with its labels, the whole time span (not only what is scrolled into view). */
export async function exportTimingImage(circuitName: string): Promise<void> {
  const body = document.querySelector<HTMLElement>('.timing-body');
  if (!body) return;
  body.classList.add('is-exporting');
  try {
    // as tall as the signals, not the panel
    const svg = body.querySelector('svg');
    const height = Math.ceil(svg?.getBoundingClientRect().height ?? body.scrollHeight);
    const dataUrl = await toPng(body, {
      backgroundColor: BACKGROUND,
      pixelRatio: 2,
      width: body.scrollWidth,
      height,
    });
    download(dataUrl, pngName(circuitName, '-timing'));
  } finally {
    body.classList.remove('is-exporting');
  }
}
