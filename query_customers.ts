import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'lveliz213@hotmail.com' }
  });
  if (!user) {
    console.log('No user found');
    return;
  }
  const customers = await prisma.endCustomer.findMany({
    where: {
      tenantId: user.id
    }
  });
  console.log('Customers found:', customers);
}
main().finally(() => prisma.$disconnect());
