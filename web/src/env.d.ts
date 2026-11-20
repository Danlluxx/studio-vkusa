/// <reference types="astro/client" />
declare namespace App {
  interface Locals { user?: { id: number; login: string; name: string; role: 'admin' | 'manager' | 'editor' } }
}
