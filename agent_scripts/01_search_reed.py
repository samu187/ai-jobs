"""Search Reed, replace the cached batch, and print compact candidate rows."""
import argparse
import json
import sqlite3
import sys
from contextlib import closing
from datetime import date, timedelta
from jobs.db import DB_PATH, canonical_url
from reed import get, posted_date, salary, save


def positive(value):
    number = int(value)
    if number < 1:
        raise argparse.ArgumentTypeError('must be at least 1')
    return number


def existing_urls():
    """Read every status without creating or changing the database."""
    if not DB_PATH.exists():
        return set()
    with closing(sqlite3.connect(DB_PATH.as_uri() + '?mode=ro', uri=True)) as database:
        return {canonical_url(row[0]) for row in database.execute('SELECT url FROM jobs')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--keywords', required=True)
    parser.add_argument('--location', required=True)
    parser.add_argument('--days', type=positive, required=True, help='calendar days including today')
    parser.add_argument('--limit', type=positive, required=True, help='maximum compact rows to return')
    parser.add_argument('--max-pages', type=positive, default=5, help='maximum pages of 100 to inspect')
    parser.add_argument('--distance', type=positive, default=10, help='miles from location')
    args = parser.parse_args()
    today = date.today()
    cutoff = today - timedelta(days=args.days - 1)
    rows, seen = [], set()
    known_urls = existing_urls()
    duplicates = 0
    invalid_urls = 0
    excluded = 0
    inspected = 0
    exhausted = False
    for page in range(args.max_pages):
        payload = get('search', keywords=args.keywords, locationName=args.location,
                      distanceFromLocation=args.distance, resultsToTake=100, resultsToSkip=page * 100)
        results = payload.get('results') if isinstance(payload, dict) else None
        if not isinstance(results, list):
            raise ValueError('Unexpected Reed search response; previous cache was not replaced.')
        for job in results:
            inspected += 1
            posted = posted_date(job)
            if posted is None or not cutoff <= posted <= today:
                excluded += 1
                continue
            job_id = job.get('jobId')
            if not isinstance(job_id, int) or job_id <= 0:
                continue
            url = job.get('jobUrl')
            try:
                if not isinstance(url, str):
                    raise ValueError('Missing vacancy URL')
                url = canonical_url(url)
            except ValueError:
                invalid_urls += 1
                continue
            if job_id in seen or url in known_urls:
                duplicates += 1
                continue
            known_urls.add(url)
            seen.add(job_id)
            rows.append({'id': len(rows) + 1, 'posted_at': posted.isoformat(), 'search': job})
            if len(rows) >= args.limit:
                break
        if len(rows) >= args.limit:
            break
        if len(results) < 100:
            exhausted = True
            break
    save({'query': vars(args), 'date_from': cutoff.isoformat(), 'date_to': today.isoformat(), 'jobs': rows})
    print(json.dumps([{'id': row['id'], 'title': row['search'].get('jobTitle'),
                       'company': row['search'].get('employerName'),
                       'location': row['search'].get('locationName'),
                       'salary': salary(row['search'])} for row in rows], ensure_ascii=False))
    print(f'Saved imports/reed_jobs.json; window {cutoff} to {today}; inspected {inspected}; '
          f'excluded outside window/unknown date: {excluded}; '
          f'duplicates skipped: {duplicates}; invalid URLs skipped: {invalid_urls}; '
          f'search exhausted: {exhausted}. Row IDs apply only to this batch.', file=sys.stderr)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, sqlite3.Error) as exc:
        print(f'Search failed: {exc}', file=sys.stderr)
        sys.exit(1)
