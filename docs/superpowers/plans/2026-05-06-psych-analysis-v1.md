# Psychological Analysis Assistant V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, text-only web application that lets a professional user create coded client profiles, analyze session text into structured emotional signals plus REBT-style interpretation, flag risk through an independent channel, save every session locally, and attach review feedback for later model iteration.

**Architecture:** Implement a local-first web app with a FastAPI backend and a React + TypeScript frontend. The backend owns JSON persistence, analysis orchestration, and the independent risk-screening path behind replaceable interfaces; the frontend owns operator workflows for client selection, text submission, result review, timeline browsing, and annotations. All stored records use a stable JSON schema so the V1 LLM-based analyzer can later be replaced by a dedicated classifier without changing UI or storage contracts.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, pytest, React, TypeScript, Vite, React Testing Library, Vitest, local filesystem JSON storage

---

## Proposed file structure

- `backend/app/main.py`: FastAPI application entrypoint, route registration, and startup configuration.
- `backend/app/config.py`: local path configuration and environment-backed settings.
- `backend/app/models/client.py`: `ClientProfile` request/response models.
- `backend/app/models/session.py`: `StructuredAnalysis`, `RiskAlert`, `AnnotationFeedback`, and `SessionRecord` schemas.
- `backend/app/services/analysis.py`: replaceable structured-analysis service interface and V1 LLM-backed implementation.
- `backend/app/services/risk.py`: independent risk-screening interface and V1 implementation.
- `backend/app/services/interpretation.py`: REBT interpretation interface and V1 implementation.
- `backend/app/services/storage.py`: JSON persistence for clients and sessions.
- `backend/app/api/clients.py`: client CRUD routes.
- `backend/app/api/sessions.py`: analyze, fetch, list timeline, and annotate routes.
- `backend/tests/test_clients_api.py`: backend client-route tests.
- `backend/tests/test_sessions_api.py`: backend session flow tests.
- `backend/tests/test_storage.py`: persistence contract tests.
- `frontend/src/main.tsx`: frontend bootstrap.
- `frontend/src/App.tsx`: route shell and top-level layout.
- `frontend/src/api.ts`: typed HTTP client wrappers.
- `frontend/src/types.ts`: shared frontend data contracts mirroring backend payloads.
- `frontend/src/components/ClientSidebar.tsx`: coded client selection and creation UI.
- `frontend/src/components/TextAnalysisForm.tsx`: text submission workflow and consent copy.
- `frontend/src/components/AnalysisResultPanel.tsx`: structured labels, confidence, REBT interpretation, and risk banner.
- `frontend/src/components/TimelinePanel.tsx`: session history and per-session navigation.
- `frontend/src/components/FeedbackPanel.tsx`: annotation, star rating, and structured disagreement UI.
- `frontend/src/styles.css`: application styling following the calm professional desktop direction from the PRD.
- `frontend/src/__tests__/app.spec.tsx`: end-to-end UI flow tests with mocked API responses.

## Durable architectural decisions

- **Routes**:
  - `GET /api/clients`
  - `POST /api/clients`
  - `GET /api/clients/{client_code}/sessions`
  - `POST /api/sessions/analyze`
  - `GET /api/sessions/{session_id}`
  - `PATCH /api/sessions/{session_id}/feedback`
- **Storage root**: `./data/<client_code>/<timestamp>_<session_id>.json`
- **Session schema**: each session stores immutable analysis output plus mutable feedback fields in one document.
- **Analyzer seam**: structured analysis, risk screening, and REBT interpretation are separate service interfaces.
- **Privacy posture**: coded client profiles only; no direct identifier fields in V1 data contracts.
- **Scope lock**: V1 is text-only. Audio and ASR are excluded from this implementation plan.

---

### Task 1: Scaffold the local-first application skeleton

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/config.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/clients.py`
- Create: `backend/app/api/sessions.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/tests/test_clients_api.py`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles.css`
- Test: `backend/tests/test_clients_api.py`

- [ ] **Step 1: Write the failing backend smoke test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_clients_endpoint_returns_200() -> None:
    client = TestClient(create_app())
    response = client.get("/api/clients")
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_clients_api.py::test_clients_endpoint_returns_200 -v`
Expected: FAIL with `ModuleNotFoundError` or missing `create_app`

- [ ] **Step 3: Write minimal backend application skeleton**

```python
from fastapi import APIRouter, FastAPI


def create_app() -> FastAPI:
    app = FastAPI(title="Psychological Analysis Assistant")
    api_router = APIRouter(prefix="/api")

    @api_router.get("/clients")
    def list_clients() -> list[dict]:
        return []

    app.include_router(api_router)
    return app
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_clients_api.py::test_clients_endpoint_returns_200 -v`
Expected: PASS

- [ ] **Step 5: Scaffold the frontend shell with the PRD layout**

```tsx
import "./styles.css";

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Psychological Analysis Assistant</h1>
        <p>Client list</p>
      </aside>
      <main className="workspace">
        <section className="input-panel">
          <h2>Session Text</h2>
        </section>
        <section className="result-panel">
          <h2>Analysis Result</h2>
          <p>AI output is reference-only and does not replace professional judgment.</p>
        </section>
      </main>
    </div>
  );
}
```

- [ ] **Step 6: Run the frontend smoke check**

Run: `npm test -- --runInBand`
Expected: FAIL or no tests configured yet, confirming frontend test setup still needs the next tasks

- [ ] **Step 7: Commit**

```bash
git add backend frontend
git commit -m "chore: scaffold local text-analysis app"
```

---

### Task 2: Define stable domain models and JSON persistence

**Files:**
- Create: `backend/app/models/client.py`
- Create: `backend/app/models/session.py`
- Create: `backend/app/services/storage.py`
- Create: `backend/tests/test_storage.py`
- Modify: `backend/app/api/clients.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_storage.py`

- [ ] **Step 1: Write the failing storage contract test**

```python
from pathlib import Path

from app.models.client import ClientProfile
from app.models.session import SessionRecord
from app.services.storage import JsonStorage


def test_save_session_writes_client_scoped_json(tmp_path: Path) -> None:
    storage = JsonStorage(tmp_path)
    client = ClientProfile(client_code="client_001", alias="Client 001")
    session = SessionRecord.build_initial(
        client_code="client_001",
        source_text="I am exhausted and angry.",
    )

    storage.save_client(client)
    saved_path = storage.save_session(session)

    assert saved_path.parent.name == "client_001"
    assert saved_path.suffix == ".json"
    assert saved_path.exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_storage.py::test_save_session_writes_client_scoped_json -v`
Expected: FAIL with missing models or storage implementation

- [ ] **Step 3: Define the core data models**

```python
from pydantic import BaseModel, Field


class ClientProfile(BaseModel):
    client_code: str = Field(pattern=r"^client_[0-9]{3,}$")
    alias: str


class StructuredAnalysis(BaseModel):
    emotion_labels: list[str]
    intensity: str
    cognitive_patterns: list[str]
    emotion_target: str
    confidence: float
    risk_level: str


class RiskAlert(BaseModel):
    level: str
    signals: list[str]
    summary: str


class AnnotationFeedback(BaseModel):
    notes: str = ""
    rating: int | None = None
    disagreements: dict[str, str] = {}


class SessionRecord(BaseModel):
    session_id: str
    client_code: str
    created_at: str
    source_text: str
    analysis: StructuredAnalysis | None = None
    risk_alert: RiskAlert | None = None
    interpretation: str = ""
    feedback: AnnotationFeedback = AnnotationFeedback()
```

- [ ] **Step 4: Implement the JSON storage adapter**

```python
import json
from datetime import datetime, UTC
from pathlib import Path
from uuid import uuid4


class JsonStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def save_client(self, client: ClientProfile) -> Path:
        client_dir = self.root / client.client_code
        client_dir.mkdir(parents=True, exist_ok=True)
        profile_path = client_dir / "profile.json"
        profile_path.write_text(client.model_dump_json(indent=2), encoding="utf-8")
        return profile_path

    def save_session(self, session: SessionRecord) -> Path:
        session_dir = self.root / session.client_code
        session_dir.mkdir(parents=True, exist_ok=True)
        file_name = f"{session.created_at}_{session.session_id}.json"
        session_path = session_dir / file_name
        session_path.write_text(session.model_dump_json(indent=2), encoding="utf-8")
        return session_path
```

- [ ] **Step 5: Run tests to verify persistence passes**

Run: `pytest backend/tests/test_storage.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/models backend/app/services/storage.py backend/tests/test_storage.py
git commit -m "feat: add core data models and json persistence"
```

---

### Task 3: Deliver coded client management and timeline listing

**Files:**
- Modify: `backend/app/api/clients.py`
- Modify: `backend/app/services/storage.py`
- Create: `backend/tests/test_clients_api.py`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api.ts`
- Create: `frontend/src/components/ClientSidebar.tsx`
- Create: `frontend/src/components/TimelinePanel.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `backend/tests/test_clients_api.py`
- Test: `frontend/src/__tests__/app.spec.tsx`

- [ ] **Step 1: Write the failing client creation and listing test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_create_client_and_list_it() -> None:
    client = TestClient(create_app())
    create_response = client.post(
        "/api/clients",
        json={"client_code": "client_001", "alias": "Client 001"},
    )
    assert create_response.status_code == 201

    list_response = client.get("/api/clients")
    assert list_response.status_code == 200
    assert list_response.json() == [{"client_code": "client_001", "alias": "Client 001"}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_clients_api.py::test_create_client_and_list_it -v`
Expected: FAIL with `405 Method Not Allowed` or incorrect response body

- [ ] **Step 3: Implement client routes backed by storage**

```python
@router.get("/clients", response_model=list[ClientProfile])
def list_clients(storage: StorageDep) -> list[ClientProfile]:
    return storage.list_clients()


@router.post("/clients", response_model=ClientProfile, status_code=201)
def create_client(payload: ClientProfile, storage: StorageDep) -> ClientProfile:
    storage.save_client(payload)
    return payload
```

- [ ] **Step 4: Add timeline listing for client sessions**

```python
@router.get("/clients/{client_code}/sessions", response_model=list[SessionSummary])
def list_client_sessions(client_code: str, storage: StorageDep) -> list[SessionSummary]:
    return storage.list_session_summaries(client_code)
```

- [ ] **Step 5: Build the sidebar and timeline UI**

```tsx
export function ClientSidebar(props: {
  clients: ClientProfile[];
  activeClientCode: string | null;
  onSelectClient: (clientCode: string) => void;
  onCreateClient: (payload: ClientProfile) => Promise<void>;
}) {
  return (
    <aside className="sidebar">
      <h1>Clients</h1>
      <ul>
        {props.clients.map((client) => (
          <li key={client.client_code}>
            <button onClick={() => props.onSelectClient(client.client_code)}>
              {client.alias}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 6: Run backend and frontend tests**

Run: `pytest backend/tests/test_clients_api.py -v`
Expected: PASS

Run: `npm test -- --runInBand`
Expected: PASS for the new client-list rendering test

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/clients.py backend/app/services/storage.py backend/tests/test_clients_api.py frontend/src
git commit -m "feat: add client management and timeline listing"
```

---

### Task 4: Implement the text analysis pipeline with replaceable service seams

**Files:**
- Create: `backend/app/services/analysis.py`
- Create: `backend/app/services/interpretation.py`
- Create: `backend/tests/test_sessions_api.py`
- Modify: `backend/app/models/session.py`
- Modify: `backend/app/api/sessions.py`
- Create: `frontend/src/components/TextAnalysisForm.tsx`
- Create: `frontend/src/components/AnalysisResultPanel.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `backend/tests/test_sessions_api.py`

- [ ] **Step 1: Write the failing session analysis API test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_analyze_text_returns_structured_result_and_interpretation() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/api/sessions/analyze",
        json={
            "client_code": "client_001",
            "source_text": "我最近一直很焦虑，总觉得事情会失控。",
        },
    )
    body = response.json()
    assert response.status_code == 201
    assert body["analysis"]["emotion_labels"]
    assert body["analysis"]["confidence"] >= 0
    assert body["interpretation"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_sessions_api.py::test_analyze_text_returns_structured_result_and_interpretation -v`
Expected: FAIL with missing route or missing response fields

- [ ] **Step 3: Add the analysis and interpretation interfaces**

```python
from typing import Protocol


class StructuredAnalyzer(Protocol):
    def analyze(self, text: str) -> StructuredAnalysis: ...


class RebtInterpreter(Protocol):
    def interpret(self, text: str, analysis: StructuredAnalysis) -> str: ...
```

- [ ] **Step 4: Implement the V1 route orchestration**

```python
@router.post("/sessions/analyze", response_model=SessionRecord, status_code=201)
def analyze_session(payload: AnalyzeSessionRequest, services: SessionServicesDep) -> SessionRecord:
    analysis = services.analyzer.analyze(payload.source_text)
    interpretation = services.interpreter.interpret(payload.source_text, analysis)
    session = SessionRecord.create_completed(
        client_code=payload.client_code,
        source_text=payload.source_text,
        analysis=analysis,
        interpretation=interpretation,
    )
    services.storage.save_session(session)
    return session
```

- [ ] **Step 5: Build the frontend text submission and result display**

```tsx
export function TextAnalysisForm(props: {
  clientCode: string | null;
  onAnalyze: (sourceText: string) => Promise<void>;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <label htmlFor="sourceText">Session text</label>
      <textarea id="sourceText" name="sourceText" rows={14} />
      <p className="helper">
        AI output is reference-only and does not replace professional judgment.
      </p>
      <button type="submit" disabled={!props.clientCode}>
        Analyze text
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Run tests to verify the vertical slice passes**

Run: `pytest backend/tests/test_sessions_api.py -v`
Expected: PASS

Run: `npm test -- --runInBand`
Expected: PASS for text submission and result rendering tests

- [ ] **Step 7: Commit**

```bash
git add backend/app/services backend/app/api/sessions.py backend/tests/test_sessions_api.py frontend/src
git commit -m "feat: add text analysis pipeline"
```

---

### Task 5: Add the independent risk-screening channel

**Files:**
- Create: `backend/app/services/risk.py`
- Modify: `backend/app/models/session.py`
- Modify: `backend/app/api/sessions.py`
- Modify: `backend/tests/test_sessions_api.py`
- Modify: `frontend/src/components/AnalysisResultPanel.tsx`
- Modify: `frontend/src/types.ts`
- Test: `backend/tests/test_sessions_api.py`

- [ ] **Step 1: Write the failing risk-path test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_analysis_response_contains_distinct_risk_alert_channel() -> None:
    client = TestClient(create_app())
    response = client.post(
        "/api/sessions/analyze",
        json={
            "client_code": "client_001",
            "source_text": "我不想活了，觉得没有意义。",
        },
    )
    body = response.json()
    assert response.status_code == 201
    assert "risk_alert" in body
    assert body["risk_alert"]["level"] in {"none", "review", "urgent"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_sessions_api.py::test_analysis_response_contains_distinct_risk_alert_channel -v`
Expected: FAIL because `risk_alert` is missing or always `null`

- [ ] **Step 3: Implement an explicit risk service and route integration**

```python
class RiskScreeningService(Protocol):
    def screen(self, text: str) -> RiskAlert: ...


@router.post("/sessions/analyze", response_model=SessionRecord, status_code=201)
def analyze_session(payload: AnalyzeSessionRequest, services: SessionServicesDep) -> SessionRecord:
    risk_alert = services.risk.screen(payload.source_text)
    analysis = services.analyzer.analyze(payload.source_text)
    interpretation = services.interpreter.interpret(payload.source_text, analysis)
    session = SessionRecord.create_completed(
        client_code=payload.client_code,
        source_text=payload.source_text,
        analysis=analysis,
        risk_alert=risk_alert,
        interpretation=interpretation,
    )
    services.storage.save_session(session)
    return session
```

- [ ] **Step 4: Surface the risk banner separately in the result UI**

```tsx
if (result.risk_alert.level !== "none") {
  return (
    <section className="risk-banner" role="alert">
      <h3>Risk review required</h3>
      <p>{result.risk_alert.summary}</p>
    </section>
  );
}
```

- [ ] **Step 5: Run tests to verify the independent channel works**

Run: `pytest backend/tests/test_sessions_api.py -v`
Expected: PASS

Run: `npm test -- --runInBand`
Expected: PASS for risk-banner rendering tests

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/risk.py backend/app/api/sessions.py backend/tests/test_sessions_api.py frontend/src/components/AnalysisResultPanel.tsx frontend/src/types.ts
git commit -m "feat: add independent risk alert channel"
```

---

### Task 6: Add feedback, disagreement labels, and immutable session review

**Files:**
- Modify: `backend/app/models/session.py`
- Modify: `backend/app/services/storage.py`
- Modify: `backend/app/api/sessions.py`
- Modify: `backend/tests/test_sessions_api.py`
- Create: `frontend/src/components/FeedbackPanel.tsx`
- Modify: `frontend/src/components/TimelinePanel.tsx`
- Modify: `frontend/src/components/AnalysisResultPanel.tsx`
- Modify: `frontend/src/api.ts`
- Modify: `frontend/src/App.tsx`
- Test: `backend/tests/test_sessions_api.py`

- [ ] **Step 1: Write the failing feedback update test**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_feedback_patch_updates_notes_rating_and_disagreements_only() -> None:
    client = TestClient(create_app())
    session = client.post(
        "/api/sessions/analyze",
        json={"client_code": "client_001", "source_text": "我最近非常烦躁。"},
    ).json()

    response = client.patch(
        f"/api/sessions/{session['session_id']}/feedback",
        json={
            "notes": "情绪识别基本准确，但认知模式偏差较大。",
            "rating": 3,
            "disagreements": {"cognitive_patterns": "should emphasize catastrophizing less"},
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["feedback"]["rating"] == 3
    assert body["analysis"] == session["analysis"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_sessions_api.py::test_feedback_patch_updates_notes_rating_and_disagreements_only -v`
Expected: FAIL with missing patch route or overwritten analysis payload

- [ ] **Step 3: Implement feedback patch persistence**

```python
@router.patch("/sessions/{session_id}/feedback", response_model=SessionRecord)
def update_feedback(
    session_id: str,
    payload: AnnotationFeedback,
    storage: StorageDep,
) -> SessionRecord:
    session = storage.get_session(session_id)
    updated = session.model_copy(update={"feedback": payload})
    storage.save_session(updated)
    return updated
```

- [ ] **Step 4: Add embedded feedback UI on the result screen**

```tsx
export function FeedbackPanel(props: {
  feedback: AnnotationFeedback;
  onSave: (feedback: AnnotationFeedback) => Promise<void>;
}) {
  return (
    <form onSubmit={props.onSubmit}>
      <label htmlFor="notes">Professional notes</label>
      <textarea id="notes" name="notes" rows={6} defaultValue={props.feedback.notes} />
      <label htmlFor="rating">Rating</label>
      <input id="rating" name="rating" type="number" min={1} max={5} />
      <button type="submit">Save feedback</button>
    </form>
  );
}
```

- [ ] **Step 5: Run tests to verify session review stays immutable except feedback**

Run: `pytest backend/tests/test_sessions_api.py -v`
Expected: PASS

Run: `npm test -- --runInBand`
Expected: PASS for feedback submission and historical-session rendering tests

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/session.py backend/app/services/storage.py backend/app/api/sessions.py backend/tests/test_sessions_api.py frontend/src
git commit -m "feat: add feedback and disagreement annotations"
```

---

### Task 7: Polish V1 privacy copy, operator states, and verification coverage

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/TextAnalysisForm.tsx`
- Modify: `frontend/src/components/AnalysisResultPanel.tsx`
- Modify: `frontend/src/styles.css`
- Modify: `backend/tests/test_storage.py`
- Modify: `backend/tests/test_sessions_api.py`
- Create: `frontend/src/__tests__/app.spec.tsx`
- Test: `backend/tests/test_storage.py`
- Test: `backend/tests/test_sessions_api.py`
- Test: `frontend/src/__tests__/app.spec.tsx`

- [ ] **Step 1: Write the failing UI-policy test**

```tsx
import { render, screen } from "@testing-library/react";
import App from "../App";


test("renders reference-only and local-storage guidance", () => {
  render(<App />);
  expect(screen.getByText(/reference-only/i)).toBeInTheDocument();
  expect(screen.getByText(/stored locally/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand frontend/src/__tests__/app.spec.tsx`
Expected: FAIL because the required copy is not fully present

- [ ] **Step 3: Add explicit privacy and scope copy plus stable empty/loading/error states**

```tsx
<p className="policy-copy">
  This tool stores session records locally on this machine and provides AI-assisted,
  reference-only analysis for professional review. It does not provide diagnosis.
</p>
```

- [ ] **Step 4: Add verification coverage for local JSON shape and timeline ordering**

```python
def test_list_session_summaries_returns_newest_first(tmp_path: Path) -> None:
    storage = JsonStorage(tmp_path)
    ...
    summaries = storage.list_session_summaries("client_001")
    assert [summary.session_id for summary in summaries] == ["session_b", "session_a"]
```

- [ ] **Step 5: Run the full project verification**

Run: `pytest backend/tests -v`
Expected: PASS

Run: `npm test -- --runInBand`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/tests frontend/src
git commit -m "chore: finalize v1 copy and verification coverage"
```

---

## Self-review checklist

- **PRD coverage:** this plan covers coded client management, text input only, structured analysis, REBT interpretation, confidence display, independent risk alerts, local JSON persistence, historical timeline review, and embedded feedback loops.
- **Intentional exclusions:** audio input, ASR, acoustic features, report export, advanced visualization, multi-framework interpretations, and client-side mobile apps remain out of scope.
- **Durable seams preserved:** the plan keeps structured analysis, risk screening, interpretation, UI presentation, and persistence as replaceable units so V2 can add a dedicated classifier without rewriting the product shape.

Plan complete and saved to `docs/superpowers/plans/2026-05-06-psych-analysis-v1.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
