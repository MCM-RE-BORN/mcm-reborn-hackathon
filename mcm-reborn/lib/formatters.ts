export function formatKrw(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

/**
 * API가 돌려준 ISO 문자열을 화면용 한국 날짜로 바꾼다.
 * 값이 없으면 "-", 파싱할 수 없으면 원본을 그대로 보여준다.
 */
export function formatApiDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ko-KR");
}
