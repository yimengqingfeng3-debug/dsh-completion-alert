// The resolve hook registered by test/loader.mjs.
export function initialize(data) {
  const mapped = data?.mapped ?? {};
  globalThis.__dshCompletionAlertMapped ??= mapped;
}

export async function resolve(specifier, context, nextResolve) {
  const mapped = globalThis.__dshCompletionAlertMapped ?? {};
  if (typeof specifier === "string" && mapped[specifier] !== null && mapped[specifier] !== undefined) {
    return { url: mapped[specifier], shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
