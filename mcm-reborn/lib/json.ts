/**
 * 신뢰할 수 없는 JSON 응답을 좁혀 읽기 위한 가드.
 * 객체가 아니면 null을 돌려주므로 호출부에서 옵셔널 체이닝으로 이어갈 수 있다.
 */
export function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
