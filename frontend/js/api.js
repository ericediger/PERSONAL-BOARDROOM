const API_BASE = 'http://localhost:3000/api';

const api = {
  async getSessions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/sessions?${query}`);
    return res.json();
  },

  async getSession(id) {
    const res = await fetch(`${API_BASE}/sessions/${id}`);
    return res.json();
  },

  async createSession(category) {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    return res.json();
  },

  async saveMemo(sessionId, memo) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/memo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memo)
    });
    return res.json();
  },

  async runBoardMeeting(sessionId) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/run`, {
      method: 'POST'
    });
    return res.json();
  },

  async getDecisions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/decisions?${query}`);
    return res.json();
  },

  async finalizeDecision(sessionId, decision) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision)
    });
    return res.json();
  },

  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  }
};
