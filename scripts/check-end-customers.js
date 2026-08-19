const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '5fff2c02-d7bb-42a8-a255-048e0de4088b';
  const customers = await prisma.endCustomer.findMany({
    where: { tenantId }
  });
  console.log(customers);
}

main().catch(console.error).finally(() => prisma.$disconnect());
