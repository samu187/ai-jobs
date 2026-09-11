"""Small shared Reed client. Never print credentials or response error bodies."""
import base64
import json
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'imports' / 'reed_jobs.json'


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get(endpoint, **params):
    key = (ROOT / 'user' / 'apikey.txt').read_text(encoding='utf-8').strip()
    if not key:
        raise ValueError('user/apikey.txt is empty')
    token = base64.b64encode((key + ':').encode()).decode()
    url = 'https://www.reed.co.uk/api/1.0/' + endpoint
    if params:
        url += '?' + urlencode(params)
    request = Request(url, headers={'Authorization': 'Basic ' + token, 'Accept': 'application/json'})
    try:
        with build_opener(NoRedirect).open(request, timeout=30) as response:
            return json.load(response)
    except HTTPError as exc:
        raise ValueError(f'Reed returned HTTP {exc.code}; check API access or retry later.') from None
    except URLError:
        raise ValueError('Could not connect to Reed. Check your connection and retry.') from None


def posted_date(job):
    value = job.get('datePosted') or job.get('date')
    if not isinstance(value, str):
        return None
    for pattern in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            pass
    return None


def salary(job):
    low, high = job.get('minimumSalary'), job.get('maximumSalary')
    if low is None and high is None:
        return None
    amount = str(low if low is not None else high)
    if high is not None and low is not None and low != high:
        amount += '–' + str(high)
    return ' '.join(str(x) for x in (job.get('currency'), amount, job.get('salaryType')) if x)


def save(value):
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    temporary = CACHE.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(CACHE)
