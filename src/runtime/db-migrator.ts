import type { FullAppSchema } from "../schemas/app.schema.js";

export function toSqlMigrations(schema: FullAppSchema): string[] {
  return schema.dbSchema.tables.map((table) => {
    const columnSql = table.columns
      .map((column) => {
        const sqlType =
          column.type === "id"
            ? "TEXT"
            : column.type === "integer"
              ? "INTEGER"
              : column.type === "number" || column.type === "float"
                ? "REAL"
                : column.type === "boolean"
                  ? "INTEGER"
                  : "TEXT";
        const required = column.required ? " NOT NULL" : "";
        return `  ${column.name} ${sqlType}${required}`;
      })
      .join(",\n");
    return `CREATE TABLE IF NOT EXISTS ${table.name} (\n${columnSql}\n);`;
  });
}
