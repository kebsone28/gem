# PMTiles Dev Server

This folder contains a minimal Express server to serve vector tiles (.pbf) for development.

Usage (development):

1. Install dependencies inside the folder:

```bash
cd backend/pmtiles-server
npm install
```

2. Start dev server (hot-reloads when files in `data/` change):

```bash
npm run dev
```

3. Start production server:

```bash
npm run start
```

Notes:
- Place your tiles under `backend/pmtiles-server/data/{z}/{x}/{y}.pbf`.
- The server listens on port 4000 by default (configure via `PORT` env var).
- Works on Windows and Linux. Use WSL on Windows where appropriate.
