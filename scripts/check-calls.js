const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestMetrics = await prisma.callMetric.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log("Últimas llamadas:");
  console.log(latestMetrics);
}

main().catch(console.error).finally(() => prisma.$disconnect());
