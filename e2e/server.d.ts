declare module "*/server.mjs" {
  export const HEADERS: Record<string, string>;
  export function serve(root: string, port?: number): Promise<{ url: string; close: () => void }>;
}
