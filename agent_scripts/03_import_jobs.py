"""Import a validated JSON array without replacing existing jobs or statuses."""
import argparse
import json
import sys
from pathlib import Path
from jobs.db import import_jobs

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('file', nargs='?', type=Path,
                        default=Path(__file__).resolve().parents[1] / 'imports' / 'evaluated_jobs.json',
                        help='JSON array of assessed jobs (default: imports/evaluated_jobs.json)')
    args = parser.parse_args()
    try:
        result = import_jobs(json.loads(args.file.read_text(encoding='utf-8')))
    except (ValueError, OSError) as exc:
        print(f'Import failed: {exc}', file=sys.stderr)
        sys.exit(1)
    print(json.dumps(result))
