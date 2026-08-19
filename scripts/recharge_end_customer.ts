import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // CONFIGURA ESTOS VALORES
  const endCustomerId = process.env.CUSTOMER_ID || ''; 
  const amountToRecharge = parseFloat(process.env.AMOUNT || '0');
  const fieldToRecharge = process.env.FIELD || 'dinero'; // 'dinero' o 'minutos'

  if (!endCustomerId) {
    console.error('Error: Debes proporcionar el ID del EndCustomer.');
    console.error('Ejemplo de uso: CUSTOMER_ID="uuid-del-cliente" AMOUNT="50" npx tsx recharge_end_customer.ts');
    process.exit(1);
  }

  if (amountToRecharge <= 0) {
    console.error('Error: El monto a recargar (AMOUNT) debe ser mayor a 0.');
    process.exit(1);
  }

  try {
    const customer = await prisma.endCustomer.findUnique({
      where: { id: endCustomerId },
    });

    if (!customer) {
      console.error(`Error: No se encontró al cliente final con ID: ${endCustomerId}`);
      process.exit(1);
    }

    console.log(`Cliente encontrado: ${customer.nombre} (${customer.telefono})`);
    console.log(`Saldo actual - Dinero: ${customer.saldoDinero}, Minutos: ${customer.saldoMinutos}`);

    let updateData = {};
    if (fieldToRecharge === 'minutos') {
      updateData = { saldoMinutos: { increment: amountToRecharge } };
      console.log(`Recargando ${amountToRecharge} minutos...`);
    } else {
      updateData = { saldoDinero: { increment: amountToRecharge } };
      console.log(`Recargando $${amountToRecharge} de saldo en dinero...`);
    }

    const updatedCustomer = await prisma.endCustomer.update({
      where: { id: endCustomerId },
      data: updateData,
    });

    console.log('✅ Recarga exitosa.');
    console.log(`Nuevo saldo - Dinero: ${updatedCustomer.saldoDinero}, Minutos: ${updatedCustomer.saldoMinutos}`);
  } catch (error) {
    console.error('Error durante la recarga:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
