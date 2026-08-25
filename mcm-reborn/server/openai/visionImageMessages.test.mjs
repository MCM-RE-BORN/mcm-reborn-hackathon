import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFinalAnalysisImageMessage,
  createWikiLookupImageMessage,
} from './visionImageMessages.ts';

const IMAGE_URLS = [
  'https://example.test/front.jpg',
  'https://example.test/rear.jpg',
  'https://example.test/top.jpg',
  'https://example.test/bottom.jpg',
  'https://example.test/left.jpg',
  'https://example.test/right.jpg',
];

function imageParts(message) {
  return message.content.filter((part) => part.type === 'image_url');
}

function viewLabels(message) {
  return message.content
    .filter(
      (part) =>
        part.type === 'text' && part.text.startsWith('IMAGE_INDEX:'),
    )
    .map((part) => part.text);
}

test('wiki lookup sends only four exterior views at low detail', () => {
  const message = createWikiLookupImageMessage(IMAGE_URLS);

  assert.deepEqual(
    imageParts(message).map((part) => part.image_url),
    [0, 1, 4, 5].map((index) => ({
      url: IMAGE_URLS[index],
      detail: 'low',
    })),
  );
  assert.deepEqual(viewLabels(message), [
    'IMAGE_INDEX: 0; VIEW: FRONT',
    'IMAGE_INDEX: 1; VIEW: REAR',
    'IMAGE_INDEX: 4; VIEW: LEFT',
    'IMAGE_INDEX: 5; VIEW: RIGHT',
  ]);
});

test('final analysis keeps all six ordered views at automatic detail', () => {
  const message = createFinalAnalysisImageMessage(IMAGE_URLS);

  assert.deepEqual(
    imageParts(message).map((part) => part.image_url),
    IMAGE_URLS.map((url) => ({ url, detail: 'auto' })),
  );
  assert.deepEqual(viewLabels(message), [
    'IMAGE_INDEX: 0; VIEW: FRONT',
    'IMAGE_INDEX: 1; VIEW: REAR',
    'IMAGE_INDEX: 2; VIEW: TOP',
    'IMAGE_INDEX: 3; VIEW: BOTTOM',
    'IMAGE_INDEX: 4; VIEW: LEFT',
    'IMAGE_INDEX: 5; VIEW: RIGHT',
  ]);
});
