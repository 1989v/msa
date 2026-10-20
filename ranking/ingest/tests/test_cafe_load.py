import json
import tempfile
import unittest
from pathlib import Path
from src.cafe_load import load_directory


class CafeLoadSmokeTest(unittest.TestCase):
    def test_sends_brand_batches_and_skips_empty_files_without_changing_raw_values(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)
            (path / 'drinks.empty.jsonl').write_text('')
            raw = {'카페인': '-'}
            for brand in ('first', 'second'):
                (path / f'drinks.{brand}.jsonl').write_text(json.dumps({
                    'brand_slug': brand, 'menu_name': '음료', 'raw_nutrition': raw,
                    'caffeine_status': 'UNDISCLOSED', 'caffeine_mg': None,
                }))
            calls = []
            count = load_directory(path, send=lambda url, payload: calls.append((url, payload)))
            self.assertEqual(2, count)
            self.assertEqual(2, len(calls))
            self.assertEqual({'first', 'second'}, {p['drinks'][0]['brandSlug'] for _, p in calls})
            for url, payload in calls:
                self.assertEqual('http://localhost:8097/internal/ranking/cafe/drinks/bulk', url)
                self.assertEqual(raw, payload['drinks'][0]['rawNutrition'])
                self.assertIsNone(payload['drinks'][0]['caffeineMg'])


if __name__ == '__main__':
    unittest.main()
