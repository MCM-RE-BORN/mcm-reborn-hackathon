import type * as React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src: string;
        poster?: string;
        alt?: string;
        'environment-image'?: string;
        'camera-controls'?: boolean | '';
        'auto-rotate'?: boolean | '';
        'camera-orbit'?: string;
        'camera-target'?: string;
        'field-of-view'?: string;
        'interaction-prompt'?: string;
        loading?: 'auto' | 'lazy' | 'eager';
        reveal?: 'auto' | 'interaction' | 'manual';
      };
    }
  }
}
