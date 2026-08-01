import { NextResponse } from "next/server";
import { z } from "zod";

export function validate<T>(schema: z.Schema<T>, data: unknown): { data?: T; error?: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues;
    const first = issues[0];
    const mensaje = first
      ? `${first.path.join(".")}: ${first.message}`
      : "Datos inválidos";
    return { error: NextResponse.json({ error: mensaje }, { status: 400 }) };
  }
  return { data: result.data };
}
