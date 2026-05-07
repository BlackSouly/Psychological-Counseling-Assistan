from pathlib import Path
import json

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


def test_list_session_summaries_returns_newest_first(tmp_path: Path) -> None:
    storage = JsonStorage(tmp_path)
    client = ClientProfile(client_code="client_001", alias="Client 001")
    storage.save_client(client)

    older = SessionRecord(
        session_id="session_a",
        client_code="client_001",
        created_at="2026-05-06T10-00-00Z",
        source_text="older",
    )
    newer = SessionRecord(
        session_id="session_b",
        client_code="client_001",
        created_at="2026-05-06T12-00-00Z",
        source_text="newer",
    )

    storage.save_session(older)
    storage.save_session(newer)

    summaries = storage.list_session_summaries("client_001")
    assert [summary.session_id for summary in summaries] == ["session_b", "session_a"]


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
