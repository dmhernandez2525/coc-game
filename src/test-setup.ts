// Node 22 ships an experimental built-in `localStorage` global that is inert
// unless the process was started with --localstorage-file. Under the vitest
// coverage pool that inert global can shadow jsdom's Storage, so bare
// `localStorage.clear()` throws "Cannot read properties of undefined". Install
// a working in-memory Storage whenever the ambient one is missing or broken,
// leaving a healthy jsdom Storage untouched.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length(): number {
    return this.store.size
  }
  clear(): void {
    this.store.clear()
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

function isWorkingStorage(value: unknown): value is Storage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<Storage>
  return (
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function' &&
    typeof candidate.clear === 'function'
  )
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  const globalObject = globalThis as Record<string, unknown>
  let current: unknown
  try {
    current = globalObject[name]
  } catch {
    current = undefined
  }
  if (isWorkingStorage(current)) return
  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, name, { value: storage, writable: true, configurable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, { value: storage, writable: true, configurable: true })
  }
}

ensureStorage('localStorage')
ensureStorage('sessionStorage')
