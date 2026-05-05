import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const salaries = [
  // Google
  { company: 'google', role: 'SDE', level: 'L3', location: 'Bengaluru', experience_years: 1, base_salary: 2200000, bonus: 200000, stock: 500000 },
  { company: 'google', role: 'SDE', level: 'L3', location: 'Bengaluru', experience_years: 2, base_salary: 2400000, bonus: 250000, stock: 600000 },
  { company: 'google', role: 'SDE II', level: 'L4', location: 'Bengaluru', experience_years: 4, base_salary: 3500000, bonus: 400000, stock: 1500000 },
  { company: 'google', role: 'SDE II', level: 'L4', location: 'Hyderabad', experience_years: 5, base_salary: 3600000, bonus: 400000, stock: 1600000 },
  { company: 'google', role: 'Senior SDE', level: 'L5', location: 'Bengaluru', experience_years: 7, base_salary: 5500000, bonus: 800000, stock: 2500000 },
  { company: 'google', role: 'Staff Engineer', level: 'L6', location: 'Bengaluru', experience_years: 10, base_salary: 8000000, bonus: 1500000, stock: 5000000 },
  { company: 'google', role: 'SDE', level: 'L3', location: 'San Francisco', experience_years: 1, base_salary: 140000, bonus: 20000, stock: 40000 },
  { company: 'google', role: 'SDE II', level: 'L4', location: 'San Francisco', experience_years: 4, base_salary: 175000, bonus: 25000, stock: 70000 },
  { company: 'google', role: 'Senior SDE', level: 'L5', location: 'San Francisco', experience_years: 7, base_salary: 215000, bonus: 35000, stock: 120000 },
  
  // Microsoft
  { company: 'microsoft', role: 'SDE', level: 'L59', location: 'Hyderabad', experience_years: 1, base_salary: 1500000, bonus: 150000, stock: 300000 }, // We should use L3/L4/L5 standard
  { company: 'microsoft', role: 'SDE', level: 'L3', location: 'Hyderabad', experience_years: 1, base_salary: 1500000, bonus: 150000, stock: 300000 },
  { company: 'microsoft', role: 'SDE II', level: 'L4', location: 'Bengaluru', experience_years: 4, base_salary: 2500000, bonus: 250000, stock: 600000 },
  { company: 'microsoft', role: 'Senior SDE', level: 'L5', location: 'Bengaluru', experience_years: 8, base_salary: 4000000, bonus: 500000, stock: 1500000 },
  { company: 'microsoft', role: 'Principal SDE', level: 'L6', location: 'Hyderabad', experience_years: 12, base_salary: 6000000, bonus: 1000000, stock: 3000000 },
  { company: 'microsoft', role: 'SDE II', level: 'L4', location: 'Seattle', experience_years: 5, base_salary: 160000, bonus: 20000, stock: 40000 },
  { company: 'microsoft', role: 'Senior SDE', level: 'L5', location: 'Seattle', experience_years: 8, base_salary: 190000, bonus: 30000, stock: 60000 },
  
  // Amazon
  { company: 'amazon', role: 'SDE I', level: 'L3', location: 'Bengaluru', experience_years: 1, base_salary: 1800000, bonus: 300000, stock: 400000 },
  { company: 'amazon', role: 'SDE II', level: 'L4', location: 'Bengaluru', experience_years: 3, base_salary: 3000000, bonus: 0, stock: 1200000 },
  { company: 'amazon', role: 'SDE II', level: 'L4', location: 'Delhi', experience_years: 4, base_salary: 3200000, bonus: 0, stock: 1300000 },
  { company: 'amazon', role: 'SDE III', level: 'L5', location: 'Bengaluru', experience_years: 7, base_salary: 5000000, bonus: 0, stock: 2500000 },
  { company: 'amazon', role: 'SDE I', level: 'L3', location: 'Seattle', experience_years: 1, base_salary: 135000, bonus: 25000, stock: 15000 },
  { company: 'amazon', role: 'SDE II', level: 'L4', location: 'Seattle', experience_years: 4, base_salary: 170000, bonus: 0, stock: 50000 },
  
  // Flipkart
  { company: 'flipkart', role: 'SDE I', level: 'L3', location: 'Bengaluru', experience_years: 1, base_salary: 1800000, bonus: 180000, stock: 200000 },
  { company: 'flipkart', role: 'SDE II', level: 'L4', location: 'Bengaluru', experience_years: 3, base_salary: 2800000, bonus: 280000, stock: 600000 },
  { company: 'flipkart', role: 'SDE III', level: 'L5', location: 'Bengaluru', experience_years: 6, base_salary: 4500000, bonus: 450000, stock: 1500000 },
  { company: 'flipkart', role: 'Data Scientist', level: 'L4', location: 'Bengaluru', experience_years: 4, base_salary: 2600000, bonus: 260000, stock: 500000 },
  
  // Swiggy
  { company: 'swiggy', role: 'SDE I', level: 'L3', location: 'Bengaluru', experience_years: 2, base_salary: 2000000, bonus: 0, stock: 300000 },
  { company: 'swiggy', role: 'SDE II', level: 'L4', location: 'Bengaluru', experience_years: 4, base_salary: 3300000, bonus: 0, stock: 800000 },
  { company: 'swiggy', role: 'SDE III', level: 'L5', location: 'Bengaluru', experience_years: 7, base_salary: 5200000, bonus: 0, stock: 2000000 },
  { company: 'swiggy', role: 'PM', level: 'L4', location: 'Bengaluru', experience_years: 5, base_salary: 3000000, bonus: 300000, stock: 600000 },
  { company: 'swiggy', role: 'Senior PM', level: 'L5', location: 'Bengaluru', experience_years: 8, base_salary: 4800000, bonus: 500000, stock: 1200000 },
  
  // Apple
  { company: 'apple', role: 'ICT2', level: 'L3', location: 'San Francisco', experience_years: 2, base_salary: 150000, bonus: 15000, stock: 45000 },
  { company: 'apple', role: 'ICT3', level: 'L4', location: 'San Francisco', experience_years: 5, base_salary: 185000, bonus: 25000, stock: 80000 },
  { company: 'apple', role: 'ICT4', level: 'L5', location: 'San Francisco', experience_years: 8, base_salary: 220000, bonus: 40000, stock: 130000 },
]

async function main() {
  console.log('Start seeding...')
  for (const s of salaries) {
    const total_compensation = s.base_salary + (s.bonus || 0) + (s.stock || 0)
    
    // Using upsert or just create. To avoid duplicates during repeated seeds.
    // However, Prisma upsert needs a unique index. Let's just create.
    await prisma.salary.create({
      data: {
        company: s.company,
        role: s.role,
        level: s.level,
        location: s.location,
        experience_years: s.experience_years,
        base_salary: s.base_salary,
        bonus: s.bonus,
        stock: s.stock,
        total_compensation,
        confidence_score: 1.0,
      }
    })
  }
  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
