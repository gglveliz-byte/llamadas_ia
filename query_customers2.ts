import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.endCustomer.findMany({
    where: {
      telefono: { in: ['+593998008022', '+593 99 800 8022', '+593990712984', '+593 99 071 2984', '+593 998 008 022', '+593 990 712 984'] }
    }
  });
  console.log('Customers found by phone:', customers);
}
main().finally(() => prisma.$disconnect());
