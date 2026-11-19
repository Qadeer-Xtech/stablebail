import { jest } from '@jest/globals'
import { checkStatusWA, parsePhoneNumberParts } from '../../Utils/check-status'

describe('check-status utility', () => {
	const realFetch = global.fetch
	let fetchMock: ReturnType<typeof jest.fn>

	const jsonResponse = (ok: boolean, body: unknown) => ({
		ok,
		json: async () => body
	})

	beforeEach(() => {
		fetchMock = jest.fn()
		global.fetch = fetchMock as any
	})

	afterAll(() => {
		global.fetch = realFetch
	})

	it('parses international numbers by longest country-code prefix', () => {
		expect(parsePhoneNumberParts('923151105391')).toEqual({
			countryCode: '92',
			nationalNumber: '3151105391'
		})
		expect(parsePhoneNumberParts('14155552671')).toEqual({
			countryCode: '1',
			nationalNumber: '4155552671'
		})
		expect(parsePhoneNumberParts('971501234567')).toEqual({
			countryCode: '971',
			nationalNumber: '501234567'
		})
	})

	it('reports active when the exist endpoint answers ok', async () => {
		fetchMock.mockResolvedValue(jsonResponse(true, { status: 'ok' }))

		const result = await checkStatusWA('923151105391')
		expect(result.status).toBe('active')
		expect(result.isBanned).toBe(false)
		expect(result.number).toBe('+923151105391')
		expect(String(fetchMock.mock.calls[0][0])).toContain('v.whatsapp.net/v2/exist')
	})

	it('reports banned with appeal details when an appeal token comes back', async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (String(url).includes('v.whatsapp.net')) {
				return jsonResponse(false, { appeal_token: 'tok-123', violation_type: 7 })
			}

			return jsonResponse(true, {
				data: {
					whatsapp_support_ban_appeal_status: {
						status: 'BANNED',
						ban_time: 1700000000,
						appeal_creation_time: 1700000100
					}
				}
			})
		})

		const result = await checkStatusWA('+92 315 1105391', { appealAccessToken: 'test-token' })
		expect(result.status).toBe('banned')
		expect(result.isBanned).toBe(true)
		expect(result.banInfo?.appealToken).toBe('tok-123')
		expect(result.banInfo?.violationType).toBe(7)
		expect(result.banInfo?.banType).toBe('permanent')
		expect(result.banInfo?.canAppeal).toBe(false)
		expect(result.banInfo?.banDate).toBe(new Date(1700000000 * 1000).toISOString())
	})

	it('reports banned without appeal details when no access token is given', async () => {
		fetchMock.mockResolvedValue(jsonResponse(false, { appeal_token: 'tok-9', violation_type: 3 }))

		const result = await checkStatusWA('14155552671')
		expect(result.status).toBe('banned')
		expect(result.banInfo?.banType).toBe('temporary')
		expect(result.banInfo?.canAppeal).toBe(true)
		expect(result.banInfo?.appealStatus).toBeNull()
	})

	it('reports blocked when the official app is demanded', async () => {
		fetchMock.mockResolvedValue(jsonResponse(false, { custom_block_screen: { title: 'x' } }))

		const result = await checkStatusWA('442071234567')
		expect(result.status).toBe('blocked')
		expect(result.isNeedOfficialWa).toBe(true)
	})

	it('reports rate_limited on temporarily_unavailable', async () => {
		fetchMock.mockResolvedValue(jsonResponse(false, { reason: 'temporarily_unavailable' }))

		const result = await checkStatusWA('442071234567')
		expect(result.status).toBe('rate_limited')
	})

	it('reports error when the request itself fails', async () => {
		fetchMock.mockRejectedValue(new Error('network down'))

		const result = await checkStatusWA('442071234567')
		expect(result.status).toBe('error')
	})

	it('throws when no number is provided', async () => {
		await expect(checkStatusWA('')).rejects.toThrow('please provide a phone number')
	})
})
