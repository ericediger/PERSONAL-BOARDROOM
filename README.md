# Personal Board of Directors

A decision-support tool that simulates a board meeting with AI advisors. You submit structured memos, and a panel of AI personas analyzes your situation from different angles.

## The Board

| Persona | Role |
|---------|------|
| **Supreme Strategist** | Synthesizes all input into a final recommendation |
| **Board Secretary** | Normalizes your memo and maintains structure |
| **The Operator** | Breaks decisions into actionable execution plans |
| **Finance Brain** | Evaluates ROI, risk, and financial implications |
| **Craft Expert** | Provides domain-specific expertise and best practices |
| **The Contrarian** | Challenges assumptions and identifies failure modes |

## Quick Start

1. Clone this repo
2. Copy `.env.example` to `.env` and add your OpenAI API key
3. Run `npm install`
4. Run `npm run db:init` to set up the database
5. Run `npm run dev` to start the server
6. Open `frontend/index.html` in your browser

## Requirements

- Node.js 18+
- OpenAI API key (GPT-5.2 access)

## Documentation

- `CLAUDE.md` - Full project spec and architecture
- `BUILD.md` - Detailed setup guide

## License

MIT
