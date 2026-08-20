import { NextResponse } from 'next/server';

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const url = new URL(request.url);
  const params = await context.params;
  
  // Usar DOMINIO_FRONTEND si está definido (para evitar localhost en producción tras un reverse proxy)
  const frontendUrl = process.env.DOMINIO_FRONTEND || `${url.protocol}//${request.headers.get('x-forwarded-host') || url.host}`;
  
  // Redirigir a la página principal con el slug del afiliado en la query string
  // La pantalla de login automáticamente detectará "ref" y mostrará el formulario de registro
  return NextResponse.redirect(new URL(`/?ref=${params.slug}`, frontendUrl));
}
