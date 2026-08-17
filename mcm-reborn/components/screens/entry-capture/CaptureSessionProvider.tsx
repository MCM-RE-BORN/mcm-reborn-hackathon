"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEMO_SCENARIO } from "@/data/demo-scenario";
import type { CaptureSlotId } from "./capture-config";

export type CaptureAsset = {
  blob: Blob;
  fileName: string;
  previewUrl: string;
};

export type CaptureAssets = Partial<Record<CaptureSlotId, CaptureAsset>>;

export type ProductDetails = {
  category: "bag";
  conditionNote: string;
  desiredUse: string;
  purchaseYear: string;
  serialNumber: string;
  useDuration: string;
};

const INITIAL_PRODUCT_DETAILS: ProductDetails = {
  category: "bag",
  conditionNote: DEMO_SCENARIO.sourceProduct.conditionNote,
  desiredUse: DEMO_SCENARIO.sourceProduct.desiredUse,
  purchaseYear: DEMO_SCENARIO.sourceProduct.purchaseYear,
  serialNumber: DEMO_SCENARIO.sourceProduct.serialNumber,
  useDuration: DEMO_SCENARIO.sourceProduct.useDuration,
};

type CaptureSessionValue = {
  captures: CaptureAssets;
  productDetails: ProductDetails;
  removeCapture: (slot: CaptureSlotId) => void;
  setCapture: (slot: CaptureSlotId, blob: Blob, fileName: string) => void;
  updateProductDetails: (details: Partial<ProductDetails>) => void;
};

const CaptureSessionContext = createContext<CaptureSessionValue | null>(null);

type CaptureSessionProviderProps = {
  children: ReactNode;
};

export function CaptureSessionProvider({
  children,
}: CaptureSessionProviderProps) {
  const [captures, setCaptures] = useState<CaptureAssets>({});
  const [productDetails, setProductDetails] = useState<ProductDetails>(
    INITIAL_PRODUCT_DETAILS,
  );
  const capturesRef = useRef<CaptureAssets>({});

  const setCapture = useCallback(
    (slot: CaptureSlotId, blob: Blob, fileName: string) => {
      const previousCapture = capturesRef.current[slot];
      if (previousCapture) {
        URL.revokeObjectURL(previousCapture.previewUrl);
      }

      const nextCaptures = {
        ...capturesRef.current,
        [slot]: {
          blob,
          fileName,
          previewUrl: URL.createObjectURL(blob),
        },
      };

      capturesRef.current = nextCaptures;
      setCaptures(nextCaptures);
    },
    [],
  );

  const removeCapture = useCallback((slot: CaptureSlotId) => {
    const previousCapture = capturesRef.current[slot];
    if (!previousCapture) {
      return;
    }

    URL.revokeObjectURL(previousCapture.previewUrl);
    const nextCaptures = { ...capturesRef.current };
    delete nextCaptures[slot];
    capturesRef.current = nextCaptures;
    setCaptures(nextCaptures);
  }, []);

  const updateProductDetails = useCallback(
    (details: Partial<ProductDetails>) => {
      setProductDetails((current) => ({ ...current, ...details }));
    },
    [],
  );

  useEffect(() => {
    return () => {
      Object.values(capturesRef.current).forEach((capture) => {
        URL.revokeObjectURL(capture.previewUrl);
      });
    };
  }, []);

  const value = useMemo(
    () => ({
      captures,
      productDetails,
      removeCapture,
      setCapture,
      updateProductDetails,
    }),
    [
      captures,
      productDetails,
      removeCapture,
      setCapture,
      updateProductDetails,
    ],
  );

  return (
    <CaptureSessionContext.Provider value={value}>
      {children}
    </CaptureSessionContext.Provider>
  );
}

export function useCaptureSession() {
  const context = useContext(CaptureSessionContext);

  if (!context) {
    throw new Error(
      "useCaptureSession must be used within CaptureSessionProvider",
    );
  }

  return context;
}
