"""Validated job storage shared by the import command and web app."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

DB_PATH = Path(__file__).resolve().parents[2] / 'data' / 'jobs.sqlite'
STATES = ('review', 'reject', 'accept', 'applied', 'interviewing')
TEXT_FIELDS = ('url', 'title', 'company', 'platform', 'description', 'ai_match_summary')
OPTIONAL_TEXT = ('location', 'salary', 'experience_level', 'contract_type')
REQUIRED = (*TEXT_FIELDS, 'posted_at', 'matching_skills', 'missing_skills', 'ai_match_score')


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


@contextmanager
def connection(path=DB_PATH):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path, timeout=15)
    con.row_factory = sqlite3.Row
    try:
        con.execute('PRAGMA foreign_keys = ON')
        with con:
            yield con
    finally:
        con.close()


def init_db(path=DB_PATH):
    with connection(path) as con:
        con.execute('PRAGMA journal_mode = WAL')
        con.execute('''CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY,
            url TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL, company TEXT NOT NULL, platform TEXT NOT NULL,
            description TEXT NOT NULL, ai_match_summary TEXT NOT NULL,
            posted_at TEXT,
            matching_skills TEXT NOT NULL CHECK(json_valid(matching_skills)),
            missing_skills TEXT NOT NULL CHECK(json_valid(missing_skills)),
            ai_match_score INTEGER NOT NULL CHECK(ai_match_score BETWEEN 0 AND 100),
            location TEXT, salary TEXT, experience_level TEXT, contract_type TEXT,
            status TEXT NOT NULL DEFAULT 'review'
                CHECK(status IN ('review','reject','accept','applied','interviewing')),
            discovered_at TEXT NOT NULL, status_changed_at TEXT NOT NULL,
            applied_at TEXT
        )''')


def canonical_url(value):
    parts = urlsplit(value.strip())
    if parts.scheme not in ('https', 'http') or not parts.hostname or parts.username or parts.password:
        raise ValueError('url must be an absolute http(s) URL without credentials')
    # Preserve job-identifying query parameters; remove only known tracking keys.
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path or '/', urlencode(sorted(query)), ''))


def validate_job(job):
    if not isinstance(job, dict):
        raise ValueError('each job must be an object')
    missing = [key for key in REQUIRED if key not in job]
    if missing:
        raise ValueError('missing required fields: ' + ', '.join(missing))
    unknown = set(job) - set(REQUIRED) - set(OPTIONAL_TEXT)
    if unknown:
        raise ValueError('unsupported fields: ' + ', '.join(sorted(unknown)))
    result = {}
    for key in TEXT_FIELDS:
        if not isinstance(job[key], str) or not job[key].strip():
            raise ValueError(f'{key} must be a non-empty string')
        result[key] = job[key].strip()
    result['url'] = canonical_url(result['url'])
    posted = job['posted_at']
    if posted is not None:
        if not isinstance(posted, str):
            raise ValueError('posted_at must be YYYY-MM-DD or null')
        try:
            parsed = date.fromisoformat(posted)
        except ValueError:
            raise ValueError('posted_at must be YYYY-MM-DD or null') from None
        if parsed.isoformat() != posted or parsed > date.today():
            raise ValueError('posted_at must be YYYY-MM-DD and cannot be in the future')
    result['posted_at'] = posted
    score = job['ai_match_score']
    if type(score) is not int or not 0 <= score <= 100:
        raise ValueError('ai_match_score must be an integer from 0 to 100')
    result['ai_match_score'] = score
    for key in ('matching_skills', 'missing_skills'):
        items = job[key]
        if not isinstance(items, list) or any(not isinstance(item, str) or not item.strip() for item in items):
            raise ValueError(f'{key} must be an array of non-empty strings (or [])')
        result[key] = json.dumps([item.strip() for item in items])
    for key in OPTIONAL_TEXT:
        value = job.get(key)
        if value is not None and (not isinstance(value, str) or not value.strip()):
            raise ValueError(f'{key} must be non-empty text or null')
        result[key] = value.strip() if value is not None else None
    return result


def import_jobs(jobs, path=DB_PATH):
    if not isinstance(jobs, list):
        raise ValueError('input must be a JSON array of jobs')
    # Validate the entire batch before writing any records.
    rows = []
    for index, job in enumerate(jobs):
        try:
            rows.append(validate_job(job))
        except ValueError as exc:
            raise ValueError(f'Job {index + 1}: {exc}') from exc
    init_db(path)
    added = 0
    with connection(path) as con:
        for row in rows:
            row.update(discovered_at=now(), status_changed_at=now())
            columns = ', '.join(row)
            placeholders = ', '.join('?' for _ in row)
            cursor = con.execute(f'INSERT INTO jobs ({columns}) VALUES ({placeholders}) ON CONFLICT(url) DO NOTHING', tuple(row.values()))
            added += cursor.rowcount
    return {'added': added, 'duplicates': len(rows) - added}


def decode(row):
    result = dict(row)
    for field in ('matching_skills', 'missing_skills'):
        result[field] = json.loads(result[field])
    return result


def list_jobs(path=DB_PATH):
    with connection(path) as con:
        return [decode(row) for row in con.execute('SELECT * FROM jobs ORDER BY posted_at DESC, id DESC')]


def set_status(job_id, status, path=DB_PATH):
    if status not in STATES:
        raise ValueError('invalid status')
    with connection(path) as con:
        row = con.execute('SELECT * FROM jobs WHERE id = ?', (job_id,)).fetchone()
        if row is None:
            raise KeyError(job_id)
        timestamp = now()
        if row['status'] != status:
            con.execute('''UPDATE jobs SET status = ?, status_changed_at = ?,
                applied_at = CASE WHEN ? = 'applied' THEN COALESCE(applied_at, ?) ELSE applied_at END
                WHERE id = ?''', (status, timestamp, status, timestamp, job_id))
        return decode(con.execute('SELECT * FROM jobs WHERE id = ?', (job_id,)).fetchone())
