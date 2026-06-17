export function formatProductLabel(
  name: string,
  model?: string | null,
): string {
  return model ? `${name} (${model})` : name;
}
