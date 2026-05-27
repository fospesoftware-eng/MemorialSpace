// Re-export the generated zod runtime schemas. The TypeScript interfaces
// in `./generated/types` are intentionally NOT re-exported here because
// orval emits the same identifier (e.g. `CreateBookingBody`) as both a
// `zod.object(...)` value and a TypeScript interface, which would create
// re-export ambiguity in this barrel. Consumers that need the static
// type can derive it from the schema with `z.infer<typeof ...>`.
export * from "./generated/api";
