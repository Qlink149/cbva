"""Safety guard for the test suite: it must only ever talk to a local, throw-away MongoDB.

conftest teardown calls delete_many({}) on real collection names, so pointing the suite at a remote cluster
(e.g. a developer's .env that holds the production URL) must be impossible by accident.
"""

ALLOWED_TEST_HOSTS = frozenset({"localhost", "127.0.0.1", "mongo"})  # mongo = the compose / CI service name


def mongo_hosts(url: str) -> list[str]:
    """Host names in a MongoDB URL (lower-cased, no port, no credentials). A list, for replica-set URLs."""
    rest = url.split("://", 1)[1] if "://" in url else url
    authority = rest.split("/", 1)[0].split("?", 1)[0]
    host_list = authority.rsplit("@", 1)[-1]          # drop user:password@ (last '@' wins)
    hosts = []
    for entry in host_list.split(","):
        entry = entry.strip()
        if entry.startswith("["):                     # [ipv6]:port
            host = entry[1:].split("]", 1)[0]
        else:
            host = entry.rsplit(":", 1)[0] if ":" in entry else entry
        hosts.append(host.lower())
    return hosts


def check_test_database(url: str, db_name: str, allow_remote: bool = False) -> None:
    """Raise RuntimeError unless the URL points at a local MongoDB and the database name ends with '_test'.

    ALLOW_REMOTE_TEST_DB=1 (allow_remote=True) permits a remote host, e.g. a disposable CI database;
    the '_test' suffix is required either way. Credentials are never included in the error message.
    """
    if not db_name.endswith("_test"):
        raise RuntimeError(f"Refusing to run tests: DATABASE_NAME={db_name!r} does not end with '_test'.")
    if allow_remote:
        return
    hosts = mongo_hosts(url or "")
    is_srv = (url or "").lower().startswith("mongodb+srv://")
    if not url or is_srv or not hosts or any(h not in ALLOWED_TEST_HOSTS for h in hosts):
        shown = ", ".join(hosts) if hosts and not is_srv else ("(mongodb+srv URL)" if is_srv else "(empty)")
        raise RuntimeError(
            f"Refusing to run tests: MONGODB_URL host(s) {shown} are not local "
            f"(allowed: {', '.join(sorted(ALLOWED_TEST_HOSTS))}). The suite deletes data from real collection names. "
            "Point it at a local MongoDB, or set ALLOW_REMOTE_TEST_DB=1 if you are certain this is a disposable database."
        )
