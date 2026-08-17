import { NextResponse } from 'next/server';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const params = await context.params;
  
  // Redirigir a la página principal con el slug del afiliado en la query string
  // La pantalla de login automáticamente detectará "ref" y mostrará el formulario de registro
  return NextResponse.redirect(`${baseUrl}/?ref=${params.slug}`);
}
