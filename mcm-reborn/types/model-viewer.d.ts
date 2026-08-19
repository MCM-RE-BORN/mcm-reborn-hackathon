import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  alt?: string;
  "auto-rotate"?: boolean;
  "camera-controls"?: boolean;
  "camera-orbit"?: string;
  class?: string;
  "environment-image"?: string;
  "interaction-prompt"?: "auto" | "none";
  "interaction-prompt-style"?: "basic" | "wiggle";
  "interaction-prompt-threshold"?: string;
  loading?: "auto" | "eager" | "lazy";
  "rotation-per-second"?: string;
  "shadow-intensity"?: string;
  src?: string;
  "touch-action"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}
