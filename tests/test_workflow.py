import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

from jobs.db import import_jobs, list_jobs, set_status
from jobs.web import create_app, main as web_main

SCRIPTS = Path(__file__).resolve().parents[1] / 'agent_scripts'
sys.path.insert(0, str(SCRIPTS))
import reed


def script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def job():
    return dict(url='https://example.com/jobs/1', title='Analyst', company='Example',
                platform='Reed', description='Financial analysis', ai_match_summary='Relevant modelling experience',
                posted_at=None, matching_skills=['Python'], missing_skills=[], ai_match_score=70)


class StorageTests(unittest.TestCase):
    def test_import_atomicity_duplicates_and_application_history(self):
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / 'jobs.sqlite'
            self.assertEqual(import_jobs([job()], db)['added'], 1)
            applied = set_status(1, 'applied', db)
            set_status(1, 'reject', db)
            duplicate = dict(job(), url=job()['url'] + '?utm_source=test')
            self.assertEqual(import_jobs([duplicate], db)['duplicates'], 1)
            row = list_jobs(db)[0]
            self.assertEqual(row['status'], 'reject')
            self.assertEqual(row['applied_at'], applied['applied_at'])
            with self.assertRaises(ValueError):
                import_jobs([dict(job(), url='https://example.com/2'), dict(job(), ai_match_score=101)], db)
            self.assertEqual(len(list_jobs(db)), 1)

    def test_app_static_and_status_api(self):
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / 'jobs.sqlite'
            client = create_app(db).test_client()
            import_jobs([job()], db)
            for url in ('/', '/static/app.js', '/static/style.css', '/api/jobs'):
                with client.get(url) as response:
                    self.assertEqual(response.status_code, 200)
            self.assertEqual(client.patch('/api/jobs/1/status', json={'status': 'accept'}).status_code, 200)
            self.assertEqual(client.patch('/api/jobs/1/status', json={'status': 'bad'}).status_code, 400)
            self.assertEqual(client.patch('/api/jobs/1/status', json={'status': 'reject'}, headers={'Origin': 'https://example.com'}).status_code, 403)

    def test_browser_opens_after_server_bind(self):
        with patch('jobs.web.create_app'), patch('jobs.web.make_server') as server, patch('jobs.web.webbrowser.open') as browser, patch.object(sys, 'argv', ['web']):
            server.return_value.__enter__.return_value.server_port = 5050
            with contextlib.redirect_stdout(io.StringIO()):
                web_main()
            self.assertEqual(server.call_args.args[:2], ('127.0.0.1', 5050))
            browser.assert_called_once_with('http://127.0.0.1:5050')


class ReedTests(unittest.TestCase):
    def test_search_filters_dates_and_limits_output(self):
        search = script('01_search_reed')
        today = date.today()
        rows = [dict(jobId=i, jobUrl=f'https://example.com/jobs/{i}', jobTitle='Analyst', employerName='Example', locationName='London',
                     date=posted, jobDescription='LONG PRIVATE DESCRIPTION')
                for i, posted in enumerate([today.strftime('%d/%m/%Y'), None,
                                           (today - timedelta(days=7)).strftime('%d/%m/%Y'),
                                           (today + timedelta(days=1)).strftime('%d/%m/%Y')], 1)]
        with tempfile.TemporaryDirectory() as folder, patch.object(search, 'DB_PATH', Path(folder) / 'jobs.sqlite'), patch.object(reed, 'CACHE', Path(folder) / 'reed_jobs.json'), patch.object(search, 'get', return_value={'results': rows}), patch.object(sys, 'argv', ['search', '--keywords', 'finance', '--location', 'London', '--days', '7', '--limit', '20']):
            output = io.StringIO()
            with contextlib.redirect_stdout(output), contextlib.redirect_stderr(io.StringIO()):
                search.main()
            compact = json.loads(output.getvalue())
            self.assertEqual(len(compact), 1)
            self.assertEqual(set(compact[0]), {'id', 'title', 'company', 'location', 'salary'})
            self.assertNotIn('DESCRIPTION', output.getvalue())
            self.assertEqual(json.loads(reed.CACHE.read_text())['jobs'][0]['search']['jobId'], 1)
            self.assertFalse(search.DB_PATH.exists())

    def test_search_excludes_database_urls_and_refreshes_after_import(self):
        search = script('01_search_reed')
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / 'jobs.sqlite'
            statuses = ['review', 'reject', 'accept', 'applied', 'interviewing']
            import_jobs([dict(job(), url=f'https://example.com/jobs/{i}') for i in range(1, 6)], db)
            for i, status in enumerate(statuses, 1):
                set_status(i, status, db)
            before = list_jobs(db)
            def result(i, url=None):
                return dict(jobId=i, jobUrl=url or f'https://example.com/jobs/{i}',
                            date=date.today().strftime('%d/%m/%Y'), jobTitle='Analyst')
            # A full page of existing jobs must not consume the candidate limit.
            first_page = [result(i % 5 + 1, f'https://example.com/jobs/{i % 5 + 1}?utm_source=reed') for i in range(100)]
            second_page = [result(6), result(7, 'https://example.com/jobs/6?utm_source=other'),
                           result(6, 'https://example.com/alternate'), result(8, 'invalid'), result(9)]
            with patch.object(search, 'DB_PATH', db), patch.object(reed, 'CACHE', Path(folder) / 'reed_jobs.json'), patch.object(search, 'get', side_effect=[{'results': first_page}, {'results': second_page}]) as get, patch.object(sys, 'argv', ['search', '--keywords', 'finance', '--location', 'London', '--days', '7', '--limit', '2']):
                output, errors = io.StringIO(), io.StringIO()
                with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                    search.main()
                self.assertEqual(get.call_count, 2)
                cached = json.loads(reed.CACHE.read_text())['jobs']
                self.assertEqual([row['search']['jobId'] for row in cached], [6, 9])
                self.assertEqual([row['id'] for row in cached], [1, 2])
                self.assertIn('duplicates skipped: 102', errors.getvalue())
                self.assertEqual(list_jobs(db), before)
                import_jobs([dict(job(), url=row['search']['jobUrl']) for row in cached], db)
                get.side_effect = [{'results': [result(6), result(9), result(10)]}]
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    search.main()
                self.assertEqual([row['search']['jobId'] for row in json.loads(reed.CACHE.read_text())['jobs']], [10])

    def test_selected_details_and_invalid_ids(self):
        evaluate = script('02_evaluate_jobs')
        with tempfile.TemporaryDirectory() as folder:
            cache = Path(folder) / 'reed_jobs.json'
            cache.write_text(json.dumps({'jobs': [{'id': 1, 'search': {'jobId': 99}}]}))
            with patch.object(evaluate, 'CACHE', cache), patch.object(reed, 'CACHE', cache), patch.object(evaluate, 'get', return_value={'jobDescription': 'Full description'}) as get, patch.object(sys, 'argv', ['evaluate', '1']):
                with contextlib.redirect_stdout(io.StringIO()):
                    evaluate.main()
                get.assert_called_once_with('jobs/99')
                self.assertIn('details', json.loads(cache.read_text())['jobs'][0])
            with patch.object(evaluate, 'CACHE', cache), patch.object(evaluate, 'get') as get, patch.object(sys, 'argv', ['evaluate', '2']):
                with self.assertRaises(ValueError):
                    evaluate.main()
                get.assert_not_called()


if __name__ == '__main__':
    unittest.main()
