const { prisma } = require('../config/PrismaConfig')

exports.generateInvoiceNumber = async () => {
  const sequence = await prisma.$queryRaw`
  SELECT nextval('invoice_number_seq') as val;
  `
  const num = sequence[0].val.toString().padStart(6, "0")
  const d = new Date();
  const year = d.getFullYear();

  const invoiceNumber = `INV-${year}-${num}`

  return invoiceNumber
}