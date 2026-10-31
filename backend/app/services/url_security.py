"""URL validation and SSRF protection.

Every outbound fetch (including every redirect hop) must pass `validate_public_url`.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata",
    "instance-data",
    "instance-data.ec2.internal",
}

# Cloud metadata endpoints (also covered by link-local checks, listed for clarity).
BLOCKED_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("169.254.170.2"),
    ipaddress.ip_address("100.100.100.200"),
    ipaddress.ip_address("fd00:ec2::254"),
}

ALLOWED_PORTS = {None, 80, 443, 8080, 8443}


class UnsafeURLError(ValueError):
    """Raised when a URL is malformed or points at a non-public destination."""


def _is_public_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if ip in BLOCKED_IPS:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return _is_public_ip(ip.ipv4_mapped)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
        or (isinstance(ip, ipaddress.IPv4Address) and ip in ipaddress.ip_network("100.64.0.0/10"))
    )


def check_url_syntax(url: str) -> tuple[str, str, int | None]:
    """Validate scheme/host/port without DNS. Returns (scheme, host, port)."""
    if not url or len(url) > 2048:
        raise UnsafeURLError("URL is empty or too long")
    try:
        parts = urlsplit(url.strip())
    except ValueError as exc:
        raise UnsafeURLError(f"Malformed URL: {exc}") from exc
    scheme = parts.scheme.lower()
    if scheme not in {"http", "https"}:
        raise UnsafeURLError("Only http and https URLs are allowed")
    if parts.username or parts.password:
        raise UnsafeURLError("URLs with embedded credentials are not allowed")
    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        raise UnsafeURLError("URL has no host")
    try:
        port = parts.port
    except ValueError as exc:
        raise UnsafeURLError("Invalid port") from exc
    if port not in ALLOWED_PORTS:
        raise UnsafeURLError(f"Port {port} is not allowed")
    if host in BLOCKED_HOSTNAMES or host.endswith(".localhost") or host.endswith(".internal") or host.endswith(".local"):
        raise UnsafeURLError("Internal hostnames are not allowed")
    try:
        literal = ipaddress.ip_address(host.strip("[]"))
    except ValueError:
        literal = None
    if literal is not None and not _is_public_ip(literal):
        raise UnsafeURLError("Private, loopback, link-local or metadata addresses are not allowed")
    # Block decimal/octal/hex integer hosts like http://2130706433/ which resolve to loopback.
    if host.isdigit() or host.startswith("0x"):
        raise UnsafeURLError("Numeric host encodings are not allowed")
    return scheme, host, port


async def resolve_host(host: str) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    return list({info[4][0] for info in infos})


async def validate_public_url(url: str, resolver=resolve_host) -> str:
    """Raise UnsafeURLError unless every resolved address of the host is public."""
    _, host, _ = check_url_syntax(url)
    try:
        ipaddress.ip_address(host.strip("[]"))
        return url  # literal public IP already checked
    except ValueError:
        pass
    try:
        addresses = await resolver(host)
    except (socket.gaierror, OSError) as exc:
        raise UnsafeURLError(f"Could not resolve host {host}") from exc
    if not addresses:
        raise UnsafeURLError(f"Could not resolve host {host}")
    for addr in addresses:
        ip = ipaddress.ip_address(addr.split("%")[0])
        if not _is_public_ip(ip):
            raise UnsafeURLError(f"Host {host} resolves to a non-public address")
    return url
