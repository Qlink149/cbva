"""The test suite refuses to run against a remote MongoDB (it deletes data) unless ALLOW_REMOTE_TEST_DB=1."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

from tests.db_guard import check_test_database, mongo_hosts

BACKEND = Path(__file__).resolve().parents[1]
OK_DB = "cbva_test"


@pytest.mark.parametrize("url", [
    "mongodb://localhost:27017",
    "mongodb://127.0.0.1:27017",
    "mongodb://mongo:27017",
    "mongodb://LOCALHOST:27017",
    "mongodb://user:pa%40ss@localhost:27017/?authSource=admin",
    "mongodb://localhost:27017,127.0.0.1:27018,mongo:27019/?replicaSet=rs0",
    "mongodb://localhost",
])
def test_local_hosts_allowed(url):
    check_test_database(url, OK_DB)


@pytest.mark.parametrize("url", [
    "mongodb://cluster0.abcde.mongodb.net:27017",
    "mongodb://203.0.113.9:27017",
    "mongodb://localhost@evil.example.com:27017/",          # 'localhost' is only the user name
    "mongodb://localhost.evil.example.com:27017",           # look-alike suffix
    "mongodb://127.0.0.1.evil.io:27017",
    "mongodb://evil.example.com/localhost",                 # 'localhost' only in the path
    "mongodb://evil.example.com:27017/?replicaSet=localhost",
    "mongodb://localhost:27017,evil.example.com:27017",     # one bad host in a replica set
    "mongodb://[::1]:27017",                                # not in the allow-list
    "mongodb+srv://cluster0.abcde.mongodb.net/",            # SRV always resolves remotely
    "mongodb+srv://localhost",
    "",
])
def test_remote_hosts_refused(url):
    with pytest.raises(RuntimeError, match="Refusing to run tests"):
        check_test_database(url, OK_DB)


def test_allow_remote_flag_permits_remote_host():
    check_test_database("mongodb://cluster0.abcde.mongodb.net:27017", OK_DB, allow_remote=True)
    check_test_database("mongodb+srv://cluster0.abcde.mongodb.net/", OK_DB, allow_remote=True)


@pytest.mark.parametrize("allow_remote", [False, True])
@pytest.mark.parametrize("name", ["cbva", "cbva_db", "production", "cbva_test_x", ""])
def test_db_name_must_end_with_test_even_when_remote_allowed(name, allow_remote):
    with pytest.raises(RuntimeError, match="_test"):
        check_test_database("mongodb://localhost:27017", name, allow_remote=allow_remote)


def test_error_never_contains_credentials():
    url = "mongodb://appuser:SuperSecretPw1@db.prod.example.com:27017/cbva"
    with pytest.raises(RuntimeError) as ei:
        check_test_database(url, OK_DB)
    msg = str(ei.value)
    assert "SuperSecretPw1" not in msg and "appuser" not in msg
    assert "db.prod.example.com" in msg and "ALLOW_REMOTE_TEST_DB=1" in msg


def test_mongo_hosts_parsing():
    assert mongo_hosts("mongodb://u:p@A.example.com:1,b.example.com:2/db?x=1") == ["a.example.com", "b.example.com"]
    assert mongo_hosts("mongodb://[::1]:27017/") == ["::1"]
    assert mongo_hosts("mongodb://u:p@ss@h.example.com/") == ["h.example.com"]   # last '@' separates credentials


# ---------------- end to end: a real pytest run, conftest import included ----------------

def _pytest_collect(env_overrides: dict) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if k not in {"MONGODB_URL", "DATABASE_NAME", "ALLOW_REMOTE_TEST_DB"}}
    env.update(env_overrides)
    return subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "-p", "no:cacheprovider", "tests/test_health.py"],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=120,
    )


def test_pytest_run_aborts_for_remote_url_and_leaks_nothing():
    proc = _pytest_collect({"MONGODB_URL": "mongodb://appuser:SuperSecretPw1@db.prod.example.com:27017/cbva"})
    out = proc.stdout + proc.stderr
    assert proc.returncode != 0, out
    assert "Refusing to run tests" in out and "db.prod.example.com" in out
    assert "SuperSecretPw1" not in out and "appuser" not in out


def test_pytest_run_proceeds_with_override_flag():
    proc = _pytest_collect({"MONGODB_URL": "mongodb://db.disposable.example.com:27017", "ALLOW_REMOTE_TEST_DB": "1"})
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_pytest_run_proceeds_for_local_url():
    proc = _pytest_collect({"MONGODB_URL": "mongodb://mongo:27017"})
    assert proc.returncode == 0, proc.stdout + proc.stderr
