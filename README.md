# AI Jobs

A local app: Codex searches and assesses jobs; you review them.
Run the web app to review, flag and apply to new roles.
Run Codex to have an AI assistand analyse your CV, your career goals, and add new relevant jobs to the database, waiting for you to review them!

## Start

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run from this folder:

```sh
uv run ai-jobs
```

Your browser opens at http://127.0.0.1:5050. Keep the terminal running; Ctrl+C stops the app. Use `--port 5051` for another port, or `--no-browser` to skip opening a tab. You can also ask Codex to start it.

To install the standalone app, run `uv tool install .` from this folder. Then run `ai-jobs` from any directory. If your shell cannot find it, run `uv tool update-shell` and restart your terminal. After code updates, reinstall with `uv tool install --reinstall .`. Use `uv run ai-jobs` within this repository. If another program named ai-jobs is installed, use the full executable path in uv's tool bin directory (`uv tool dir --bin`).

The app and repository scripts share one database per OS user via `platformdirs`: `~/Library/Application Support/ai-jobs/jobs.sqlite` on macOS, the XDG data directory's `ai-jobs/jobs.sqlite` on Linux, and local AppData's `ai-jobs/jobs.sqlite` on Windows. Run `ai-jobs --data-path` (or `uv run ai-jobs --data-path`) for the exact location. Package reinstalls do not remove your database.

## Find jobs
Put your CV in `user/cv.MD`, preferences in `user/goals.MD`, and Reed API key in `user/apikey.txt`. These files are ignored by Git. 

# Open Codex from the project directory
Ask codex:
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
pyproject.toml           uv project and jobs command
src/jobs/                web.py, db.py, static/
agent_scripts/           numbered search, details and import scripts
user/                    private CV, goals and Reed key
imports/                 latest search and assessment files
```

## Frontend development

The React interface has two views: **Your Saved Jobs** (the default) and **Find a new Match ♥** (a placeholder). Saved jobs start with Review and Newest first; switching views preserves the current search, filters and selection.

Status and ordering menus show their Option shortcuts: ⌥R Review, ⌥A Accepted, ⌥P Applied, ⌥I Interviewing, ⌥X Rejected, ⌥L All statuses, ⌥D Newest first, and ⌥S Best match. ⌥Space focuses search. Use ↑/↓ to browse job cards, or navigate an open menu; Escape closes the menu.

React source lives in `frontend/`: `App.jsx`, `SavedJobsView.jsx`, `FindMatchView.jsx`, `Sidebar.jsx`, `JobCard.jsx`, `JobDetail.jsx`, and `FilterMenu.jsx`. Flask serves the committed local bundle in `src/jobs/static/app.js`; normal app startup does not need Node, a frontend server, or a CDN.

After changing React source:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

Commit the rebuilt bundle with source changes. Browser tests use sample data and intercepted API responses, without accessing the live database. Set `AI_JOBS_BROWSER` to an existing Chromium executable to use it for tests.
