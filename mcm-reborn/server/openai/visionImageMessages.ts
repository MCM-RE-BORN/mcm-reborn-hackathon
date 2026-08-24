import type OpenAI from 'openai';

const ORDERED_IMAGE_VIEWS = [
  'FRONT',
  'REAR',
  'TOP',
  'BOTTOM',
  'LEFT',
  'RIGHT',
] as const;

const FINAL_ANALYSIS_IMAGE_INDEXES = [0, 1, 2, 3, 4, 5] as const;
const WIKI_LOOKUP_IMAGE_INDEXES = [0, 1, 4, 5] as const;

export function createFinalAnalysisImageMessage(
  imageUrls: readonly string[],
): OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
  return createImageMessage(imageUrls, FINAL_ANALYSIS_IMAGE_INDEXES, 'auto');
}

export function createWikiLookupImageMessage(
  imageUrls: readonly string[],
): OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
  return createImageMessage(imageUrls, WIKI_LOOKUP_IMAGE_INDEXES, 'low');
}

function createImageMessage(
  imageUrls: readonly string[],
  imageIndexes: readonly number[],
  detail: 'auto' | 'low',
): OpenAI.Chat.Completions.ChatCompletionUserMessageParam {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: '각 VIEW 라벨 바로 다음 이미지만 해당 시점의 증거로 사용하고, 선택된 이미지를 동일 제품으로 분석하세요.',
      },
      ...imageIndexes.flatMap((index) => {
        const url = imageUrls[index];
        const view = ORDERED_IMAGE_VIEWS[index];
        if (!url || !view) {
          throw new Error(`Missing required analysis image at index ${index}`);
        }
        return [
          {
            type: 'text' as const,
            text: `IMAGE_INDEX: ${index}; VIEW: ${view}`,
          },
          {
            type: 'image_url' as const,
            image_url: { url, detail },
          },
        ];
      }),
    ],
  };
}
