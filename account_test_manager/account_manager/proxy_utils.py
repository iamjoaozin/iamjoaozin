from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class ParsedProxy:
    host: str
    port: int
    username: str | None = None
    password: str | None = None

    @property
    def has_auth(self) -> bool:
        return bool(self.username or self.password)


def parse_proxy(raw_proxy: str | None) -> ParsedProxy | None:
    if not raw_proxy:
        return None

    raw = raw_proxy.strip()
    if not raw:
        return None

    if "://" in raw:
        parsed = urlparse(raw)
        if not parsed.hostname or not parsed.port:
            raise ValueError(f"Proxy invalido: {raw_proxy}")
        return ParsedProxy(
            host=parsed.hostname,
            port=int(parsed.port),
            username=parsed.username,
            password=parsed.password,
        )

    if "@" in raw:
        credentials, endpoint = raw.rsplit("@", 1)
        username, password = credentials.split(":", 1) if ":" in credentials else (credentials, None)
        host, port = endpoint.rsplit(":", 1)
        return ParsedProxy(host=host, port=int(port), username=username, password=password)

    parts = raw.split(":")
    if len(parts) == 2:
        host, port = parts
        return ParsedProxy(host=host, port=int(port))

    if len(parts) >= 4:
        host, port, username = parts[0], parts[1], parts[2]
        password = ":".join(parts[3:])
        return ParsedProxy(host=host, port=int(port), username=username, password=password)

    raise ValueError(f"Proxy invalido: {raw_proxy}")
