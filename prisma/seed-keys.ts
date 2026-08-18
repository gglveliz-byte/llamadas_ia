import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.adminConfig.upsert({
    where: { clave: 'afiliado_comision_minuto_default' },
    update: {},
    create: { clave: 'afiliado_comision_minuto_default', valor: '0.05', descripcion: 'Comisión base por minuto para nuevos afiliados ($)' }
  });
  await prisma.adminConfig.upsert({
    where: { clave: 'afiliado_ganancia_instalacion_default' },
    update: {},
    create: { clave: 'afiliado_ganancia_instalacion_default', valor: '50.00', descripcion: 'Ganancia de instalación base para nuevos afiliados ($)' }
  });
  console.log('Configs seeded successfully');
}
main().catch(console.error).finally(() => prisma.$disconnect());
