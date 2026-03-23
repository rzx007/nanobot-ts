# AGENTS.md - Agentic Coding Guidelines

## Build, Test & Lint Commands

```bash
# Build all packages
bun run build

# Run all tests
bun run test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage
bun run test:coverage

# Run linting
bun run lint

# Auto-fix linting issues
bun run lint:fix

# Format code with Prettier
bun run format

# TypeScript type checking
bun run typecheck

# Clean build artifacts
bun run clean
```

## Project Structure

- **Monorepo**: packages in `packages/*` directory
- **Packages**: channels, cli, logger, main, providers, server, shared, tui, utils, web, workspace
- **Tests**: `tests/` directory (unit/, integration/)
- **Path aliases**: Use `@nanobot/*` (e.g., `@nanobot/shared`, `@nanobot/providers`)

## Code Style

### TypeScript Configuration
- **Target**: ES2022
- **Strict mode**: enabled
- **exactOptionalPropertyTypes**: true
- **noUnusedLocals/noUnusedParameters**: enabled
- Use `bun-types` for type definitions

### Prettier Formatting
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "arrowParens": "avoid"
}
```

### ESLint Rules
- Prefer `const` over `let`, never use `var`
- Use nullish coalescing (`??`) and optional chaining (`?.`)
- No floating promises - always handle async properly
- Warn on `any`, avoid explicit any when possible

### Naming Conventions
- **Classes/Interfaces/Types**: PascalCase (e.g., `BaseChannel`, `MessageBus`)
- **Functions/Variables**: camelCase
- **Enums**: PascalCase (e.g., `LogLevel`)
- **Files**: kebab-case.ts or PascalCase.ts for components
- **Constants**: SCREAMING_SNAKE_CASE

### Import Order
1. Built-in imports (node, fs, etc.)
2. External packages (ai, winston, etc.)
3. Path aliases (@nanobot/*)
4. Relative imports (./, ../)

### Error Handling
- Use custom error classes extending `Error` or `AISDKError`
- Wrap errors with context: `throw new ProviderError(message)`
- Use try-catch with proper error conversion: `err instanceof Error ? error : new Error(String(error))`
- Prefer `logger.error()` for logging errors

### Type Definitions
- Use Zod for runtime validation schemas
- Export inferred types: `export type Config = z.infer<typeof ConfigSchema>`
- Avoid `any`, use `unknown` when type is uncertain
- Use `Record<string, unknown>` for dynamic key-value objects

### Testing
- Use Vitest with `describe/it/expect` syntax
- Test files: `*.test.ts` or `*.spec.ts` in `tests/` directory
- Follow naming: `tests/unit/bus/queue.test.ts`
- Use setup file: `tests/setup.ts` for global mocks

### Documentation
- Use JSDoc for public APIs: `/** description */`
- Add `@param` and `@returns` for functions
- Keep comments concise and relevant
- No TODO comments - create issues instead

### Best Practices
- Use readonly for immutable fields
- Prefer `interface` over `type` for object shapes
- Use early returns to reduce nesting
- Extract magic numbers into named constants
- Keep functions small and focused
- Use guard clauses for validation
