import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import {
  isSapServiceLayerConfigured,
  listItemsFromSap,
  listContratoItemCatalogFromSap,
  type SapCatalogOption,
} from "@/lib/sap-service-layer";

export const runtime = "nodejs";

type CatalogOption = {
  value: string;
  label: string;
};

type ItemCatalogResponse = {
  itens: CatalogOption[];
  unidades: CatalogOption[];
  condicoesPagamento: CatalogOption[];
  formasPagamento: CatalogOption[];
  depositos: CatalogOption[];
  centrosCusto: CatalogOption[];
  utilizacoes: CatalogOption[];
  moedas: CatalogOption[];
};

type CatalogSearchFilters = {
  global: string;
  item: string;
  unidade: string;
  condicaoPagamento: string;
  deposito: string;
  centroCusto: string;
  utilizacao: string;
  moeda: string;
};

const UTILIZACOES_FIXAS: CatalogOption[] = [
  { value: "CONFINAMENTO", label: "CONFINAMENTO" },
  { value: "LOGISTICA", label: "LOGISTICA" },
  { value: "DEVOLUCAO", label: "Devolucao" },
  { value: "VENDA_ATIVO_IMOBILIZADO", label: "Venda de ativo imobilizado" },
];

const CONDICOES_PAGAMENTO_FIXAS: CatalogOption[] = [
  { value: "30_DIAS", label: "30 dias" },
  { value: "A_VISTA", label: "A vista" },
  { value: "A_VISTA_30_60", label: "A vista, 30 e 60 dias" },
  { value: "30_60_90", label: "30, 60 e 90 dias" },
  { value: "30_60", label: "30 e 60 dias" },
  { value: "45_DIAS", label: "45 dias" },
  { value: "45_90", label: "45 e 90 dias" },
  { value: "15_30_45", label: "15, 30 e 45 dias" },
  { value: "45_90_135_180", label: "45, 90, 135 e 180 dias" },
  { value: "A_VISTA_30", label: "A vista e 30 dias" },
  { value: "A_VISTA_45", label: "A vista e 45 dias" },
];

const FORMAS_PAGAMENTO_FIXAS: CatalogOption[] = [
  { value: "BOLETO", label: "Boleto" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "PIX", label: "PIX" },
  { value: "DINHEIRO", label: "Dinheiro" },
  { value: "CARTAO", label: "Cartão" },
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemSearch = searchParams.get("itemSearch")?.trim() ?? "";
    const limitParam = (searchParams.get("limit") ?? "").trim().toLowerCase();
    const unlimited = limitParam === "" || limitParam === "0" || limitParam === "all" || limitParam === "*";
    const parsedLimit = Number.parseInt(limitParam || "120", 10);
    const itemLimit = unlimited ? null : Math.min(Math.max(parsedLimit || 120, 20), 5000);
    const filters: CatalogSearchFilters = {
      global: searchParams.get("search")?.trim() ?? "",
      item: searchParams.get("item")?.trim() ?? "",
      unidade: searchParams.get("unidade")?.trim() ?? "",
      condicaoPagamento: searchParams.get("condicaoPagamento")?.trim() ?? "",
      deposito: searchParams.get("deposito")?.trim() ?? "",
      centroCusto: searchParams.get("centroCusto")?.trim() ?? "",
      utilizacao: searchParams.get("utilizacao")?.trim() ?? "",
      moeda: searchParams.get("moeda")?.trim() ?? "",
    };

    if (itemSearch.length > 0) {
      const localItens = await listLocalItens(itemSearch, itemLimit);
      const sapItens = isSapServiceLayerConfigured()
        ? await listItemsFromSap(itemSearch, itemLimit)
        : [];
      const itensMerged = mergeOptions(localItens, sapItens, "sap:item");
      const itens = itemLimit ? itensMerged.slice(0, itemLimit) : itensMerged;

      return NextResponse.json({
        itens,
        unidades: [],
        condicoesPagamento: [],
        formasPagamento: [],
        depositos: [],
        centrosCusto: [],
        utilizacoes: [],
        moedas: [],
      } satisfies ItemCatalogResponse);
    }

    const localCatalog = await listLocalCatalog();

    if (isSapServiceLayerConfigured()) {
      const sapCatalog = await listContratoItemCatalogFromSap();
      const sapUtilizacoes = sapCatalog.utilizacoes;
      const itensOrigemSap = sapUtilizacoes.length > 0 ? sapUtilizacoes : sapCatalog.itens;

      const payload = {
        // Regra: Item precisa vir da utilizacao do pedido de compra no SAP.
        // Fallback para itens SAP se utilizacoes vier vazio.
        itens: mergeOptions([], itensOrigemSap, "sap:uso"),
        unidades: mergeOptions(localCatalog.unidades, sapCatalog.unidades, "sap:udm"),
        condicoesPagamento:
          sapCatalog.condicoesPagamento.length > 0
            ? mergeOptions([], sapCatalog.condicoesPagamento, "sap:cp")
            : CONDICOES_PAGAMENTO_FIXAS,
        formasPagamento:
          sapCatalog.formasPagamento.length > 0
            ? mergeOptions([], sapCatalog.formasPagamento, "sap:fp")
            : FORMAS_PAGAMENTO_FIXAS,
        // Depositos: prioriza SAP sem misturar com catalogo local quando houver retorno do SAP.
        depositos: sapCatalog.depositos.length > 0 ? mergeOptions([], sapCatalog.depositos, "sap:dep") : localCatalog.depositos,
        centrosCusto: mergeOptions(localCatalog.centrosCusto, sapCatalog.centrosCusto, "sap:cc"),
        utilizacoes: UTILIZACOES_FIXAS,
        moedas: mergeOptions(localCatalog.moedas, sapCatalog.moedas, "sap:moeda"),
      } satisfies ItemCatalogResponse;

      return NextResponse.json(applyCatalogSearch(payload, filters));
    }

    const payload = {
      ...localCatalog,
      condicoesPagamento: CONDICOES_PAGAMENTO_FIXAS,
      formasPagamento: FORMAS_PAGAMENTO_FIXAS,
      utilizacoes: UTILIZACOES_FIXAS,
    } satisfies ItemCatalogResponse;

    return NextResponse.json(applyCatalogSearch(payload, filters));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar opcoes de itens.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function listLocalItens(search: string, limit: number | null): Promise<CatalogOption[]> {
  const pool = getPgPool();
  if (!(await tableExists("produto.item", pool))) return [];
  const baseSql = `
    SELECT
      t.id::text AS value,
      trim(
        concat_ws(
          ' - ',
          coalesce(nullif(coalesce(to_jsonb(t)->>'codigo', to_jsonb(t)->>'ref', to_jsonb(t)->>'itemcode'), ''), t.id::text),
          coalesce(nullif(coalesce(to_jsonb(t)->>'descricao', to_jsonb(t)->>'nome', to_jsonb(t)->>'name', to_jsonb(t)->>'itemname'), ''), 'Sem descricao')
        )
      ) AS label
    FROM produto.item t
    WHERE (
      $1::text = ''
      OR coalesce(to_jsonb(t)->>'codigo', to_jsonb(t)->>'ref', to_jsonb(t)->>'itemcode', '') ILIKE '%' || $1 || '%'
      OR coalesce(to_jsonb(t)->>'descricao', to_jsonb(t)->>'nome', to_jsonb(t)->>'name', to_jsonb(t)->>'itemname', '') ILIKE '%' || $1 || '%'
    )
    ORDER BY label
  `;
  const result = limit
    ? await pool.query<{ value: string; label: string }>(`${baseSql} LIMIT $2`, [search, limit])
    : await pool.query<{ value: string; label: string }>(baseSql, [search]);

  return result.rows
    .map((item) => ({
      value: String(item.value ?? "").trim(),
      label: String(item.label ?? "").trim(),
    }))
    .filter((item) => item.value && item.label);
}

async function listLocalCatalog(): Promise<ItemCatalogResponse> {
  const pool = getPgPool();

  const [itens, unidades, condicoesPagamento, depositos, centrosCusto, utilizacoes, moedas] = await Promise.all([
    queryOptions(
      "produto.item",
      `
      SELECT
        t.id::text AS value,
        trim(
          concat_ws(
            ' - ',
            coalesce(nullif(coalesce(to_jsonb(t)->>'codigo', to_jsonb(t)->>'ref', to_jsonb(t)->>'itemcode'), ''), t.id::text),
            coalesce(nullif(coalesce(to_jsonb(t)->>'descricao', to_jsonb(t)->>'nome', to_jsonb(t)->>'name', to_jsonb(t)->>'itemname'), ''), 'Sem descricao')
          )
        ) AS label
      FROM produto.item t
      ORDER BY label
      LIMIT 800
      `,
      pool,
    ),
    queryOptions(
      "produto.unidade",
      `
      SELECT
        u.id::text AS value,
        trim(
          concat_ws(
            ' - ',
            coalesce(nullif(coalesce(to_jsonb(u)->>'sigla', to_jsonb(u)->>'codigo', to_jsonb(u)->>'code'), ''), u.id::text),
            coalesce(nullif(coalesce(to_jsonb(u)->>'descricao', to_jsonb(u)->>'nome', to_jsonb(u)->>'name'), ''), 'Sem descricao')
          )
        ) AS label
      FROM produto.unidade u
      ORDER BY label
      LIMIT 300
      `,
      pool,
    ),
    queryOptions(
      "produto.condicao_pagamento",
      `
      SELECT
        c.id::text AS value,
        trim(
          concat_ws(
            ' - ',
            coalesce(nullif(coalesce(to_jsonb(c)->>'codigo', to_jsonb(c)->>'ref', to_jsonb(c)->>'code'), ''), c.id::text),
            coalesce(nullif(coalesce(to_jsonb(c)->>'descricao', to_jsonb(c)->>'nome', to_jsonb(c)->>'name'), ''), 'Sem descricao')
          )
        ) AS label
      FROM produto.condicao_pagamento c
      ORDER BY label
      LIMIT 300
      `,
      pool,
    ),
    queryOptions(
      "estoque.deposito",
      `
      SELECT
        d.id::text AS value,
        trim(
          concat_ws(
            ' - ',
            coalesce(nullif(coalesce(to_jsonb(d)->>'codigo', to_jsonb(d)->>'ref', to_jsonb(d)->>'code'), ''), d.id::text),
            coalesce(nullif(coalesce(to_jsonb(d)->>'descricao', to_jsonb(d)->>'nome', to_jsonb(d)->>'name'), ''), 'Sem descricao')
          )
        ) AS label
      FROM estoque.deposito d
      ORDER BY label
      LIMIT 300
      `,
      pool,
    ),
    queryOptions(
      "br.centro_custo",
      `
      SELECT
        cc.id::text AS value,
        trim(
          concat_ws(
            ' - ',
            coalesce(nullif(coalesce(to_jsonb(cc)->>'codigo', to_jsonb(cc)->>'code', to_jsonb(cc)->>'ref'), ''), cc.id::text),
            coalesce(nullif(coalesce(to_jsonb(cc)->>'descricao', to_jsonb(cc)->>'nome', to_jsonb(cc)->>'name'), ''), 'Sem descricao')
          )
        ) AS label
      FROM br.centro_custo cc
      ORDER BY label
      LIMIT 500
      `,
      pool,
    ),
    queryOptions(
      "produto.utilizacao",
      `
      SELECT
        u.id::text AS value,
        trim(
          concat_ws(
            ' - ',
            coalesce(nullif(coalesce(to_jsonb(u)->>'codigo', to_jsonb(u)->>'code', to_jsonb(u)->>'ref'), ''), u.id::text),
            coalesce(nullif(coalesce(to_jsonb(u)->>'descricao', to_jsonb(u)->>'nome', to_jsonb(u)->>'name'), ''), 'Sem descricao')
          )
        ) AS label
      FROM produto.utilizacao u
      ORDER BY label
      LIMIT 500
      `,
      pool,
    ),
    queryOptions(
      "dbo.res_currency",
      `
      SELECT
        c.id::text AS value,
        trim(
          concat_ws(
            ' - ',
            coalesce(nullif(coalesce(to_jsonb(c)->>'code', to_jsonb(c)->>'codigo', to_jsonb(c)->>'name'), ''), c.id::text),
            coalesce(nullif(coalesce(to_jsonb(c)->>'name', to_jsonb(c)->>'descricao', to_jsonb(c)->>'nome'), ''), 'Sem descricao')
          )
        ) AS label
      FROM dbo.res_currency c
      ORDER BY label
      LIMIT 120
      `,
      pool,
    ),
  ]);

  return {
    itens,
    unidades,
    condicoesPagamento,
    formasPagamento: FORMAS_PAGAMENTO_FIXAS,
    depositos,
    centrosCusto,
    utilizacoes,
    moedas,
  };
}

async function queryOptions(
  relationName: string,
  queryText: string,
  pool: ReturnType<typeof getPgPool>,
): Promise<CatalogOption[]> {
  const exists = await tableExists(relationName, pool);
  if (!exists) return [];

  const result = await pool.query<{ value: string; label: string }>(queryText);
  return result.rows
    .map((item) => ({
      value: String(item.value ?? "").trim(),
      label: String(item.label ?? "").trim(),
    }))
    .filter((item) => item.value && item.label);
}

async function tableExists(
  relationName: string,
  pool: ReturnType<typeof getPgPool>,
): Promise<boolean> {
  const result = await pool.query<{ relation: string | null }>(
    "SELECT to_regclass($1) AS relation",
    [relationName],
  );
  return result.rows[0]?.relation !== null;
}

function mergeOptions(
  local: CatalogOption[],
  sap: SapCatalogOption[],
  sapPrefix: string,
): CatalogOption[] {
  const merged = [...local];
  const seen = new Set(local.map((item) => normalizeKey(item.value, item.label)));

  for (const option of sap) {
    const value = String(option.value ?? "").trim();
    const label = String(option.label ?? "").trim();
    if (!value || !label) continue;

    const key = normalizeKey(value, label);
    if (seen.has(key)) continue;

    seen.add(key);
    merged.push({
      value: `${sapPrefix}:${value}`,
      label,
    });
  }

  return merged;
}

function applyCatalogSearch(catalog: ItemCatalogResponse, filters: CatalogSearchFilters): ItemCatalogResponse {
  const term = (specific: string) => specific || filters.global;
  return {
    itens: filterOptions(catalog.itens, term(filters.item)),
    unidades: filterOptions(catalog.unidades, term(filters.unidade)),
    condicoesPagamento: filterOptions(catalog.condicoesPagamento, term(filters.condicaoPagamento)),
    formasPagamento: filterOptions(catalog.formasPagamento, term("")),
    depositos: filterOptions(catalog.depositos, term(filters.deposito)),
    centrosCusto: filterOptions(catalog.centrosCusto, term(filters.centroCusto)),
    utilizacoes: filterOptions(catalog.utilizacoes, term(filters.utilizacao)),
    moedas: filterOptions(catalog.moedas, term(filters.moeda)),
  };
}

function filterOptions(options: CatalogOption[], search: string): CatalogOption[] {
  const term = normalizeTerm(search);
  if (!term) return options;

  return options.filter((option) => {
    const value = normalizeTerm(option.value);
    const label = normalizeTerm(option.label);
    return value.includes(term) || label.includes(term);
  });
}

function normalizeKey(value: string, label: string): string {
  return `${value}|${label}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function normalizeTerm(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
