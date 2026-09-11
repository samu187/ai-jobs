# Job journal

A local app: Codex searches and assesses jobs; you review them.

## Start

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run from this folder:

```sh
uv run web
```

Your browser opens at http://127.0.0.1:5050. Keep the terminal running; Ctrl+C stops the app. Use `--port 5051` for another port, or `--no-browser` to skip opening a tab. You can also ask Codex to start it.

## Find jobs

Put your CV in `user/cv.MD`, preferences in `user/goals.MD`, and Reed API key in `user/apikey.txt`. These files are ignored by Git. Ask Codex:

> Read AGENTS.md. Search Reed for London finance transformation roles posted in the last 7 days. Retrieve 20 candidates and assess the best 10.

Codex checks your CV and goals, asks for missing choices, searches, retrieves selected descriptions, and adds assessments. Refresh the app to see them.

```sh
uv run python agent_scripts/01_search_reed.py --keywords "finance transformation" --location London --days 7 --limit 20
uv run python agent_scripts/02_evaluate_jobs.py 1 4 7
# After Codex writes imports/evaluated_jobs.json:
uv run python agent_scripts/03_import_jobs.py
```

Search replaces `imports/reed_jobs.json` and prints compact rows. Row IDs belong only to the latest search. The second script retrieves full details; Codex supplies the assessments. Both JSON filenames are reused. Posting dates are filtered locally; unknown dates are excluded and coverage is bounded. [AGENTS.md](AGENTS.md) gives the exact workflow and import format. See also [Reed's API documentation](https://www.reed.co.uk/developers/jobseeker).

## Review and files

Search, filter by state and sort by date or score. Apply marks a job applied and opens its listing; it doesn't submit an application. Duplicate imports preserve existing decisions and the first application timestamp.

```text
AGENTS.md                Codex instructions
pyproject.toml           uv project and web command
src/jobs/                web.py, db.py, static/
agent_scripts/           numbered search, details and import scripts
tests/                   isolated checks
user/                    private CV, goals and Reed key
imports/                 latest search and assessment files
data/jobs.sqlite         existing database
```

Run tests: `uv run python -m unittest discover -s tests -v`. Personal files, imports, data and the virtual environment are gitignored. Stop the app and importer before copying `data/` for backup. Run from this checkout with uv; no frontend build step or hosted service is needed.
