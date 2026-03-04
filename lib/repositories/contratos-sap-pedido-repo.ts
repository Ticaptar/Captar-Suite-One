import { getPgPool } from "@/lib/db";

type SaveContratoSapPedidoInput = {
  docEntry: number | null;
  docNum: number | null;
  objectName?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
};

let sapColumnsEnsured = false;
let contratoTableExistsCache: boolean | null = null;

async function hasContratoTable(): Promise<boolean> {
  if (contratoTableExistsCache !== null) return contratoTableExistsCache;
  const pool = getPgPool();
  const result = await pool.query<{ relation: string | null }>("SELECT to_regclass('contrato.contrato') AS relation");
  contratoTableExistsCache = result.rows[0]?.relation !== null;
  return contratoTableExistsCache;
}

async function ensureSapColumns() {
  if (sapColumnsEnsured) return;
  const pool = getPgPool();
  await pool.query(`
    ALTER TABLE contrato.contrato
      ADD COLUMN IF NOT EXISTS b1_codigo_pedido varchar(128),
      ADD COLUMN IF NOT EXISTS b1_codigo varchar(128),
      ADD COLUMN IF NOT EXISTS b1_created_by varchar(128),
      ADD COLUMN IF NOT EXISTS b1_approved_by varchar(128),
      ADD COLUMN IF NOT EXISTS b1_object_name varchar(128);
  `);
  sapColumnsEnsured = true;
}

export async function saveContratoSapPedido(id: number, input: SaveContratoSapPedidoInput): Promise<void> {
  if (!(await hasContratoTable())) {
    throw new Error("Tabela contrato.contrato nao encontrada.");
  }

  await ensureSapColumns();
  const pool = getPgPool();

  const docEntry = input.docEntry === null ? null : String(Math.trunc(input.docEntry));
  const docNum = input.docNum === null ? null : String(Math.trunc(input.docNum));
  const objectName = (input.objectName ?? "PurchaseOrders").trim() || "PurchaseOrders";
  const createdBy = input.createdBy?.trim() || null;
  const approvedBy = input.approvedBy?.trim() || null;

  const result = await pool.query(
    `
    UPDATE contrato.contrato c
    SET
      b1_codigo = $1,
      b1_codigo_pedido = $2,
      b1_object_name = $3,
      b1_created_by = COALESCE($4, b1_created_by),
      b1_approved_by = COALESCE($5, b1_approved_by),
      updated_on = now()
    WHERE c.id = $6
    `,
    [docEntry, docNum, objectName, createdBy, approvedBy, id],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Contrato nao encontrado para gravar retorno SAP.");
  }
}

