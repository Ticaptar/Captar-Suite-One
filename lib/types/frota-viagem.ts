export type FrotaViagemStatus = "rascunho" | "aprovado" | "encerrado" | "cancelado";

export type FrotaViagemListItem = {
  id: number;
  numero: string | null;
  dataSaida: string | null;
  status: FrotaViagemStatus;
  motorista: string | null;
  equipamento: string | null;
  observacao: string | null;
};

export type FrotaViagemRecord = {
  id: number;
  numero: string | null;
  status: FrotaViagemStatus;
  equipamentoId: string | null;
  equipamentoDescricao: string | null;
  reboque: string | null;
  rota: string | null;
  motorista: string | null;
  responsavel: string | null;
  contratoId: number | null;
  contratoReferencia: string | null;
  transportadorId: number | null;
  transportadorNome: string | null;
  dataSaida: string | null;
  dataRetorno: string | null;
  dataValidade: string | null;
  motivo: string | null;
  localOrigem: string | null;
  localDestino: string | null;
  condicaoPagamentoId: string | null;
  condicaoPagamento: string | null;
  excessos: string | null;
  kmPrevisto: number;
  kmReal: number;
  pesoPrevisto: number;
  pesoRealizado: number;
  cidadeOrigemCodigo: string | null;
  cidadeOrigemNome: string | null;
  cidadeDestinoCodigo: string | null;
  cidadeDestinoNome: string | null;
  odometroSaida: number;
  observacao: string | null;
  declaracaoResponsabilidade: string | null;
  createdOn: string | null;
  updatedOn: string | null;
};

export type FrotaViagemCreateInput = {
  numero?: string | null;
  status?: FrotaViagemStatus;
  equipamentoId?: string | null;
  equipamentoDescricao?: string | null;
  reboque?: string | null;
  rota?: string | null;
  motorista?: string | null;
  responsavel?: string | null;
  contratoId?: number | null;
  contratoReferencia?: string | null;
  transportadorId?: number | null;
  transportadorNome?: string | null;
  dataSaida?: string | null;
  dataRetorno?: string | null;
  dataValidade?: string | null;
  motivo?: string | null;
  localOrigem?: string | null;
  localDestino?: string | null;
  condicaoPagamentoId?: string | null;
  condicaoPagamento?: string | null;
  excessos?: string | null;
  kmPrevisto?: number | null;
  kmReal?: number | null;
  pesoPrevisto?: number | null;
  pesoRealizado?: number | null;
  cidadeOrigemCodigo?: string | null;
  cidadeOrigemNome?: string | null;
  cidadeDestinoCodigo?: string | null;
  cidadeDestinoNome?: string | null;
  odometroSaida?: number | null;
  observacao?: string | null;
  declaracaoResponsabilidade?: string | null;
};

export type FrotaViagemUpdateInput = Partial<FrotaViagemCreateInput>;

export type FrotaViagemListFilters = {
  status?: FrotaViagemStatus | null;
  search?: string | null;
  page: number;
  pageSize: number;
};
