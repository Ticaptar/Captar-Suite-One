# Captar Suite

Base inicial do sistema de fazenda de gado com identidade visual da Captar.

## Primeiro modulo

- Negociacoes e Contratos com menu dropdown
- Home com dashboards operacionais
- Estrutura pronta para integracoes e emissao de GTA

## Executar

```bash
npm install
npm run dev
```

## Banco de dados

Defina a variavel `DATABASE_URL` para habilitar as APIs.

Exemplo:

```bash
set DATABASE_URL=postgres://usuario:senha@localhost:5432/seu_banco
```

Schema inicial do modulo:

- `docs/sql/001_cs_contratos_saida_insumos_schema.sql`

## SAP B1 Service Layer

Para carregar parceiros e filiais via SAP B1 nos inputs do formulario:

```bash
set SAP_SL_BASE_URL=https://servidor-sap:50000
set SAP_SL_COMPANY_DB=SUA_BASE_SAP
set SAP_SL_USERNAME=usuario
set SAP_SL_PASSWORD=senha
```

Com essas variaveis configuradas, os endpoints de cadastro tentam buscar no SAP e mapear para os IDs locais.
Se nao houver mapeamento, o sistema usa fallback local do banco.

## APIs do modulo

- `GET /api/contratos/saida-insumos` (lista com filtros `status`, `exercicio`, `search`, `page`, `pageSize`)
- `POST /api/contratos/saida-insumos` (cria contrato)
- `GET /api/contratos/saida-insumos/:id` (detalhe com abas relacionadas)
- `PATCH /api/contratos/saida-insumos/:id` (atualiza campos do contrato)
- `POST /api/contratos/saida-insumos/:id/status` (muda status e grava historico)
