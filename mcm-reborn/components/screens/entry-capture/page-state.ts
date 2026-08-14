export type PageState =
  | "normal"
  | "loading"
  | "empty"
  | "error"
  | "permission"
  | "limited";

export type EntrySearchParams = Promise<{
  captured?: string | string[];
  state?: string | string[];
}>;

export type EntryPageProps = {
  searchParams: EntrySearchParams;
};

const PAGE_STATES = new Set<PageState>([
  "normal",
  "loading",
  "empty",
  "error",
  "permission",
  "limited",
]);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function readEntrySearchParams(searchParams: EntrySearchParams) {
  const values = await searchParams;
  const requestedState = firstValue(values.state);

  return {
    captured: firstValue(values.captured) === "1",
    state:
      requestedState && PAGE_STATES.has(requestedState as PageState)
        ? (requestedState as PageState)
        : "normal",
  };
}
