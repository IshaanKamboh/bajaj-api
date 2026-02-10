# BFHL API

Simple REST API for Chitkara qualifier assignment.

Endpoints:
- `POST /bfhl` — Accepts exactly one key: `fibonacci`, `prime`, `lcm`, `hcf`, or `AI`.
- `GET /health` — Health check.

Responses follow the structure:
```
{ "is_success": true, "official_email": "YOUR_EMAIL", "data": ... }
```

Setup:
1. Copy `.env.example` to `.env` and fill `OFFICIAL_EMAIL` and `OPENAI_API_KEY`.
2. Install dependencies: `npm install` (project already uses `express`, `cors`, `axios`, `dotenv`).
3. Run: `node index.js` or `npm start`.

AI integration uses OpenAI. Provide `OPENAI_API_KEY` in `.env` for `AI` requests.

Example request bodies and responses are in the assignment prompt.
