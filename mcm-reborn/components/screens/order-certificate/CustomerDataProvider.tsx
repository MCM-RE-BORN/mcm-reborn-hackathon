"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearCustomerSession,
  customerFetch,
  getCustomerSession,
  subscribeCustomerSession,
  type CustomerAnalysisPage,
  type CustomerApplicationDetail,
  type CustomerApplicationPage,
  type CustomerMe,
} from "./customer-client";

export type CustomerDataSnapshot = {
  analyses: CustomerAnalysisPage;
  applications: CustomerApplicationPage;
  latestApplication: CustomerApplicationDetail | null;
  ownerUserId: string;
  profile: CustomerMe;
  sessionExpiresAt: string;
};

type CustomerDataStatus = "idle" | "loading" | "ready" | "error";

type CustomerDataContextValue = {
  bootstrap: () => Promise<CustomerDataSnapshot>;
  data: CustomerDataSnapshot | null;
  revalidateHistory: () => Promise<boolean>;
  reset: () => void;
  status: CustomerDataStatus;
};

const CustomerDataContext = createContext<CustomerDataContextValue | null>(null);

function historyFingerprint(snapshot: Pick<
  CustomerDataSnapshot,
  "analyses" | "applications" | "latestApplication"
>) {
  return JSON.stringify([
    snapshot.applications.items,
    snapshot.analyses.items,
    snapshot.latestApplication,
  ]);
}

async function loadHistory(
  previousLatestApplication: CustomerApplicationDetail | null = null,
) {
  const [applications, analyses] = await Promise.all([
    customerFetch<CustomerApplicationPage>("/api/v2/applications?size=50"),
    customerFetch<CustomerAnalysisPage>("/api/v2/analyses?size=50"),
  ]);
  const latest = applications.items[0];
  let latestApplication: CustomerApplicationDetail | null = null;
  if (latest) {
    try {
      latestApplication = await customerFetch<CustomerApplicationDetail>(
        `/api/v2/applications/${latest.id}`,
      );
    } catch {
      latestApplication =
        previousLatestApplication?.id === latest.id
          ? previousLatestApplication
          : null;
    }
  }

  return { analyses, applications, latestApplication };
}

async function loadInitialData(fallbackProfile: CustomerMe) {
  const [history, profile] = await Promise.all([
    loadHistory(),
    customerFetch<CustomerMe>("/api/v2/me").catch(() => fallbackProfile),
  ]);
  return { ...history, profile };
}

export function CustomerDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CustomerDataSnapshot | null>(null);
  const [status, setStatus] = useState<CustomerDataStatus>("idle");
  const dataRef = useRef<CustomerDataSnapshot | null>(null);
  const bootstrapRequestRef = useRef<Promise<CustomerDataSnapshot> | null>(null);
  const historyRequestRef = useRef<Promise<boolean> | null>(null);
  const generationRef = useRef(0);

  const commit = useCallback((next: CustomerDataSnapshot) => {
    dataRef.current = next;
    setData(next);
    setStatus("ready");
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    bootstrapRequestRef.current = null;
    historyRequestRef.current = null;
    dataRef.current = null;
    setData(null);
    setStatus("idle");
  }, []);

  const bootstrap = useCallback(async () => {
    let session;
    try {
      session = await getCustomerSession();
    } catch (error) {
      setStatus("error");
      window.location.replace("/login?reason=session-expired");
      throw error;
    }
    const cached = dataRef.current;
    if (cached?.ownerUserId === session.user.id) {
      return cached;
    }
    if (bootstrapRequestRef.current) {
      return bootstrapRequestRef.current;
    }

    const generation = generationRef.current;
    setStatus("loading");
    const request = loadInitialData(session.user)
      .then((initialData) => {
        const next: CustomerDataSnapshot = {
          ...initialData,
          ownerUserId: session.user.id,
          sessionExpiresAt: session.expiresAt,
        };
        if (generation === generationRef.current) {
          commit(next);
        }
        return next;
      })
      .catch((error) => {
        if (generation === generationRef.current) {
          setStatus("error");
        }
        throw error;
      })
      .finally(() => {
        if (generation === generationRef.current) {
          bootstrapRequestRef.current = null;
        }
      });

    bootstrapRequestRef.current = request;
    return request;
  }, [commit]);

  const revalidateHistory = useCallback(async () => {
    const cached = dataRef.current;
    if (!cached) {
      await bootstrap();
      return true;
    }
    if (historyRequestRef.current) {
      return historyRequestRef.current;
    }
    const generation = generationRef.current;
    const request = loadHistory(cached.latestApplication)
      .then((history) => {
        if (generation !== generationRef.current) {
          return false;
        }
        const current = dataRef.current;
        if (!current || current.ownerUserId !== cached.ownerUserId) {
          return false;
        }
        const next = { ...current, ...history };
        if (historyFingerprint(next) === historyFingerprint(current)) {
          return false;
        }
        commit(next);
        return true;
      })
      .finally(() => {
        if (generation === generationRef.current) {
          historyRequestRef.current = null;
        }
      });

    historyRequestRef.current = request;
    return request;
  }, [bootstrap, commit]);

  useEffect(() => subscribeCustomerSession(reset), [reset]);

  useEffect(() => {
    if (!data) return;

    const expiresAt = Date.parse(data.sessionExpiresAt) - 30_000;
    const expireSession = () => {
      clearCustomerSession();
      reset();
      window.location.replace("/login");
    };
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      expireSession();
      return;
    }

    const timer = window.setTimeout(expireSession, remaining);
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() >= expiresAt) {
        expireSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [data, reset]);

  return (
    <CustomerDataContext.Provider
      value={{ bootstrap, data, revalidateHistory, reset, status }}
    >
      {children}
    </CustomerDataContext.Provider>
  );
}

export function useCustomerData() {
  const context = useContext(CustomerDataContext);
  if (!context) {
    throw new Error("useCustomerData must be used within CustomerDataProvider.");
  }
  return context;
}
