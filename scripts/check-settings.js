const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tenantId = '5fff2c02-d7bb-42a8-a255-048e0de4088b';
  const settings = await prisma.businessSettings.findUnique({
    where: { userId: tenantId }
  });
  console.log(JSON.stringify(settings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
