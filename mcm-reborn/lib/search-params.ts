/**
 * Next.js searchParams는 같은 키가 반복되면 배열로 들어온다.
 * 화면은 항상 첫 값 하나만 쓰므로 여기서 한 번만 정규화한다.
 */
export function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
