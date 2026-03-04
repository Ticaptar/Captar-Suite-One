import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ cep: string }> };

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export async function GET(_: Request, { params }: Params) {
  const { cep } = await params;
  const cepDigits = String(cep ?? "").replace(/\D/g, "");

  if (cepDigits.length !== 8) {
    return NextResponse.json({ error: "CEP invalido. Informe 8 digitos." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Falha ao consultar ViaCEP." }, { status: 502 });
    }

    const data = (await response.json()) as ViaCepResponse;
    if (data?.erro) {
      return NextResponse.json({ error: "CEP nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      cep: data.cep ?? cepDigits,
      logradouro: data.logradouro ?? "",
      complemento: data.complemento ?? "",
      bairro: data.bairro ?? "",
      cidade: data.localidade ?? "",
      estado: data.uf ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Falha ao consultar CEP." }, { status: 500 });
  }
}

