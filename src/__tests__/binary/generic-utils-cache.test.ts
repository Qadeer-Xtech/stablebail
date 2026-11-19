import { getBinaryNodeChildren } from '../../WABinary/generic-utils'
import type { BinaryNode } from '../../WABinary/types'

describe('getBinaryNodeChildren indexed lookup', () => {
	const node: BinaryNode = {
		tag: 'iq',
		attrs: {},
		content: [
			{ tag: 'message', attrs: { id: 'one' } },
			{ tag: 'receipt', attrs: { id: 'receipt-1' } },
			{ tag: 'message', attrs: { id: 'two' } },
			{ tag: 'notification', attrs: {} }
		]
	}

	it('returns every child matching a tag in original order', () => {
		expect(getBinaryNodeChildren(node, 'message')).toEqual([
			{ tag: 'message', attrs: { id: 'one' } },
			{ tag: 'message', attrs: { id: 'two' } }
		])
	})

	it('reuses the indexed result for repeated lookups on the same node', () => {
		const first = getBinaryNodeChildren(node, 'receipt')
		const second = getBinaryNodeChildren(node, 'receipt')

		expect(second).toBe(first)
		expect(second).toEqual([{ tag: 'receipt', attrs: { id: 'receipt-1' } }])
	})

	it('returns an empty array for missing tags and non-array content', () => {
		expect(getBinaryNodeChildren(node, 'missing')).toEqual([])
		expect(getBinaryNodeChildren({ tag: 'iq', attrs: {}, content: 'text' }, 'message')).toEqual([])
		expect(getBinaryNodeChildren(undefined, 'message')).toEqual([])
	})
})
