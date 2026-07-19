declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string, options?: { readonly?: boolean; create?: boolean });
    query(sql: string): { all: (...parameters: unknown[]) => unknown[] };
    close(): void;
  }
}
