import { extractMessageContent, normalizeMessageContent } from '../../Utils/messages'

describe('view-once message normalization', () => {
	const media = { videoMessage: { url: 'https://example.invalid/view-once.mp4', mediaKey: Buffer.alloc(32, 1) } }
	const wrappers = [
		{ viewOnceMessage: { message: media } },
		{ viewOnceMessageV2: { message: media } },
		{ viewOnceMessageV2Extension: { message: media } },
		{ ephemeralMessage: { message: { viewOnceMessageV2: { message: media } } } }
	]
	it.each(wrappers.map((wrapper, index) => [index, wrapper]))(
		'unwraps supported wrapper %s without changing its media content',
		(_index, wrapper) => {
			expect(normalizeMessageContent(wrapper as never)).toEqual(media)
			expect(extractMessageContent(wrapper as never)).toEqual(media)
		}
	)
})
