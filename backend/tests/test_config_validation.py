import pytest
from pydantic import ValidationError

from app.core.config import Settings

GOOD = "x" * 40


def _make(**kw):
    return Settings(_env_file=None, **kw)


@pytest.mark.parametrize("bad", [
    "",
    "short",
    "dev-secret-change-in-production",
    "change-me-in-production",
    "change-me-" + "x" * 30,
])
def test_bad_secret_rejected(bad):
    with pytest.raises(ValidationError):
        _make(SECRET_KEY=bad)


def test_missing_secret_rejected(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValidationError):
        _make()


def test_good_secret_and_defaults(monkeypatch):
    monkeypatch.delenv("ENV", raising=False)
    s = _make(SECRET_KEY=GOOD)
    assert s.ENV == "dev" and s.CORS_ORIGIN_REGEX is None
    assert s.ACCESS_TOKEN_EXPIRE_MINUTES == 15 and s.REFRESH_TOKEN_EXPIRE_DAYS == 7


def test_empty_cors_regex_is_none():
    assert _make(SECRET_KEY=GOOD, CORS_ORIGIN_REGEX="").CORS_ORIGIN_REGEX is None
