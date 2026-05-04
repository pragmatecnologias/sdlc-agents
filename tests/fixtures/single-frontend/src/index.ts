/**
 * Main entry point for the single-frontend application.
 */

export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function add(a: number, b: number): number {
  return a + b;
}

// Application bootstrap
function main(): void {
  console.log(greet('World'));
}

main();
