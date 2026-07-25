import { prisma } from '../../src/lib/prisma';

async function main() {
  const testOrg = await prisma.organization.create({ data: { name: 'Format Test Org' } });
  console.log('Created via Prisma:', testOrg);
}

main().catch(console.error).finally(() => prisma.$disconnect());
