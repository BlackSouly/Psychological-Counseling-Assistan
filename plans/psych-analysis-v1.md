# Plan: Psychological Analysis Assistant V1

> Source PRD: [prd (6).md](</C:/Users/admin/Desktop/JJBand5/prd%20(6).md>)

## Architectural decisions

Durable decisions that apply across all phases:

- **Product scope**: V1 is text-only. Audio upload, ASR, and acoustic analysis are explicitly out of scope.
- **Deployment model**: single-machine local web app for professional desktop use. No cloud persistence in V1.
- **Backend boundary**: one local application service owns persistence, analysis orchestration, and risk-flag routing.
- **Frontend boundary**: one browser-based operator interface owns client selection, text entry, result review, timeline browsing, and annotation workflows.
- **Analysis pipeline**: `text input -> structured analysis -> REBT interpretation`, with risk screening running as an independent path instead of being folded into normal emotion analysis.
- **Persistence model**: filesystem-backed JSON records under `/data/<client_code>/<timestamp>_<session>.json`.
- **Key models**: `ClientProfile`, `SessionRecord`, `StructuredAnalysis`, `RiskAlert`, `AnnotationFeedback`, `DisagreementLabel`.
- **Privacy posture**: client identity is represented by code/alias only in the app dataset; direct identifiers are out of scope for V1.
- **Future classifier seam**: the structured-analysis step must be behind a replaceable interface so the V1 LLM-based classifier can later be replaced by a dedicated fine-tuned model without changing the UI or storage contract.

---

## Phase 1: End-to-End Text Analysis Slice

**User stories**:
- As a professional user, I can select or create a coded client profile.
- As a professional user, I can paste text and receive a structured analysis plus REBT-style interpretation.
- As a professional user, I can see confidence and clear "reference only" positioning for the AI result.

### What to build

Build the narrowest complete workflow from client selection to saved analysis output. The slice should support coded client profiles, one text input form, one analysis request, one stored session record, and one results screen containing structured labels, confidence, and REBT interpretation. This slice proves the core value proposition without timeline comparison or annotation depth yet.

### Acceptance criteria

- [ ] A user can create a client using a generated or manually entered code/alias without requiring real-name fields.
- [ ] A user can submit a text passage and receive structured labels for emotion category, intensity, cognitive pattern, emotion target, risk level, and confidence.
- [ ] A user can read a REBT-style interpretation that is explicitly framed as auxiliary analysis rather than diagnosis.
- [ ] The full session is persisted locally as JSON under a client-specific directory.
- [ ] The UI visibly labels the result as reference-only guidance for professional judgment.

---

## Phase 2: Independent Risk Alert Channel

**User stories**:
- As a professional user, I need self-harm or suicide signals highlighted with higher priority than ordinary emotional analysis.
- As a professional user, I need risk handling to remain logically separate from normal emotion labeling.

### What to build

Add an independent screening path that inspects the same text input for self-harm and suicide-related risk signals. The resulting risk alert should be stored beside the normal analysis but computed and displayed as a distinct channel with its own visibility and priority treatment.

### Acceptance criteria

- [ ] Risk screening runs on every analysis request through an explicit independent pipeline step.
- [ ] High-risk or uncertain-risk outcomes are displayed in a visually distinct warning area, not merged into generic emotion tags.
- [ ] Risk outcomes are stored in the session record with supporting rationale or signal notes suitable for professional review.
- [ ] The ordinary emotion-analysis output remains available even when a risk alert is present.

---

## Phase 3: Session History and Timeline Review

**User stories**:
- As a professional user, I can review prior sessions for the same coded client.
- As a professional user, I can observe historical shifts in emotional state and cognitive patterns over time.

### What to build

Extend the application from single-session analysis to longitudinal review. The operator should be able to reopen prior sessions for a client and navigate a time-ordered timeline of recorded analyses, including the original text, structured labels, risk state, and interpretation snapshot for each session.

### Acceptance criteria

- [ ] The app lists all saved sessions for a client in chronological order.
- [ ] A timeline view can display each session's timestamp, core emotion labels, cognitive-pattern summary, and risk state.
- [ ] Opening a historical session shows the exact stored output rather than recomputing a new result.
- [ ] The UI makes it easy to move between the latest session and historical sessions for the same client.

---

## Phase 4: Annotation and Feedback Loop

**User stories**:
- As a professional user, I can leave written comments on the AI output.
- As a professional user, I can rate the usefulness of a result and mark structured disagreements.
- As a product builder, I can accumulate high-quality feedback data for future model iteration.

### What to build

Add a feedback layer embedded directly into the result-review workflow. The operator should be able to attach free-text notes, a star rating, and structured disagreement fields to each stored session. The data should live in the same durable session record so it can later seed evaluation and model-training workflows.

### Acceptance criteria

- [ ] A user can add or edit a free-text annotation for a saved session.
- [ ] A user can assign a star rating to the AI result.
- [ ] A user can record structured disagreement by field, such as "emotion correct, cognitive pattern incorrect".
- [ ] Feedback updates are persisted locally without overwriting the original analysis output.
- [ ] Export is not required, but the stored JSON schema preserves feedback in a training-friendly structured form.

---

## Phase 5: V1 Safety, Storage, and Operator Polish

**User stories**:
- As a professional user, I need confidence that sensitive data stays local and understandable.
- As a product owner, I need the V1 release to be stable enough for internal evaluation and iterative improvement.

### What to build

Harden the V1 app around privacy posture, local-data conventions, copy constraints, and operator usability. This includes local-path conventions, visible consent/reminder copy, stable empty/loading/error states, and test coverage around persistence and analysis contracts. The goal is not broad feature expansion, but a reviewable V1 that is safe to evaluate with simulated or anonymized data.

### Acceptance criteria

- [ ] The application stores data only on the local machine in the documented JSON directory structure.
- [ ] The UI includes explicit auxiliary-analysis wording and does not present outputs as diagnosis.
- [ ] Simulated or anonymized test data can exercise the end-to-end workflow repeatedly without manual file edits.
- [ ] Contract tests cover session persistence, analysis-result shape, and feedback persistence.
- [ ] The release can be demonstrated end to end for one new client and multiple historical sessions.
