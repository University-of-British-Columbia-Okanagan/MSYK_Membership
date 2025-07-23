/**
 * Creates or retrieves a singleton instance of any value type
 * Ensures only one instance exists globally for a given name
 * @template Value - The type of value to store as singleton
 * @param name - Unique identifier for the singleton instance
 * @param valueFactory - Factory function that creates the value when first accessed
 * @returns Value - The singleton instance (existing or newly created)
 */
export const singleton = <Value>(
  name: string,
  valueFactory: () => Value
): Value => {
  const g = global as any;
  g.__singletons ??= {};
  g.__singletons[name] ??= valueFactory();
  return g.__singletons[name];
};
