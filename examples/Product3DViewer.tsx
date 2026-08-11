'use client';

import '@google/model-viewer';
import { useEffect, useRef } from 'react';

export type Product3D = {
  url: string;
  posterUrl: string;
  environmentImageUrl?: string | null;
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
  autoRotate: boolean;
};

type ModelViewerElement = HTMLElement & {
  variantName?: string | null;
};

export function Product3DViewer({
  model,
  selectedVariant,
  alt,
}: {
  model: Product3D;
  selectedVariant?: string | null;
  alt: string;
}) {
  const ref = useRef<ModelViewerElement | null>(null);

  useEffect(() => {
    if (ref.current && selectedVariant) {
      ref.current.variantName = selectedVariant;
    }
  }, [selectedVariant]);

  return (
    <model-viewer
      ref={ref}
      src={model.url}
      poster={model.posterUrl}
      environment-image={model.environmentImageUrl ?? undefined}
      camera-controls
      auto-rotate={model.autoRotate ? '' : undefined}
      camera-orbit={model.cameraOrbit}
      camera-target={model.cameraTarget}
      field-of-view={model.fieldOfView}
      interaction-prompt="auto"
      loading="lazy"
      reveal="interaction"
      alt={alt}
      style={{ width: '100%', height: 'min(70vh, 720px)' }}
    />
  );
}
