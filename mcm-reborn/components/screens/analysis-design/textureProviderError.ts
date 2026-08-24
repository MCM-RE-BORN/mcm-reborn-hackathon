export function textureProviderErrorMessage(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('credits')) {
    return 'Meshy API credits가 부족합니다.';
  }
  if (
    normalized.includes('configured daily') ||
    normalized.includes('daily target_retexture preview limit')
  ) {
    return '이 서비스에 설정된 일일 3D 목업 생성 한도에 도달했습니다.';
  }
  if (
    normalized.includes('rate limit') ||
    normalized.includes('concurrent task limit')
  ) {
    return 'Meshy 요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (normalized.includes('not enabled')) {
    return '3D 목업 생성 기능이 활성화되지 않았습니다.';
  }
  return message || '3D 목업을 생성하지 못했습니다.';
}
