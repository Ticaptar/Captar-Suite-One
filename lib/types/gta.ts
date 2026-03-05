export type GtaTipo = "entrada" | "saida" | "temporaria";

export type GtaStatus = "ativo" | "cancelado" | "desembarcado" | "encerrado";

export type GtaEraRow = {
  era: string;
  quantidade: number;
  quantidadeEntrada: number;
  quantidadeIdentificado: number;
};

export type GtaTemporariaRow = {
  descricao: string;
  quantidade: number;
  quantidadeEntrada: number;
};

export type GtaListItem = {
  id: number;
  numero: string | null;
  dataEmissao: string | null;
  contrato: string | null;
  local: string | null;
  tipo: GtaTipo;
  status: GtaStatus;
  total: number;
  quantidadeMachos: number;
  quantidadeFemeas: number;
};

export type GtaRecord = {
  id: number;
  tipo: GtaTipo;
  status: GtaStatus;
  numero: string | null;
  serie: string | null;
  local: string | null;
  contrato: string | null;
  estado: string | null;
  especie: string | null;
  finalidade: string | null;
  transporte: string | null;
  dataEmissao: string | null;
  horaEmissao: string | null;
  dataValidade: string | null;
  quantidadeMachos: number;
  quantidadeFemeas: number;
  total: number;
  totalEntrada: number;
  totalIdentificados: number;
  totalPesagem: number;
  proprietario: string | null;
  produtor: string | null;
  propriedadeOrigem: string | null;
  vendaInterna: boolean;
  animaisRastreados: boolean;
  valorGta: number;
  eras: GtaEraRow[];
  gtaTemporariaRows: GtaTemporariaRow[];
  createdOn: string | null;
  updatedOn: string | null;
};

export type GtaCreateInput = {
  tipo?: GtaTipo;
  status?: GtaStatus;
  numero?: string | null;
  serie?: string | null;
  local?: string | null;
  contrato?: string | null;
  estado?: string | null;
  especie?: string | null;
  finalidade?: string | null;
  transporte?: string | null;
  dataEmissao?: string | null;
  horaEmissao?: string | null;
  dataValidade?: string | null;
  quantidadeMachos?: number | null;
  quantidadeFemeas?: number | null;
  total?: number | null;
  totalEntrada?: number | null;
  totalIdentificados?: number | null;
  totalPesagem?: number | null;
  proprietario?: string | null;
  produtor?: string | null;
  propriedadeOrigem?: string | null;
  vendaInterna?: boolean;
  animaisRastreados?: boolean;
  valorGta?: number | null;
  eras?: GtaEraRow[];
  gtaTemporariaRows?: GtaTemporariaRow[];
};

export type GtaUpdateInput = Partial<GtaCreateInput>;

export type GtaListFilters = {
  tipo?: GtaTipo | null;
  status?: GtaStatus | null;
  search?: string | null;
  page: number;
  pageSize: number;
};
