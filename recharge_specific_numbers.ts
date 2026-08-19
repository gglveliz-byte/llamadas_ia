import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const email = 'lveliz213@hotmail.com';
  const tenant = await prisma.user.findUnique({
    where: { email }
  });

  if (!tenant) {
    console.error(`User with email ${email} not found.`);
    return;
  }

  const phones = ['+593998008022', '+593990712984'];
  const amountToRecharge = 100;

  for (let phone of phones) {
    let customer = await prisma.endCustomer.findUnique({
      where: {
        tenantId_telefono: {
          tenantId: tenant.id,
          telefono: phone
        }
      }
    });

    if (!customer) {
      console.log(`Customer with phone ${phone} not found. Creating...`);
      customer = await prisma.endCustomer.create({
        data: {
          tenantId: tenant.id,
          telefono: phone,
          nombre: `Cliente ${phone}`,
          saldoDinero: amountToRecharge
        }
      });
      console.log(`✅ Created and recharged $${amountToRecharge} to ${phone}`);
    } else {
      console.log(`Customer with phone ${phone} found. Recharging...`);
      customer = await prisma.endCustomer.update({
        where: { id: customer.id },
        data: {
          saldoDinero: { increment: amountToRecharge }
        }
      });
      console.log(`✅ Recharged $${amountToRecharge} to ${phone}. New balance: ${customer.saldoDinero}`);
    }
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
