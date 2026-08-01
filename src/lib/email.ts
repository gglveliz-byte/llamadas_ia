import { ApiClient } from "./api";

interface EmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function enviarEmail(params: EmailParams): Promise<boolean> {
  try {
    const { ok } = await ApiClient.post<{ ok: boolean }>("/internal/email", {
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return ok;
  } catch (e) {
    console.error(`Error enviando email a ${params.to}:`, (e as Error).message);
    return false;
  }
}