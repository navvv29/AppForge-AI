import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { normalizeCompany } from '@/lib/normalize';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    
    const company = searchParams.get('company');
    const role = searchParams.get('role');
    const level = searchParams.get('level');
    const location = searchParams.get('location');
    const sort = searchParams.get('sort');

    const where: any = {};
    if (company) where.company = normalizeCompany(company);
    if (role) where.role = { contains: role, mode: 'insensitive' };
    if (level) where.level = level.toUpperCase();
    if (location) where.location = { contains: location, mode: 'insensitive' };

    let orderBy: any = { total_compensation: 'desc' };
    
    // Sort format could be just a field name, or field_asc / field_desc
    if (sort) {
      if (sort.endsWith('_asc')) {
        orderBy = { [sort.replace('_asc', '')]: 'asc' };
      } else if (sort.endsWith('_desc')) {
        orderBy = { [sort.replace('_desc', '')]: 'desc' };
      } else {
        // default to desc for the provided field
        orderBy = { [sort]: 'desc' };
      }
    }

    const salaries = await prisma.salary.findMany({
      where,
      orderBy,
    });

    return NextResponse.json(salaries);

  } catch (error) {
    console.error('Fetch salaries error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
