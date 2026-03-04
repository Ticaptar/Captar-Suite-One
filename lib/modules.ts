export type ModuleLink = {
  label: string;
  href: string;
};

export type ModuleDefinition = {
  id: string;
  label: string;
  links: ModuleLink[];
};

export const moduleDefinitions: ModuleDefinition[] = [
  {
    id: "negociacoes",
    label: "Negociacoes e Contratos",
    links: [
      { label: "Contrato de Saida de Insumos", href: "/contratos/saida-insumos" },
      { label: "Contrato de Entrada de Animais", href: "/contratos/entrada-animais" },
      { label: "Contrato de Saida de Animais", href: "/contratos/saida-animais" },
      { label: "Contrato de Entrada de Insumos", href: "/contratos/entrada-insumos" },
      { label: "Tabela Boitel", href: "#" },
      { label: "Visita", href: "/visitas" },
      { label: "Tabela de Preco", href: "#" },
      { label: "Adiantamentos", href: "#" },
      { label: "Habilitacao P/ Venda", href: "#" },
      { label: "Pre Oferta", href: "#" },
      { label: "Acerto Frete", href: "#" },
      { label: "Mapa de Pesagem", href: "/mapa-pesagem" },
      { label: "Tabela @ Produzida", href: "#" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configuracoes",
    links: [
      { label: "Usuarios e Perfis", href: "#" },
      { label: "Parametros de Integracao", href: "#" },
      { label: "Regras de Emissao de GTA", href: "#" },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    links: [
      { label: "Produtores", href: "#" },
      { label: "Transportadoras", href: "#" },
      { label: "Unidades e Currais", href: "#" },
    ],
  },
];
