import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse


DATA_DIR = Path.cwd() / "data"
DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com"
DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514"
DISALLOWED_AI_GATEWAY_HOSTS = {"x666.me"}


@dataclass(frozen=True)
class ProviderConfig:
    api_key: str | None
    base_url: str
    model: str


def get_provider_config() -> ProviderConfig:
    return ProviderConfig(
        api_key=os.environ.get("ANTHROPIC_API_KEY"),
        base_url=os.environ.get("ANTHROPIC_BASE_URL", DEFAULT_ANTHROPIC_BASE_URL),
        model=os.environ.get("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL),
    )


def validate_provider_config(config: ProviderConfig) -> None:
    if not config.api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured.")

    if not config.model.strip():
        raise RuntimeError("ANTHROPIC_MODEL is not configured.")

    parsed_url = urlparse(config.base_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise RuntimeError("ANTHROPIC_BASE_URL must be a valid absolute HTTP(S) URL.")

    if parsed_url.hostname in DISALLOWED_AI_GATEWAY_HOSTS:
        raise RuntimeError(
            f"The AI gateway host '{parsed_url.hostname}' is disallowed. "
            "Use the configured DeepSeek Anthropic-compatible endpoint instead."
        )
