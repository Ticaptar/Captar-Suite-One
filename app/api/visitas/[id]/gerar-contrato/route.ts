import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/db";
import { createContratoEntradaAnimais } from "@/lib/repositories/contratos-entrada-animais-repo";
import { getVisitaById, markVisitaContratoGerado } from "@/lib/repositories/visitas-repo";
import type { ContratoEmpresaSapInput, ContratoParceiroSapInput } from "@/lib/types/contrato";
import type { VisitaTipoContrato } from "@/lib/types/visita";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const visitaId = Number.parseInt(id, 10);
  if (Number.isNaN(visitaId) || visitaId <= 0) {
    return NextResponse.json({ error: "ID invalido." }, { status: 400 });
  }

  await request.json().catch(() => null);
  const tipoContrato: VisitaTipoContrato = "entrada_animais";

  try {
    const visitaData = await getVisitaById(visitaId);
    if (!visitaData) {
      return NextResponse.json({ error: "Visita nao encontrada." }, { status: 404 });
    }

    const visita = visitaData.visita;
    if (visita.contratoGeradoId) {
      const existingTipo: VisitaTipoContrato = "entrada_animais";
      return NextResponse.json(
        {
          visitaId,
          contratoId: visita.contratoGeradoId,
          tipoContrato: existingTipo,
          url: buildContratoFromVisitaUrl(visita.contratoGeradoId, visitaId),
          jaExistente: true,
        },
        { status: 200 },
      );
    }

    const referenciaBase = `VISITA ${visita.id} - ${visita.parceiroNome ?? "LEAD"}`.slice(0, 80);
    const exercicio = resolveExercicio(visita.dataVisita);
    const numeroGerado = await getNextContratoNumeroFromLast();
    const empresaSnapshot = await resolveEmpresaSnapshot(visita.empresaId);
    const parceiroSnapshot = await resolveParceiroSnapshot({
      parceiroId: visita.parceiroId ?? null,
      parceiroCodigo: visita.parceiroCodigo ?? null,
      parceiroNome: visita.parceiroNome ?? null,
    });
    const empresaIdValida = toPositiveId(visita.empresaId);
    const parceiroIdValido = toPositiveId(visita.parceiroId ?? null);

    const contratoCriado = await createContratoEntradaAnimais({
      empresaId: empresaIdValida ?? undefined,
      empresaSap: empresaSnapshot ?? undefined,
      parceiroId: parceiroIdValido ?? undefined,
      parceiroSap: parceiroSnapshot ?? undefined,
      exercicio,
      numero: numeroGerado,
      referenciaContrato: referenciaBase,
      refObjectId: String(visita.id),
      inicioEm: visita.dataVisita ?? undefined,
      assinaturaEm: visita.dataVisita ?? undefined,
      prazoEntregaEm: visita.dataVisita ?? undefined,
      observacoes: `Gerado automaticamente da visita #${visita.id}. Complete os dados do contrato antes de aprovar/gerar pedido.`,
      dadosGerais: {
        quantidadeNegociada: visita.rebanhoAtual,
        categoria: visita.categoria,
        racaPredominante: visita.raca,
      },
    });

    const contratoId = extractContratoId(contratoCriado);
    if (!Number.isFinite(contratoId) || contratoId <= 0) {
      throw new Error("Falha ao recuperar o ID do contrato gerado.");
    }

    await markVisitaContratoGerado(visitaId, contratoId);

    return NextResponse.json(
      {
        visitaId,
        contratoId,
        tipoContrato,
        url: buildContratoFromVisitaUrl(contratoId, visitaId),
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao gerar contrato.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildContratoFromVisitaUrl(contratoId: number, visitaId: number): string {
  return `/contratos/entrada-animais/novo?id=${contratoId}&fromVisita=1&visitaId=${visitaId}`;
}

async function getNextContratoNumeroFromLast(): Promise<number> {
  const pool = getPgPool();
  const result = await pool.query<{ numero: number }>(
    `
    SELECT
      coalesce(
        max(CASE WHEN trim(coalesce(c.numero, '')) ~ '^[0-9]+$' THEN trim(c.numero)::bigint ELSE 0 END),
        0
      ) + 1 AS numero
    FROM contrato.contrato c
    `,
  );
  return Number(result.rows[0]?.numero ?? 1) || 1;
}

async function resolveEmpresaSnapshot(empresaId: number | null): Promise<ContratoEmpresaSapInput | null> {
  if (!empresaId || Number.isNaN(empresaId)) return null;
  const pool = getPgPool();

  if (empresaId < 0) {
    const sapResult = await pool.query<{ codigo: string | null; nome: string | null; cnpj: string | null }>(
      `
      SELECT codigo, nome, cnpj
      FROM contrato.cs_empresa_sap_cache
      WHERE id = $1
      `,
      [Math.abs(empresaId)],
    ).catch(() => ({ rowCount: 0, rows: [] as Array<{ codigo: string | null; nome: string | null; cnpj: string | null }> }));
    const row = sapResult.rows[0];
    if (!row?.nome) return null;
    return {
      codigo: toNullableText(row.codigo),
      nome: String(row.nome).trim(),
      cnpj: normalizeDigits(row.cnpj),
      sapExternalId: toNullableText(row.codigo) ?? String(row.nome).trim(),
    };
  }

  if (await hasRelation("dbo.res_company")) {
    const localResult = await pool.query<{ codigo: string | null; nome: string | null; cnpj: string | null }>(
      `
      SELECT
        coalesce(to_jsonb(c)->>'codigo', to_jsonb(c)->>'ref') AS codigo,
        coalesce(to_jsonb(c)->>'nome', to_jsonb(c)->>'name') AS nome,
        coalesce(to_jsonb(c)->>'cnpj', to_jsonb(c)->>'cnpj_cpf', to_jsonb(c)->>'vat') AS cnpj
      FROM dbo.res_company c
      WHERE c.partner_ptr_id = $1
      `,
      [empresaId],
    );
    const row = localResult.rows[0];
    if (row?.nome) {
      return {
        codigo: toNullableText(row.codigo),
        nome: String(row.nome).trim(),
        cnpj: normalizeDigits(row.cnpj),
        sapExternalId: toNullableText(row.codigo) ?? String(row.nome).trim(),
      };
    }
  }

  if (await hasRelation("contrato.cs_empresa")) {
    const localResult = await pool.query<{ codigo: string | null; nome: string | null; cnpj: string | null }>(
      `
      SELECT codigo, nome, cnpj
      FROM contrato.cs_empresa
      WHERE id = $1
      `,
      [empresaId],
    );
    const row = localResult.rows[0];
    if (row?.nome) {
      return {
        codigo: toNullableText(row.codigo),
        nome: String(row.nome).trim(),
        cnpj: normalizeDigits(row.cnpj),
        sapExternalId: toNullableText(row.codigo) ?? String(row.nome).trim(),
      };
    }
  }

  return null;
}

async function resolveParceiroSnapshot(input: {
  parceiroId: number | null;
  parceiroCodigo: string | null;
  parceiroNome: string | null;
}): Promise<ContratoParceiroSapInput | null> {
  const pool = getPgPool();
  const parceiroId = input.parceiroId;

  if (parceiroId && !Number.isNaN(parceiroId)) {
    if (parceiroId < 0) {
      const sapResult = await pool.query<{ codigo: string | null; nome: string | null; documento: string | null }>(
        `
        SELECT codigo, nome, documento
        FROM contrato.cs_parceiro_sap_cache
        WHERE id = $1
        `,
        [Math.abs(parceiroId)],
      ).catch(() => ({ rowCount: 0, rows: [] as Array<{ codigo: string | null; nome: string | null; documento: string | null }> }));
      const row = sapResult.rows[0];
      if (row?.nome) {
        return {
          codigo: toNullableText(row.codigo),
          nome: String(row.nome).trim(),
          documento: normalizeDigits(row.documento),
          sapExternalId: toNullableText(row.codigo) ?? String(row.nome).trim(),
        };
      }
    } else {
      if (await hasRelation("dbo.res_partner")) {
        const localResult = await pool.query<{ codigo: string | null; nome: string | null; documento: string | null }>(
          `
          SELECT
            coalesce(to_jsonb(p)->>'codigo', to_jsonb(p)->>'ref') AS codigo,
            coalesce(to_jsonb(p)->>'nome', to_jsonb(p)->>'name') AS nome,
            coalesce(to_jsonb(p)->>'documento', to_jsonb(p)->>'cnpj_cpf', to_jsonb(p)->>'vat') AS documento
          FROM dbo.res_partner p
          WHERE p.id = $1
          `,
          [parceiroId],
        );
        const row = localResult.rows[0];
        if (row?.nome) {
          return {
            codigo: toNullableText(row.codigo),
            nome: String(row.nome).trim(),
            documento: normalizeDigits(row.documento),
            sapExternalId: toNullableText(row.codigo) ?? String(row.nome).trim(),
          };
        }
      }

      if (await hasRelation("contrato.cs_parceiro")) {
        const localResult = await pool.query<{ codigo: string | null; nome: string | null; documento: string | null }>(
          `
          SELECT codigo, nome, documento
          FROM contrato.cs_parceiro
          WHERE id = $1
          `,
          [parceiroId],
        );
        const row = localResult.rows[0];
        if (row?.nome) {
          return {
            codigo: toNullableText(row.codigo),
            nome: String(row.nome).trim(),
            documento: normalizeDigits(row.documento),
            sapExternalId: toNullableText(row.codigo) ?? String(row.nome).trim(),
          };
        }
      }
    }
  }

  if (input.parceiroNome) {
    return {
      codigo: toNullableText(input.parceiroCodigo),
      nome: String(input.parceiroNome).trim(),
      documento: null,
      sapExternalId: toNullableText(input.parceiroCodigo) ?? String(input.parceiroNome).trim(),
    };
  }

  return null;
}

async function hasRelation(relation: string): Promise<boolean> {
  const pool = getPgPool();
  const result = await pool.query<{ relation: string | null }>("SELECT to_regclass($1) AS relation", [relation]);
  return result.rows[0]?.relation !== null;
}

function toPositiveId(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function toNullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeDigits(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function resolveExercicio(dataVisita: string | null): number {
  if (!dataVisita) return new Date().getFullYear();
  const date = new Date(dataVisita);
  if (Number.isNaN(date.getTime())) return new Date().getFullYear();
  return date.getFullYear();
}

function extractContratoId(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload as Record<string, unknown>;
  if ("id" in obj) {
    const parsed = Number(obj.id);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if ("contratoId" in obj) {
    const parsed = Number(obj.contratoId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  if ("contrato" in obj && obj.contrato && typeof obj.contrato === "object") {
    const contrato = obj.contrato as Record<string, unknown>;
    const parsed = Number(contrato.id);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}
