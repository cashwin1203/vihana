import { prisma } from '../../src/lib/prisma';

async function main() {
  const raw: any[] = await prisma.$queryRaw`SELECT * FROM Volunteer`;
  console.log('Total raw volunteers in DB:', raw.length);
  for (const r of raw) {
    console.log(`ID: ${r.id} | Name: ${r.name} | JoinedDate: ${r.joinedDate} (${typeof r.joinedDate}) | CreatedAt: ${r.createdAt} (${typeof r.createdAt}) | UpdatedAt: ${r.updatedAt} (${typeof r.updatedAt})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
