#!/usr/bin/env python3
"""Lightweight validation for the MCM RE:BORN hackathon package."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent


def walk_refs(value: Any, path: str = '$') -> list[tuple[str, str]]:
    refs: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f'{path}.{key}'
            if key == '$ref' and isinstance(child, str):
                refs.append((child, child_path))
            refs.extend(walk_refs(child, child_path))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            refs.extend(walk_refs(child, f'{path}[{index}]'))
    return refs


def resolve_local_ref(document: dict[str, Any], ref: str) -> Any:
    if not ref.startswith('#/'):
        return None
    current: Any = document
    for segment in ref[2:].split('/'):
        segment = segment.replace('~1', '/').replace('~0', '~')
        current = current[segment]
    return current


def main() -> None:
    openapi_path = ROOT / 'openapi.yaml'
    mock_path = ROOT / 'mock-data.json'

    openapi = yaml.safe_load(openapi_path.read_text(encoding='utf-8'))
    mock = json.loads(mock_path.read_text(encoding='utf-8'))

    if openapi.get('openapi') != '3.1.0':
        raise SystemExit('openapi.yaml must use OpenAPI 3.1.0')

    missing_refs: list[tuple[str, str]] = []
    for ref, ref_path in walk_refs(openapi):
        if ref.startswith('#/'):
            try:
                resolve_local_ref(openapi, ref)
            except (KeyError, TypeError):
                missing_refs.append((ref, ref_path))
    if missing_refs:
        raise SystemExit(f'Missing OpenAPI refs: {missing_refs}')

    operation_ids: list[str] = []
    http_methods = {'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'}
    for path_item in openapi['paths'].values():
        for method, operation in path_item.items():
            if method.lower() in http_methods:
                operation_ids.append(operation['operationId'])
    duplicates = [key for key, count in Counter(operation_ids).items() if count > 1]
    if duplicates:
        raise SystemExit(f'Duplicate operationIds: {duplicates}')

    expected_products = {'REBORN_POUCH', 'REBORN_CARD_WALLET', 'REBORN_KEYRING'}
    products = [item for item in mock['products'] if item.get('active')]
    actual_products = {item['code'] for item in products}
    if actual_products != expected_products:
        raise SystemExit(
            f'Active product codes must be {sorted(expected_products)}; got {sorted(actual_products)}'
        )

    for product in products:
        for label, value in {
            'listImage.url': product.get('listImage', {}).get('url'),
            'model3d.url': product.get('model3d', {}).get('url'),
            'model3d.posterUrl': product.get('model3d', {}).get('posterUrl'),
        }.items():
            if not value:
                raise SystemExit(f"{product['code']} missing {label}")

    print(
        'OK:',
        f"{len(openapi['paths'])} paths,",
        f'{len(operation_ids)} operations,',
        f"{len(openapi['components']['schemas'])} schemas,",
        f'{len(products)} active products with list image + 3D assets.',
    )


if __name__ == '__main__':
    main()
