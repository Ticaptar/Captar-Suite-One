"use client";

import { useParams } from "next/navigation";
import { VisitaFormPage } from "@/components/visita-form-page";

export default function EditarVisitaPage() {
  const params = useParams<{ id: string }>();
  const visitaId = Number.parseInt(params.id, 10);
  if (Number.isNaN(visitaId) || visitaId <= 0) {
    return <VisitaFormPage />;
  }
  return <VisitaFormPage visitaId={visitaId} />;
}

