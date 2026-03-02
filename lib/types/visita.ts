export type VisitaStatus =
  | "oportunidade"
  | "em_analise"
  | "negociacao"
  | "contrato_gerado"
  | "perdida"
  | "arquivada";

export type VisitaTipoContrato = "entrada_animais" | "saida_insumos";

export type VisitaAtividadePayload = {
  tipoAtividade: string;
  dataVencimento: string;
  resumo: string;
  responsavel: string;
  dataRealizacao: string;
  descricaoAtividade: string;
};

export type VisitaCategoriaItemPayload = {
  categoria: string;
  raca: string;
  qualidade: string;
  condicaoPagto: string;
  pesoAproxArroba: string;
  rcPercentual: string;
  valorArroba: string;
  valorTabelaArroba: string;
  freteArroba: string;
  valorIcmsArroba: string;
  cabecas: string;
};

export type VisitaListItem = {
  id: number;
  status: VisitaStatus;
  dataVisita: string | null;
  parceiro: string | null;
  responsavel: string | null;
  endereco: string | null;
  rebanhoAtual: number;
  contratoGeradoId: number | null;
};

export type VisitaRecord = {
  id: number;
  empresaId: number;
  status: VisitaStatus;
  dataVisita: string | null;
  parceiroId: number | null;
  parceiroCodigo: string | null;
  parceiroNome: string | null;
  responsavelId: number | null;
  responsavelCodigo: string | null;
  responsavelNome: string | null;
  cep: string | null;
  endereco: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  email: string | null;
  rebanhoAtual: number;
  informacoesDetalhadas: string | null;
  categoria: string | null;
  raca: string | null;
  observacoes: string | null;
  categoriaItens: VisitaCategoriaItemPayload[];
  tipoContratoSugerido: VisitaTipoContrato;
  contratoGeradoId: number | null;
  criadoEm: string | null;
  atualizadoEm: string | null;
};

export type VisitaCreateInput = {
  empresaId: number;
  status?: VisitaStatus;
  dataVisita: string;
  parceiroId?: number | null;
  parceiroCodigo?: string | null;
  parceiroNome?: string | null;
  responsavelId?: number | null;
  responsavelCodigo?: string | null;
  responsavelNome?: string | null;
  cep?: string | null;
  endereco?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  email?: string | null;
  rebanhoAtual?: number | null;
  informacoesDetalhadas?: string | null;
  categoria?: string | null;
  raca?: string | null;
  observacoes?: string | null;
  tipoContratoSugerido?: VisitaTipoContrato;
  atividades?: VisitaAtividadePayload[];
  categoriaItens?: VisitaCategoriaItemPayload[];
};

export type VisitaUpdateInput = Partial<Omit<VisitaCreateInput, "empresaId" | "dataVisita">> & {
  empresaId?: number;
  dataVisita?: string;
};
