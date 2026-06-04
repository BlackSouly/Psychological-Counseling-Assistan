from __future__ import annotations

from pathlib import Path
import shutil

from app.models.client import ClientProfile
from app.models.session import RebtWorksheet, SessionRebtFormulation, SessionRecord, SessionSummary


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

    def _latest_session_updated_at(self, client_code: str) -> str:
        client_dir = self.root / client_code
        if not client_dir.exists():
            return ""

        latest = ""
        for session_path in client_dir.glob("*.json"):
            if session_path.name == "profile.json":
                continue
            session = SessionRecord.model_validate_json(session_path.read_text(encoding="utf-8"))
            latest = max(latest, session.updated_at)
        return latest

    def list_clients(self) -> list[ClientProfile]:
        if not self.root.exists():
            return []

        clients_with_order: list[tuple[str, ClientProfile]] = []
        for profile_path in sorted(self.root.glob("*/profile.json")):
            client = ClientProfile.model_validate_json(profile_path.read_text(encoding="utf-8"))
            clients_with_order.append((self._latest_session_updated_at(client.client_code), client))
        clients_with_order.sort(key=lambda item: (item[0], item[1].client_code), reverse=True)
        return [client for _, client in clients_with_order]

    def allocate_next_client_code(self) -> str:
        highest_suffix = 0
        for client in self.list_clients():
            prefix, _, suffix = client.client_code.partition("_")
            if prefix != "client" or not suffix.isdigit():
                continue
            highest_suffix = max(highest_suffix, int(suffix))
        return f"client_{highest_suffix + 1:03d}"

    def get_client(self, client_code: str) -> ClientProfile:
        profile_path = self.root / client_code / "profile.json"
        if not profile_path.exists():
            raise FileNotFoundError(f"Client not found: {client_code}")
        return ClientProfile.model_validate_json(profile_path.read_text(encoding="utf-8"))

    def delete_client(self, client_code: str) -> None:
        client_dir = self.root / client_code
        if not client_dir.exists():
            raise FileNotFoundError(f"Client not found: {client_code}")
        shutil.rmtree(client_dir)

    def _non_empty_unique(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for value in values:
            normalized = value.strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            result.append(normalized)
        return result

    def _worksheet_source(self, session: SessionRecord) -> RebtWorksheet:
        if any(value.strip() for value in session.rebt_worksheet.model_dump().values()):
            return session.rebt_worksheet
        return session.rebt_plan.worksheet_draft

    def _session_rebt_formulation(self, session: SessionRecord) -> SessionRebtFormulation:
        worksheet = self._worksheet_source(session)
        line_items = session.rebt_plan.line_interpretations

        return SessionRebtFormulation(
            activating_events=self._non_empty_unique(
                [worksheet.activating_event, *[item.activating_event for item in line_items]]
            ),
            beliefs=self._non_empty_unique([worksheet.belief, *[item.belief for item in line_items]]),
            consequences=self._non_empty_unique(
                [worksheet.consequence, *[item.consequence for item in line_items]]
            ),
            disputes=self._non_empty_unique(
                [
                    worksheet.dispute,
                    *[item.dispute_direction for item in line_items],
                    *[item.intervention_question for item in line_items],
                ]
            ),
            effective_beliefs=self._non_empty_unique([worksheet.effective_belief]),
            interventions=self._non_empty_unique([item.title for item in session.rebt_plan.items]),
        )

    def list_session_summaries(self, client_code: str) -> list[SessionSummary]:
        client_dir = self.root / client_code
        if not client_dir.exists():
            return []

        summaries: list[SessionSummary] = []
        for session_path in client_dir.glob("*.json"):
            if session_path.name == "profile.json":
                continue
            session = SessionRecord.model_validate_json(session_path.read_text(encoding="utf-8"))
            summaries.append(
                SessionSummary(
                    session_id=session.session_id,
                    created_at=session.created_at,
                    updated_at=session.updated_at,
                    source_text=session.source_text,
                    emotion_labels=session.analysis.emotion_labels if session.analysis else [],
                    intensity=session.analysis.intensity if session.analysis else "",
                    cognitive_patterns=session.analysis.cognitive_patterns if session.analysis else [],
                    risk_level=session.risk_alert.level if session.risk_alert else "none",
                    has_rebt_worksheet=any(
                        value.strip() for value in session.rebt_worksheet.model_dump().values()
                    ),
                    rebt_formulation=self._session_rebt_formulation(session),
                )
            )
        summaries.sort(key=lambda summary: (summary.updated_at, summary.session_id), reverse=True)
        return summaries

    def get_session(self, session_id: str) -> SessionRecord:
        for session_path in self.root.glob("*/*.json"):
            if session_path.name == "profile.json":
                continue
            session = SessionRecord.model_validate_json(session_path.read_text(encoding="utf-8"))
            if session.session_id == session_id:
                return session
        raise FileNotFoundError(f"Session not found: {session_id}")
