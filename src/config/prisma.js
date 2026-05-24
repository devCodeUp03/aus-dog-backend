// // src/db.ts
// import { PrismaClient } from "../generated/prisma/client.js"; // Note the .js!
// import { PrismaPg } from "@prisma/adapter-pg";
// import pg from "pg";
// import "dotenv/config";
// const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// const adapter = new PrismaPg(pool);
// export const prisma = new PrismaClient({ adapter });
// src/config/prisma.ts
// src/config/prisma.ts
import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({
    adapter,
});
