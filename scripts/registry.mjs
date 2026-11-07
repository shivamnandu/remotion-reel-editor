// Re-register compositions after adding/removing src/videos/<id>/Video.tsx.  Usage: npm run registry
import { writeRegistry } from './lib/registry.mjs';
console.log(`Registered: ${writeRegistry().join(', ') || '(none)'}`);
