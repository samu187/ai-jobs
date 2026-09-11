"""Retrieve full Reed details for selected cache row IDs; Codex assesses the fit."""
import argparse
import json
import sys
from reed import CACHE, get, save


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('ids', nargs='+', type=int, help='row IDs from the most recent search')
    args = parser.parse_args()
    cache = json.loads(CACHE.read_text(encoding='utf-8'))
    rows = {row['id']: row for row in cache['jobs']}
    if any(i not in rows for i in args.ids):
        raise ValueError('Unknown row ID. Use IDs from the latest search only.')
    selected = []
    for i in dict.fromkeys(args.ids):
        row = rows[i]
        if 'details' not in row:
            details = get(f"jobs/{row['search']['jobId']}")
            if not isinstance(details, dict) or not details.get('jobDescription'):
                raise ValueError(f'No full details available for row {i}; it may have expired.')
            row['details'] = details
        selected.append(row)
    save(cache)
    print(json.dumps(selected, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError) as exc:
        print(f'Details failed: {exc}', file=sys.stderr)
        sys.exit(1)
