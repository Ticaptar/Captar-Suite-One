export type ContratoStatus =
  | "aguardando_aprovacao"
  | "ativo"
  | "contendo_parc"
  | "encerrado"
  | "inativo_cancelado";

export type ContratoTipo = "saida_insumos" | "entrada_animais" | "saida_animais" | "entrada_insumos";

export type ContratoListItem = {
  exercicio: number;
  id: number;
  referenciaContrato: string;
  numero: string;
  refObjectId: string | null;
  parceiro: string | null;
  status: ContratoStatus;
  tipoContrato: ContratoTipo | string;
  inicioEm: string | null;
  valorPagoSap: number;
};

export type ContratoDadosGeraisInput = {
  tipoEntrada?: string | null;
  tabelaPreco?: string | null;
  originador?: string | null;
  sexo?: string | null;
  quantidadeNegociada?: number | null;
  animaisMapa?: number | null;
  pesoMapaKg?: number | null;
  quantidadeGta?: number | null;
  animaisMortos?: number | null;
  animaisLesionados?: number | null;
  animaisChegada?: number | null;
  pesoChegadaKg?: number | null;
  quebraKg?: number | null;
  quebraArroba?: number | null;
  quebraPercentual?: number | null;
  animaisDesembarcados?: number | null;
  animaisProcessado?: number | null;
  pesoIdentificacaoKg?: number | null;
  pesoBrutoCabeca?: number | null;
  rcEntrada?: number | null;
  pesoComRc?: number | null;
  pesoConsideradoArroba?: number | null;
  pesoConsideradoKg?: number | null;
  pesoMedioAbate?: number | null;
  dls?: string | null;
  gmd?: number | null;
  gmc?: number | null;
  consumoPercentualPv?: number | null;
  categoria?: string | null;
  racaPredominante?: string | null;
  precoVendaFutura?: boolean | null;
};

export type ContratoCustosResumoInput = {
  valorMedioCepea?: number | null;
  percentualParceria?: number | null;
  percentualRecria?: number | null;
  valorArroba?: number | null;
  valorCabeca?: number | null;
  valorFreteCab?: number | null;
  valorIcmsArroba?: number | null;
  valorIcmsFreteCab?: number | null;
  valorProtocolo?: number | null;
  valorBrinco?: number | null;
  valorTotal?: number | null;
  operacionalCabDia?: number | null;
  operacionalCabDiaVendido?: number | null;
  custoToneladaMs?: number | null;
  custoToneladaMsVendido?: number | null;
  valorArrobaProduzida?: number | null;
  animaisPrevisto?: number | null;
  descontoVendaArroba?: number | null;
};

export type ContratoLinhaPayload = Record<string, string>;

export type ContratoEmpresaSapInput = {
  sapExternalId?: string | null;
  codigo?: string | null;
  nome: string;
  cnpj?: string | null;
};

export type ContratoParceiroSapInput = {
  sapExternalId?: string | null;
  codigo?: string | null;
  nome: string;
  documento?: string | null;
};

export type ContratoCreateInput = {
  empresaId?: number | null;
  empresaSap?: ContratoEmpresaSapInput | null;
  parceiroId?: number | null;
  parceiroSap?: ContratoParceiroSapInput | null;
  comissionadoSap?: ContratoParceiroSapInput | null;
  exercicio?: number;
  numero?: number;
  referenciaContrato: string;
  refObjectId?: string | null;
  assinaturaEm?: string | null;
  prazoEntregaEm?: string | null;
  inicioEm?: string | null;
  vencimentoEm?: string | null;
  permuta?: boolean;
  contratoPermutaId?: number | null;
  aditivo?: boolean;
  tipoAditivo?: "nenhum" | "valor" | "prazo" | "quantidade" | "misto";
  contratoCedenteId?: number | null;
  contratoAnteriorId?: number | null;
  valor?: number;
  valorMaoObra?: number;
  responsavelFrete?: "empresa" | "parceiro" | "terceiro";
  calculoFrete?: "fixo" | "por_tonelada" | "por_unidade" | "por_km" | "sem_frete" | "km_rodado" | "peso";
  valorUnitarioFrete?: number;
  emissorNotaId?: number | null;
  emissorNota?: "empresa" | "parceiro" | "terceiro";
  assinaturaParceiro?: string | null;
  assinaturaEmpresa?: string | null;
  comissionadoId?: number | null;
  comissionadoTipo?: "nao_aplica" | "interno" | "parceiro" | "corretor";
  comissionadoNome?: string | null;
  valorComissao?: number;
  responsavelJuridicoNome?: string | null;
  testemunha1Nome?: string | null;
  testemunha1Cpf?: string | null;
  testemunha2Nome?: string | null;
  testemunha2Cpf?: string | null;
  objeto?: string | null;
  execucao?: string | null;
  observacoes?: string | null;
  sapDocEntry?: number | null;
  sapDocNum?: number | null;
  sapValorPago?: number;
  sapUltimoSyncEm?: string | null;
  dadosGerais?: ContratoDadosGeraisInput;
  custosResumo?: ContratoCustosResumoInput;
  custosCategorias?: ContratoLinhaPayload[];
  itens?: ContratoLinhaPayload[];
  fretes?: ContratoLinhaPayload[];
  financeiros?: ContratoLinhaPayload[];
  notas?: ContratoLinhaPayload[];
  clausulas?: ContratoLinhaPayload[];
  previsoes?: ContratoLinhaPayload[];
  mapas?: ContratoLinhaPayload[];
  criadoPor?: string | null;
  atualizadoPor?: string | null;
};

export type ContratoUpdateInput = Partial<
  Omit<ContratoCreateInput, "exercicio" | "numero" | "referenciaContrato">
> & {
  referenciaContrato?: string;
  atualizadoPor?: string | null;
};

export type ContratoStatusChangeInput = {
  status: ContratoStatus;
  motivo?: string | null;
  alteradoPor?: string | null;
};

export type ContratoSaidaInsumosListItem = ContratoListItem;
export type ContratoEntradaAnimaisListItem = ContratoListItem;
export type ContratoSaidaInsumosCreateInput = ContratoCreateInput;
export type ContratoEntradaAnimaisCreateInput = ContratoCreateInput;
export type ContratoSaidaInsumosUpdateInput = ContratoUpdateInput;
export type ContratoEntradaAnimaisUpdateInput = ContratoUpdateInput;
export type ContratoSaidaInsumosStatusChangeInput = ContratoStatusChangeInput;
export type ContratoEntradaAnimaisStatusChangeInput = ContratoStatusChangeInput;
