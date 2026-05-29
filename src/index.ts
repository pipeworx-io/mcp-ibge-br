interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * IBGE (Instituto Brasileiro de Geografia e Estatística) MCP.
 * Brazil's official statistics agency. Keyless public API.
 */


const BASE = 'https://servicodados.ibge.gov.br/api';
const UA = 'pipeworx-mcp-ibge-br/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'list_states',
    description:
      'List all 27 Brazilian states (UFs) with id, 2-letter sigla, name, and region (e.g. "SP" → São Paulo, Sudeste). Useful for resolving state names/codes before querying municipalities or regional data.',
    inputSchema: {
      type: 'object',
      properties: {
        orderBy: { type: 'string', description: 'Sort field: "nome" or "id" (default "nome").' },
      },
    },
  },
  {
    name: 'list_municipalities',
    description:
      'List municipalities for a given state (UF). Returns each municipality with its 7-digit IBGE id and name. e.g. uf="RJ" lists all municipalities in Rio de Janeiro.',
    inputSchema: {
      type: 'object',
      properties: {
        uf: { type: 'string', description: '2-letter state code, e.g. "SP", "RJ", "BA", "MG".' },
      },
      required: ['uf'],
    },
  },
  {
    name: 'lookup_municipality',
    description:
      'Look up a single municipality by its 7-digit IBGE code, returning full hierarchy (micro/mesoregion, state, region). e.g. code="3550308" → São Paulo (capital).',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '7-digit IBGE municipality code, e.g. "3550308" (São Paulo) or "3304557" (Rio de Janeiro).' },
      },
      required: ['code'],
    },
  },
  {
    name: 'aggregated_data',
    description:
      'Pull official IBGE/SIDRA statistical series (inflation, GDP, population, etc.). Specify the aggregate table, variable, periods, and locality. Common examples: IPCA monthly inflation = aggregate "1737" variable "63"; population estimate = aggregate "6579" variable "9324". Returns time series keyed by period.',
    inputSchema: {
      type: 'object',
      properties: {
        aggregate: { type: 'string', description: 'SIDRA aggregate (table) id, e.g. "1737" (IPCA) or "6579" (population estimate). Discover ids via list_aggregates.' },
        variable: { type: 'string', description: 'Variable id within the aggregate, e.g. "63" (IPCA monthly variation %). Use "all" for every variable.' },
        periods: { type: 'string', description: 'Periods: "-1" (latest), "-6" (last 6), or explicit like "202604" or "202601-202604". Default "-1".' },
        localities: { type: 'string', description: 'Locality filter, e.g. "N1[all]" (Brazil), "N3[35]" (state SP), "N6[3550308]" (a municipality). Default "N1[all]". Brackets are auto-encoded.' },
      },
      required: ['aggregate', 'variable'],
    },
  },
  {
    name: 'list_aggregates',
    description:
      'Browse the catalog of IBGE/SIDRA aggregate tables grouped by subject (inflation, agriculture, demographics, etc.). Use to discover aggregate ids to pass to aggregated_data. Optionally filter by research/subject acronym.',
    inputSchema: {
      type: 'object',
      properties: {
        acronym: { type: 'string', description: 'Optional research acronym to filter by, e.g. "PNAD", "IPCA". Omit to list everything.' },
      },
    },
  },
  {
    name: 'name_frequency',
    description:
      'Brazilian census name statistics. Pass a first name to get its registration frequency by decade (since 1930), optionally filtered by sex or state. e.g. name="maria". Pass name="ranking" to get the top names instead.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'First name to look up, e.g. "maria", "joao". Special value "ranking" returns the most popular names.' },
        sex: { type: 'string', description: 'Optional filter: "M" or "F".' },
        locality: { type: 'string', description: 'Optional 2-digit state id, e.g. "33" (RJ), "35" (SP). Omit for whole country (BR).' },
        decade: { type: 'string', description: 'Optional decade filter for ranking, e.g. "1990", "2000".' },
      },
      required: ['name'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_states': {
      const orderBy = (args.orderBy as string | undefined)?.trim() || 'nome';
      return ibgeGet(`/v1/localidades/estados?orderBy=${encodeURIComponent(orderBy)}`);
    }
    case 'list_municipalities': {
      const uf = reqStr(args, 'uf', '"SP"').trim().toUpperCase();
      return ibgeGet(`/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`);
    }
    case 'lookup_municipality': {
      const code = reqStr(args, 'code', '"3550308"').trim();
      return ibgeGet(`/v1/localidades/municipios/${encodeURIComponent(code)}`);
    }
    case 'aggregated_data': {
      const aggregate = reqStr(args, 'aggregate', '"1737"').trim();
      const variable = reqStr(args, 'variable', '"63"').trim();
      const periods = (args.periods as string | undefined)?.trim() || '-1';
      const localities = (args.localities as string | undefined)?.trim() || 'N1[all]';
      // IBGE silently returns empty results unless the [..] brackets are URL-encoded.
      const qs = `localidades=${encodeURIComponent(localities)}`;
      return ibgeGet(
        `/v3/agregados/${encodeURIComponent(aggregate)}/periodos/${encodeURIComponent(periods)}/variaveis/${encodeURIComponent(variable)}?${qs}`,
      );
    }
    case 'list_aggregates': {
      const acronym = (args.acronym as string | undefined)?.trim();
      const path = acronym
        ? `/v3/agregados?acronimo=${encodeURIComponent(acronym)}`
        : '/v3/agregados';
      return ibgeGet(path);
    }
    case 'name_frequency': {
      const nm = reqStr(args, 'name', '"maria"').trim();
      const params = new URLSearchParams();
      const sex = (args.sex as string | undefined)?.trim();
      const locality = (args.locality as string | undefined)?.trim();
      const decade = (args.decade as string | undefined)?.trim();
      if (sex) params.set('sexo', sex.toUpperCase());
      if (locality) params.set('localidade', locality);
      if (decade) params.set('decada', decade);
      const path = nm.toLowerCase() === 'ranking' ? '/v2/censos/nomes/ranking' : `/v2/censos/nomes/${encodeURIComponent(nm)}`;
      const qs = params.toString();
      return ibgeGet(qs ? `${path}?${qs}` : path);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function ibgeGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) throw new Error(`IBGE: ${res.status} ${await res.text().then((t) => t.slice(0, 200))}`);
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
