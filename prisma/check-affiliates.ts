import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.affiliate.create({
      data: {
        nombre: 'test',
        email: 'test' + Date.now() + '@test.com',
        passwordHash: 'hash',
        slug: 'test-slug-' + Date.now(),
        comisionPorMinuto: 0.05,
        feeInstalacion: 200.00,
        gananciaInstalacion: 50.00,
        isActive: true
      }
    });
    console.log('success');
  } catch (e) {
    console.error('ERROR CREATING:', e);
  }
}

main().catch(console.error).finally(() => { prisma.$disconnect(); });
