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
import type { CaptureSlotId } from "./capture-config";

export type CaptureAsset = {
  blob: Blob;
  fileName: string;
  previewUrl: string;
};

export type CaptureAssets = Partial<Record<CaptureSlotId, CaptureAsset>>;

export type ProductDetails = {
  category: "BACKPACK";
  conditionNote: string;
  desiredUse: string;
  purchaseYear: string;
  serialNumber: string;
  useDuration: string;
};

export const USE_DURATION_OPTIONS = ["1년 미만", "1~2년", "3~4년", "5년 이상"] as const;
export const DESIRED_USE_OPTIONS = ["여권지갑", "카드지갑", "캐리어 네임택", "키링"] as const;

const INITIAL_PRODUCT_DETAILS: ProductDetails = {
  category: "BACKPACK",
  conditionNote: "",
  desiredUse: DESIRED_USE_OPTIONS[0],
  purchaseYear: "",
  serialNumber: "",
  useDuration: USE_DURATION_OPTIONS[0],
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
