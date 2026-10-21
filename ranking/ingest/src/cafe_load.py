"""Load saved official nutrition rows, replacing only each nonempty brand batch."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.request import Request, urlopen


def camel_case(key):
    head, *tail = key.split('_')
    return head + ''.join(word.title() for word in tail)


def load_directory(directory, base_url='http://localhost:8097', send=None):
    if send is None:
        def send(url, payload):
            request = Request(url, data=json.dumps(payload, ensure_ascii=False).encode(),
                              headers={'Content-Type': 'application/json'}, method='POST')
            with urlopen(request, timeout=60) as response:
                result = json.load(response)
                if not result.get('success'):
                    raise RuntimeError(f'Cafe bulk failed: {result}')
    batches = {}
    for path in sorted(Path(directory).glob('drinks.*.jsonl')):
        for line in path.read_text().splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            brand = row['brand_slug']
            if not isinstance(brand, str) or not brand.strip():
                raise ValueError(f'Missing brand_slug: {path}')
            batches.setdefault(brand, []).append({camel_case(k): v for k, v in row.items()})
    # Empty files produce no request, so previously loaded brand data cannot be deleted.
    parent_run_id = str(uuid.uuid4())
    for brand, drinks in batches.items():
        send(base_url.rstrip('/') + '/internal/ranking/cafe/drinks/bulk', {'drinks': drinks, 'parentRunId': parent_run_id})
        print(f'{brand}: {len(drinks)} rows')
    return sum(map(len, batches.values()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://localhost:8097')
    parser.add_argument('--data-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'data' / 'cafe')
    args = parser.parse_args()
    load_directory(args.data_dir, args.base_url)


if __name__ == '__main__':
    main()
