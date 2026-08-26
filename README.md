# mcp-ibge-br

IBGE (Instituto Brasileiro de Geografia e Estatística) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `list_states` | List all 27 Brazilian states (UFs) with id, 2-letter sigla, name, and region (e.g. "SP" → São Paulo, Sudeste). Useful for resolving state names/codes before querying municipalities or regional data. |
| `list_municipalities` | List municipalities for a given state (UF). Returns each municipality with its 7-digit IBGE id and name. e.g. uf="RJ" lists all municipalities in Rio de Janeiro. |
| `lookup_municipality` | Look up a single municipality by its 7-digit IBGE code, returning full hierarchy (micro/mesoregion, state, region). e.g. code="3550308" → São Paulo (capital). |
| `aggregated_data` | Pull official IBGE/SIDRA statistical series (inflation, GDP, population, etc.). Specify the aggregate table, variable, periods, and locality. Common examples: IPCA monthly inflation = aggregate "1737" variable "63"; population estimate = aggregate "6579" variable "9324". Returns time series keyed by period. |
| `list_aggregates` | Browse the catalog of IBGE/SIDRA aggregate tables grouped by subject (inflation, agriculture, demographics, etc.). Use to discover aggregate ids to pass to aggregated_data. Optionally filter by research/subject acronym. |
| `name_frequency` | Brazilian census name statistics. Pass a first name to get its registration frequency by decade (since 1930), optionally filtered by sex or state. e.g. name="maria". Pass name="ranking" to get the top names instead. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "ibge-br": {
      "url": "https://gateway.pipeworx.io/ibge-br/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/ibge-br/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Ibge Br data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
