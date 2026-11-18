# /// script
# dependencies = ["mcp>=1.20,<2"]
# ///
"""stdio の MCP サーバーを起動して、ツール一覧の表示または1回の呼び出しをする。
使い方:
  uv run mcp_call.py --list -- <server command...>
  uv run mcp_call.py --tool NAME --args '{"q":"tree"}' -- <server command...>
"""
import argparse, asyncio, json, os, sys, time
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main(a):
    params = StdioServerParameters(command=a.cmd[0], args=a.cmd[1:], env={**os.environ}, cwd=a.cwd)
    async with stdio_client(params, errlog=open(os.devnull, "w")) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            if a.list:
                tools = (await s.list_tools()).tools
                print(f"{len(tools)} tools")
                for t in tools:
                    print(f"- {t.name}: {(t.description or '').splitlines()[0][:110]}")
                    if a.schema: print("   ", json.dumps(t.inputSchema.get("properties", {}), ensure_ascii=False)[:400])
                return
            t0 = time.time()
            res = await s.call_tool(a.tool, json.loads(a.args))
            dt = time.time() - t0
            text = "\n".join(c.text for c in res.content if hasattr(c, "text"))
            print(f"[{dt:.1f}s] isError={res.isError}")
            print(text[: a.max])

p = argparse.ArgumentParser()
p.add_argument("--list", action="store_true"); p.add_argument("--schema", action="store_true")
p.add_argument("--tool"); p.add_argument("--args", default="{}"); p.add_argument("--cwd")
p.add_argument("--max", type=int, default=4000)
p.add_argument("cmd", nargs="+")
asyncio.run(main(p.parse_args()))
