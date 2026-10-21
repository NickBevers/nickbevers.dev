'use client';

import { Button, FieldLabel, useDocumentInfo, useField } from '@payloadcms/ui';
import type { UIFieldClientComponent } from 'payload';
import { useId, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

import { cropPreviews } from '../../lib/crops';
import styles from './FocalPointField.module.css';

type Variant = { format?: string; width?: number; url?: string };

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** A processed variant is far lighter than the original upload, which can be 20 MB. */
function previewSource(doc: Record<string, unknown> | undefined): string | undefined {
  const variants = (Array.isArray(doc?.variants) ? doc.variants : []) as Variant[];
  const webp = variants
    .filter((variant) => variant.format === 'webp' && variant.url)
    .toSorted((a, b) => (a.width || 0) - (b.width || 0));
  const variant = webp.find((item) => (item.width || 0) >= 780) || webp.at(-1);
  return variant?.url || (typeof doc?.url === 'string' ? doc.url : undefined);
}

export const FocalPointField: UIFieldClientComponent = () => {
  const { initialData, savedDocumentData } = useDocumentInfo();
  const focalX = useField<number>({ path: 'focalX' });
  const focalY = useField<number>({ path: 'focalY' });
  const [dragging, setDragging] = useState(false);
  const id = useId();

  const src = previewSource(savedDocumentData || initialData);
  const x = typeof focalX.value === 'number' ? focalX.value : 50;
  const y = typeof focalY.value === 'number' ? focalY.value : 50;

  const setPoint = (nextX: number, nextY: number) => {
    focalX.setValue(clamp(nextX));
    focalY.setValue(clamp(nextY));
  };

  const setFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPoint(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  };

  // The arrow keys already change a number input by 1. Shift makes it 10.
  const bigStep = (axis: 'x' | 'y') => (event: KeyboardEvent<HTMLInputElement>) => {
    if (!event.shiftKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const step = event.key === 'ArrowUp' ? 10 : -10;
    setPoint(axis === 'x' ? x + step : x, axis === 'y' ? y + step : y);
  };

  return (
    <div className={styles.field}>
      <FieldLabel label="Focal point" />
      <p className={styles.description} id={`${id}-help`}>
        Click or drag on the image to mark what must stay in view when the site crops it, or type
        the position below. In the boxes, the arrow keys change the value and Shift makes bigger
        steps.
      </p>

      {src ? (
        <>
          {/* A pointer surface only. ARIA has no role for a two-axis control, so the number inputs
              below are the accessible way to set the same values. */}
          <div
            className={styles.frame}
            aria-hidden
            data-dragging={dragging || undefined}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragging(true);
              setFromPointer(event);
            }}
            onPointerMove={(event) => dragging && setFromPointer(event)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            <img className={styles.image} src={src} alt="" draggable={false} />
            <span className={styles.marker} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden />
          </div>

          <div className={styles.controls}>
            <label className={styles.number}>
              <span>From the left (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={x}
                aria-describedby={`${id}-help`}
                onKeyDown={bigStep('x')}
                onChange={(event) => setPoint(event.target.valueAsNumber || 0, y)}
              />
            </label>
            <label className={styles.number}>
              <span>From the top (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={y}
                aria-describedby={`${id}-help`}
                onKeyDown={bigStep('y')}
                onChange={(event) => setPoint(x, event.target.valueAsNumber || 0)}
              />
            </label>
            <Button buttonStyle="secondary" size="small" onClick={() => setPoint(50, 50)}>
              Reset to centre
            </Button>
          </div>

          {/* object-position puts the focal point at the same spot in every crop, so it never
              falls outside the frame. The site uses the same rule. */}
          <div className={styles.previews}>
            {cropPreviews.map((crop) => (
              <figure key={crop.label} className={styles.preview}>
                <div className={styles.crop} style={{ aspectRatio: crop.ratio }}>
                  <img src={src} alt="" style={{ objectPosition: `${x}% ${y}%` }} />
                </div>
                <figcaption>
                  {crop.label} <span>{crop.ratio.replaceAll(' ', '')}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.empty}>Save the upload first, then set the focal point here.</p>
      )}
    </div>
  );
};
