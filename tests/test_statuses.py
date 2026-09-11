import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from jobs.db import import_jobs, list_jobs, set_status
from jobs.web import create_app


def job(url='https://example.com/job/1'):
    return dict(url=url, title='Analyst', company='Example', platform='Reed',
                description='Example duties', ai_match_summary='Example fit',
                posted_at=None, matching_skills=['Analysis'], missing_skills=[],
                ai_match_score=80)


class StatusTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / 'jobs.sqlite'

    def test_import_defaults_and_preserves_decisions(self):
        import_jobs([job()], self.path)
        row = list_jobs(self.path)[0]
        self.assertEqual(row['status'], 'review')
        set_status(row['id'], 'rejected', self.path)
        self.assertEqual(import_jobs([job()], self.path), {'added':0,'duplicates':1})
        self.assertEqual(list_jobs(self.path)[0]['status'], 'rejected')

    def test_first_applied_time_survives_rejection_and_reapplication(self):
        import_jobs([job()], self.path)
        row = list_jobs(self.path)[0]
        with patch('jobs.db.now', return_value='2025-01-01T00:00:00+00:00'):
            applied = set_status(row['id'], 'applied', self.path)
        for status in ('interviewing', 'rejected', 'review', 'applied'):
            updated = set_status(row['id'], status, self.path)
            self.assertEqual(updated['applied_at'], applied['applied_at'])

    def test_api_only_accepts_four_statuses(self):
        import_jobs([job()], self.path)
        client = create_app(self.path).test_client()
        for status in ('accept', 'accepted', 'reject', 'unknown'):
            self.assertEqual(client.patch('/api/jobs/1/status', json={'status':status}).status_code, 400)
        for status in ('review', 'rejected', 'applied', 'interviewing'):
            result = client.patch('/api/jobs/1/status', json={'status':status})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json['status'], status)


if __name__ == '__main__':
    unittest.main()
