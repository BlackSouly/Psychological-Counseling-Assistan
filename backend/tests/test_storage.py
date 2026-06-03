from pathlib import Path
import json

from app.models.client import ClientProfile
from app.models.session import RebtWorksheet, SessionRecord, StructuredAnalysis
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


def test_list_session_summaries_returns_most_recently_updated_first(tmp_path: Path) -> None:
    storage = JsonStorage(tmp_path)
    client = ClientProfile(client_code="client_001", alias="Client 001")
    storage.save_client(client)

    older = SessionRecord(
        session_id="session_a",
        client_code="client_001",
        created_at="2026-05-06T10-00-00Z",
        updated_at="2026-05-06T10-00-00Z",
        source_text="older",
    )
    newer = SessionRecord(
        session_id="session_b",
        client_code="client_001",
        created_at="2026-05-06T12-00-00Z",
        updated_at="2026-05-06T13-00-00Z",
        source_text="newer",
    )

    storage.save_session(older)
    storage.save_session(newer)

    summaries = storage.list_session_summaries("client_001")
    assert [summary.session_id for summary in summaries] == ["session_b", "session_a"]


def test_list_session_summaries_includes_intensity_and_worksheet_state(tmp_path: Path) -> None:
    storage = JsonStorage(tmp_path)
    client = ClientProfile(client_code="client_001", alias="Client 001")
    storage.save_client(client)

    session = SessionRecord(
        session_id="session_a",
        client_code="client_001",
        created_at="2026-05-06T10-00-00Z",
        updated_at="2026-05-06T10-00-00Z",
        source_text="session text",
        analysis=StructuredAnalysis(
            emotion_labels=["焦虑"],
            intensity="高",
            cognitive_patterns=["灾难化"],
            emotion_target="自身",
            confidence=0.9,
            risk_level="review",
        ),
        rebt_worksheet=RebtWorksheet(activating_event="A event"),
    )
    storage.save_session(session)

    summary = storage.list_session_summaries("client_001")[0]
    assert summary.intensity == "高"
    assert summary.has_rebt_worksheet is True


def test_list_clients_returns_most_recently_updated_clients_first(tmp_path: Path) -> None:
    storage = JsonStorage(tmp_path)
    older_client = ClientProfile(client_code="client_001", alias="Older Client")
    newer_client = ClientProfile(client_code="client_002", alias="Newer Client")
    storage.save_client(older_client)
    storage.save_client(newer_client)

    storage.save_session(
        SessionRecord(
            session_id="session_a",
            client_code="client_001",
            created_at="2026-05-06T10-00-00Z",
            updated_at="2026-05-06T10-00-00Z",
            source_text="older",
        )
    )
    storage.save_session(
        SessionRecord(
            session_id="session_b",
            client_code="client_002",
            created_at="2026-05-06T09-00-00Z",
            updated_at="2026-05-06T14-00-00Z",
            source_text="newer",
        )
    )

    clients = storage.list_clients()

    assert [client.client_code for client in clients] == ["client_002", "client_001"]


def test_list_clients_defaults_status_for_legacy_profile(tmp_path: Path) -> None:
    legacy_dir = tmp_path / "client_001"
    legacy_dir.mkdir(parents=True)
    (legacy_dir / "profile.json").write_text(
        json.dumps({"client_code": "client_001", "alias": "Legacy Client"}),
        encoding="utf-8",
    )

    storage = JsonStorage(tmp_path)

    clients = storage.list_clients()

    assert len(clients) == 1
    assert clients[0].status == "待初评"


def test_delete_client_removes_client_directory(tmp_path: Path) -> None:
    storage = JsonStorage(tmp_path)
    client = ClientProfile(client_code="client_001", alias="Client 001", status="待初评")
    session = SessionRecord.build_initial(
        client_code="client_001",
        source_text="I am exhausted and angry.",
    )

    storage.save_client(client)
    storage.save_session(session)

    storage.delete_client("client_001")

    assert not (tmp_path / "client_001").exists()
    assert storage.list_clients() == []
