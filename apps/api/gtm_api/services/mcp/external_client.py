"""Optional external MCP server client — stdio transport."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from gtm_api.services.mcp.types import ContextBlock

logger = logging.getLogger(__name__)


async def fetch_external_mcp_context(
    query: str,
    servers: list[dict[str, Any]],
    *,
    timeout_seconds: int = 15,
) -> list[ContextBlock]:
    """Connect to configured MCP servers and pull resources/tools context."""
    if not servers:
        return []

    blocks: list[ContextBlock] = []
    for server in servers:
        if server.get("type", "stdio") != "stdio":
            continue
        name = server.get("name", "mcp")
        try:
            block = await asyncio.wait_for(
                _fetch_stdio_server(server, query),
                timeout=timeout_seconds,
            )
            if block:
                blocks.append(block)
        except asyncio.TimeoutError:
            logger.warning("MCP server %s timed out", name)
        except Exception as exc:
            logger.warning("MCP server %s failed: %s", name, exc)
    return blocks


async def _fetch_stdio_server(server: dict[str, Any], query: str) -> ContextBlock | None:
    try:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client
    except ImportError:
        return ContextBlock(
            source="external",
            provider=server.get("name", "mcp"),
            title="MCP (package not installed)",
            content="Install the `mcp` Python package to enable external MCP servers.",
            metadata={"error": "mcp_not_installed"},
        )

    command = server.get("command")
    args = server.get("args") or []
    if not command:
        return None

    env = server.get("env")
    params = StdioServerParameters(command=command, args=args, env=env)

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            parts: list[str] = []

            # List and read resources
            try:
                resources = await session.list_resources()
                for res in (resources.resources or [])[:5]:
                    try:
                        content = await session.read_resource(res.uri)
                        text_parts = []
                        for item in content.contents or []:
                            if hasattr(item, "text") and item.text:
                                text_parts.append(item.text[:1500])
                        if text_parts:
                            parts.append(f"Resource {res.name}:\n" + "\n".join(text_parts))
                    except Exception:
                        continue
            except Exception:
                pass

            # Optionally call allowlisted tools with query
            allowlist = set(server.get("tools_allowlist") or [])
            if allowlist:
                try:
                    tools = await session.list_tools()
                    for tool in tools.tools or []:
                        if tool.name not in allowlist:
                            continue
                        arg_key = server.get("tool_query_arg", "query")
                        result = await session.call_tool(
                            tool.name,
                            {arg_key: query},
                        )
                        text_parts = []
                        for item in result.content or []:
                            if hasattr(item, "text") and item.text:
                                text_parts.append(item.text[:2000])
                        if text_parts:
                            parts.append(f"Tool {tool.name}:\n" + "\n".join(text_parts))
                except Exception:
                    pass

            if not parts:
                return None

            return ContextBlock(
                source="external",
                provider=server.get("name", "mcp"),
                title=f"MCP server: {server.get('name', 'external')}",
                content="\n\n---\n\n".join(parts),
                metadata={"transport": "stdio"},
            )
