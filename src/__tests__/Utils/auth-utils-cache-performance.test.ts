import { jest } from '@jest/globals'
import { makeCacheableSignalKeyStore } from '../../Utils/auth-utils'

describe('makeCacheableSignalKeyStore batch IO', () => {
	it('reads cache keys concurrently and fills missing keys from the backing store', async () => {
		let active = 0
		let maxActive = 0
		const cache = {
			get: jest.fn(async () => {
				active++
				maxActive = Math.max(maxActive, active)
				await Promise.resolve()
				active--
				return undefined
			}),
			set: jest.fn(async () => undefined),
			flushAll: jest.fn(async () => undefined)
		}
		const store = {
			get: jest.fn(async (_type: string, ids: string[]) => Object.fromEntries(ids.map(id => [id, { id }]))),
			set: jest.fn(async () => undefined)
		}

		const keyStore = makeCacheableSignalKeyStore(store as any, undefined, cache as any)
		const result = await keyStore.get('session' as any, ['one', 'two', 'three'])

		expect(maxActive).toBe(3)
		expect(result).toEqual({
			one: { id: 'one' },
			two: { id: 'two' },
			three: { id: 'three' }
		})
		expect(store.get).toHaveBeenCalledWith('session', ['one', 'two', 'three'])
		expect(cache.set).toHaveBeenCalledTimes(3)
	})

	it('writes a cache batch concurrently before persisting the backing store', async () => {
		let active = 0
		let maxActive = 0
		let completedWrites = 0
		const cache = {
			get: jest.fn(async () => undefined),
			set: jest.fn(async () => {
				active++
				maxActive = Math.max(maxActive, active)
				await Promise.resolve()
				active--
				completedWrites++
			}),
			flushAll: jest.fn(async () => undefined)
		}
		const store = {
			get: jest.fn(async () => ({})),
			set: jest.fn(async () => {
				expect(completedWrites).toBe(3)
			})
		}

		const keyStore = makeCacheableSignalKeyStore(store as any, undefined, cache as any)
		await keyStore.set({ session: { one: { id: 'one' }, two: { id: 'two' }, three: { id: 'three' } } } as any)

		expect(maxActive).toBe(3)
		expect(cache.set).toHaveBeenCalledTimes(3)
		expect(store.set).toHaveBeenCalledTimes(1)
	})
})
