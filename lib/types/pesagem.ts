export type PesagemStatus = "disponivel" | "peso_finalizado" | "fechado" | "cancelado";

export type PesagemTipo = "entrada_animais" | "saida_animais" | "entrada_insumos" | "saida_insumos";

export type PesagemDocumentoFiscal = {
  id?: number;
  documento: string;
};

export type PesagemMotivoRow = {
  id?: number;
  motivo: string;
  tempoMinutos: number;
};

export type PesagemCalendarioRow = {
  id?: number;
  data: string;
  dia: string;
  feriado: boolean;
  pago: boolean;
  valor: number;
};

export type PesagemGtaRow = {
  id?: number;
  gta: string;
  quantidadeMachos: number;
  quantidadeFemeas: number;
  quantidadeTotal: number;
};

export type PesagemClassificacaoRow = {
  id?: number;
  tipoAnalise: string;
  valorEncontrado: number;
  pesoDesconto: number;
  unidade: string | null;
};

export type PesagemFechamento = {
  tabelaFrete: string | null;
  calculoFrete: string | null;
  periodoProducaoAgricola: string | null;
  talhao?: string | null;
  pesoSecador?: number;
  pesoDescontoClassificado?: number;
  pesoLiquidoDesconto?: number;
  pesoNotaFiscal?: number;
  pesoOrigem?: number;
  numeroLaudo?: string | null;
  armazenagemSilo?: string | null;
  unidadeMedidaFrete: string | null;
  valorUnitarioFrete: number;
  valorCombustivel: number;
  valorPedagio: number;
  outrasDespesas: number;
  litragem: number;
  valorCombLitro: number;
  valorDiaria: number;
  valorComissao: number;
  valorFrete: number;
  pesagemOrigem: string | null;
  dataVencimento: string | null;
  qtdAnimais: number;
  qtdAnimaisOrigem: number;
  mapaPesagem: string | null;
  cte: string | null;
  nfExterna: string | null;
};

export type PesagemEntradaAnimaisListItem = {
  id: number;
  status: PesagemStatus;
  numeroTicket: string | null;
  contratoId: number | null;
  contrato: string | null;
  motorista: string | null;
  transportador: string | null;
  contratante: string | null;
  item: string | null;
  dataChegada: string | null;
  dataSaida: string | null;
  placa: string | null;
  equipamento: string | null;
  operacao: string | null;
  pesoBruto: number;
  pesoLiquido: number;
};

export type PesagemEntradaAnimaisRecord = {
  id: number;
  status: PesagemStatus;
  tipo: PesagemTipo;
  numeroTicket: string | null;
  contratoId: number | null;
  contratoReferencia: string | null;
  itemId: number | null;
  itemDescricao: string | null;
  fazendaId: number | null;
  fazendaNome: string | null;
  tipoFrete: string | null;
  responsavelFrete: string | null;
  transportadorId: number | null;
  transportadorNome: string | null;
  contratanteId: number | null;
  contratanteNome: string | null;
  motoristaId: number | null;
  motoristaNome: string | null;
  dataChegada: string | null;
  horaChegada: string | null;
  dataSaida: string | null;
  horaSaida: string | null;
  placa: string | null;
  equipamentoId: number | null;
  equipamentoNome: string | null;
  viagem: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  kmInicial: number;
  kmFinal: number;
  kmTotal: number;
  observacao: string | null;
  pesoBruto: number;
  pesoTara: number;
  pesoLiquido: number;
  operacao: string | null;
  createdOn: string | null;
  updatedOn: string | null;
  documentosFiscais: PesagemDocumentoFiscal[];
  motivosAtraso: PesagemMotivoRow[];
  motivosEspera: PesagemMotivoRow[];
  calendario: PesagemCalendarioRow[];
  gtaRows: PesagemGtaRow[];
  classificacaoRows?: PesagemClassificacaoRow[];
  fechamento: PesagemFechamento;
};

export type PesagemEntradaAnimaisCreateInput = {
  status?: PesagemStatus;
  tipo?: PesagemTipo;
  numeroTicket?: string | null;
  contratoId?: number | null;
  contratoReferencia?: string | null;
  itemId?: number | null;
  itemDescricao?: string | null;
  fazendaId?: number | null;
  fazendaNome?: string | null;
  tipoFrete?: string | null;
  responsavelFrete?: string | null;
  transportadorId?: number | null;
  transportadorNome?: string | null;
  contratanteId?: number | null;
  contratanteNome?: string | null;
  motoristaId?: number | null;
  motoristaNome?: string | null;
  dataChegada?: string | null;
  horaChegada?: string | null;
  dataSaida?: string | null;
  horaSaida?: string | null;
  placa?: string | null;
  equipamentoId?: number | null;
  equipamentoNome?: string | null;
  viagem?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
  kmInicial?: number | null;
  kmFinal?: number | null;
  kmTotal?: number | null;
  observacao?: string | null;
  pesoBruto?: number | null;
  pesoTara?: number | null;
  pesoLiquido?: number | null;
  operacao?: string | null;
  documentosFiscais?: PesagemDocumentoFiscal[];
  motivosAtraso?: PesagemMotivoRow[];
  motivosEspera?: PesagemMotivoRow[];
  calendario?: PesagemCalendarioRow[];
  gtaRows?: PesagemGtaRow[];
  classificacaoRows?: PesagemClassificacaoRow[];
  fechamento?: Partial<PesagemFechamento> | null;
};

export type PesagemEntradaAnimaisUpdateInput = Partial<PesagemEntradaAnimaisCreateInput>;

export type PesagemEntradaAnimaisListFilters = {
  status?: PesagemStatus | null;
  search?: string | null;
  page: number;
  pageSize: number;
};

export type PesagemEntradaAnimaisOptionsPayload = {
  contratos: Array<{ id: number; numero: string | null; descricao: string | null }>;
  itens: Array<{ id: number; codigo: string | null; descricao: string }>;
  fazendas: Array<{ id: number; codigo: string | null; nome: string }>;
  parceiros: Array<{ id: number; codigo: string | null; nome: string }>;
  motoristas: Array<{ id: number; nome: string }>;
  equipamentos: Array<{ id: number; codigo: string | null; descricao: string }>;
  viagens: Array<{ id: number; numero: string | null; descricao: string | null }>;
};

export type PesagemSaidaAnimaisListItem = PesagemEntradaAnimaisListItem;
export type PesagemSaidaAnimaisRecord = PesagemEntradaAnimaisRecord;
export type PesagemSaidaAnimaisCreateInput = PesagemEntradaAnimaisCreateInput;
export type PesagemSaidaAnimaisUpdateInput = PesagemEntradaAnimaisUpdateInput;
export type PesagemSaidaAnimaisListFilters = PesagemEntradaAnimaisListFilters;
export type PesagemSaidaAnimaisOptionsPayload = PesagemEntradaAnimaisOptionsPayload;

export type PesagemEntradaInsumosListItem = PesagemEntradaAnimaisListItem;
export type PesagemEntradaInsumosRecord = PesagemEntradaAnimaisRecord;
export type PesagemEntradaInsumosCreateInput = PesagemEntradaAnimaisCreateInput;
export type PesagemEntradaInsumosUpdateInput = PesagemEntradaAnimaisUpdateInput;
export type PesagemEntradaInsumosListFilters = PesagemEntradaAnimaisListFilters;
export type PesagemEntradaInsumosOptionsPayload = PesagemEntradaAnimaisOptionsPayload;

export type PesagemSaidaInsumosListItem = PesagemEntradaAnimaisListItem;
export type PesagemSaidaInsumosRecord = PesagemEntradaAnimaisRecord;
export type PesagemSaidaInsumosCreateInput = PesagemEntradaAnimaisCreateInput;
export type PesagemSaidaInsumosUpdateInput = PesagemEntradaAnimaisUpdateInput;
export type PesagemSaidaInsumosListFilters = PesagemEntradaAnimaisListFilters;
export type PesagemSaidaInsumosOptionsPayload = PesagemEntradaAnimaisOptionsPayload;
