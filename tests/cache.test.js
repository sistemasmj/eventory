import { describe, it, expect, beforeEach } from 'vitest';
import cache from '../src/utils/cache';

describe('Backend Memory Cache (cache.js)', () => {
  beforeEach(() => {
    cache.clear();
  });

  it('debe almacenar y recuperar valores con clave', () => {
    cache.set('test:key', { message: 'hello' }, 5000);
    const value = cache.get('test:key');
    expect(value).toEqual({ message: 'hello' });
  });

  it('debe retornar null para claves no existentes', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('debe eliminar claves correctamente con del()', () => {
    cache.set('test:delete', 123, 5000);
    expect(cache.get('test:delete')).toBe(123);
    cache.del('test:delete');
    expect(cache.get('test:delete')).toBeNull();
  });

  it('debe retornar estadísticas del cache con getStats()', () => {
    cache.set('key1', 'val1', 10000);
    cache.set('key2', 'val2', 10000);

    const stats = cache.getStats();
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(2);
  });
});
