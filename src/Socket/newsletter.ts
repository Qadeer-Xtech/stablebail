import { proto } from '../../WAProto/index.js'
import type { NewsletterCreateResponse, SocketConfig, WAMediaUpload } from '../Types'
import type { NewsletterMetadata, NewsletterUpdate } from '../Types'
import { QueryIds, XWAPaths } from '../Types'
import { generateProfilePicture } from '../Utils/messages-media'
import { getBinaryNodeChild, getBinaryNodeChildren, S_WHATSAPP_NET } from '../WABinary'
import { makeGroupsSocket } from './groups'
import { executeWMexQuery as genericExecuteWMexQuery } from './mex'

const parseNewsletterCreateResponse = (response: NewsletterCreateResponse): NewsletterMetadata => {
	const { id, thread_metadata: thread, viewer_metadata: viewer } = response
	return {
		id: id,
		owner: undefined,
		name: thread.name.text,
		creation_time: parseInt(thread.creation_time, 10),
		description: thread.description.text,
		invite: thread.invite,
		subscribers: parseInt(thread.subscribers_count, 10),
		verification: thread.verification,
		picture: thread.picture
			? {
					id: thread.picture.id,
					directPath: thread.picture.direct_path
				}
			: undefined,
		mute_state: viewer.mute
	}
}

const parseNewsletterMetadata = (result: unknown): NewsletterMetadata | null => {
	if (typeof result !== 'object' || result === null) {
		return null
	}

	if ('id' in result && typeof result.id === 'string') {
		return result as NewsletterMetadata
	}

	if ('result' in result && typeof result.result === 'object' && result.result !== null && 'id' in result.result) {
		return result.result as NewsletterMetadata
	}

	return null
}

export const makeNewsletterSocket = (config: SocketConfig) => {
	const sock = makeGroupsSocket(config)
	const { query, generateMessageTag } = sock

	const executeWMexQuery = <T>(variables: Record<string, unknown>, queryId: string, dataPath: string): Promise<T> => {
		return genericExecuteWMexQuery<T>(variables, queryId, dataPath, query, generateMessageTag)
	}

	const newsletterUpdate = async (jid: string, updates: NewsletterUpdate) => {
		const variables = {
			newsletter_id: jid,
			updates: {
				...updates,
				settings: null
			}
		}
		return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update')
	}

	return {
		...sock,
		newsletterCreate: async (name: string, description?: string): Promise<NewsletterMetadata> => {
			const variables = {
				input: {
					name,
					description: description ?? null
				}
			}
			const rawResponse = await executeWMexQuery<NewsletterCreateResponse>(
				variables,
				QueryIds.CREATE,
				XWAPaths.xwa2_newsletter_create
			)
			return parseNewsletterCreateResponse(rawResponse)
		},

		newsletterUpdate,

		newsletterSubscribers: async (jid: string) => {
			return executeWMexQuery<{ subscribers: number }>(
				{ newsletter_id: jid },
				QueryIds.SUBSCRIBERS,
				XWAPaths.xwa2_newsletter_subscribers
			)
		},

		newsletterSubscribed: async () => {
			return executeWMexQuery({}, QueryIds.SUBSCRIBED, XWAPaths.xwa2_newsletter_subscribed)
		},

		newsletterFetchAllSubscribe: async () => {
			return executeWMexQuery({}, QueryIds.SUBSCRIBED, XWAPaths.xwa2_newsletter_subscribed)
		},

		newsletterMetadata: async (type: 'invite' | 'jid', key: string) => {
			const variables = {
				fetch_creation_time: true,
				fetch_full_image: true,
				fetch_viewer_metadata: true,
				input: {
					key,
					type: type.toUpperCase()
				}
			}
			const result = await executeWMexQuery<unknown>(variables, QueryIds.METADATA, XWAPaths.xwa2_newsletter_metadata)
			return parseNewsletterMetadata(result)
		},

		newsletterFromUrl: async (url: string) => {
			let code = String(url)
			if (code.includes('whatsapp.com/channel/')) {
				code = code.split('whatsapp.com/channel/')[1]!
			} else if (code.includes('wa.me/channel/')) {
				code = code.split('wa.me/channel/')[1]!
			}

			code = code.split('/')[0]!.split('?')[0]!.trim()
			const variables = {
				fetch_creation_time: true,
				fetch_full_image: true,
				fetch_viewer_metadata: true,
				input: {
					key: code,
					type: 'INVITE',
					view_role: 'GUEST'
				}
			}
			const result = await executeWMexQuery<unknown>(variables, QueryIds.METADATA, XWAPaths.xwa2_newsletter_metadata)
			return parseNewsletterMetadata(result)
		},

		newsletterFollow: (jid: string) => {
			return executeWMexQuery({ newsletter_id: jid }, QueryIds.FOLLOW, XWAPaths.xwa2_newsletter_join_v2)
		},

		newsletterUnfollow: (jid: string) => {
			return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNFOLLOW, XWAPaths.xwa2_newsletter_leave_v2)
		},

		newsletterMute: (jid: string) => {
			return executeWMexQuery({ newsletter_id: jid }, QueryIds.MUTE, XWAPaths.xwa2_newsletter_mute_v2)
		},

		newsletterUnmute: (jid: string) => {
			return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNMUTE, XWAPaths.xwa2_newsletter_unmute_v2)
		},

		newsletterUpdateName: async (jid: string, name: string) => {
			return await newsletterUpdate(jid, { name })
		},

		newsletterUpdateDescription: async (jid: string, description: string) => {
			return await newsletterUpdate(jid, { description })
		},

		newsletterUpdatePicture: async (jid: string, content: WAMediaUpload) => {
			const { img } = await generateProfilePicture(content)
			return await newsletterUpdate(jid, { picture: img.toString('base64') })
		},

		newsletterRemovePicture: async (jid: string) => {
			return await newsletterUpdate(jid, { picture: '' })
		},

		newsletterReactionMode: async (jid: string, mode: string) => {
			const variables = {
				newsletter_id: jid,
				updates: {
					settings: {
						reaction_codes: {
							value: mode
						}
					}
				}
			}
			return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update')
		},

		newsletterReactMessage: async (jid: string, serverId: string, reaction?: string) => {
			await query({
				tag: 'message',
				attrs: {
					to: jid,
					...(reaction ? {} : { edit: '7' }),
					type: 'reaction',
					server_id: serverId,
					id: generateMessageTag()
				},
				content: [
					{
						tag: 'reaction',
						attrs: reaction ? { code: reaction } : {}
					}
				]
			})
		},

		newsletterFetchMessages: async (
			...args: [typeOrJid: string, keyOrCount: string | number, count?: number, after?: number, before?: number]
		): Promise<any> => {
			let type: string
			let key: string
			let count: number
			let after: number | undefined
			let before: number | undefined
			if (typeof args[0] === 'string' && args[0].endsWith('@newsletter')) {
				// purana signature: (jid, count, since, after)
				type = 'jid'
				key = args[0]
				count = args[1] as number
				after = args[3]
			} else {
				[type, key, count, after, before] = args as unknown as [string, string, number, number, number]
			}

			const messagesAttrs: Record<string, string> = {
				count: (count ?? 50).toString(),
				type,
				[type === 'jid' ? 'jid' : 'key']: key
			}
			if (after) {
				messagesAttrs.after = after.toString()
			}

			if (before) {
				messagesAttrs.before = before.toString()
			}

			const result = await query({
				tag: 'iq',
				attrs: {
					id: generateMessageTag(),
					type: 'get',
					xmlns: 'newsletter',
					to: S_WHATSAPP_NET
				},
				content: [
					{
						tag: 'messages',
						attrs: messagesAttrs
					}
				]
			})
			const messagesNode = getBinaryNodeChild(result, 'messages')
			if (!messagesNode) {
				return []
			}

			const newsletterJid = messagesNode.attrs.jid || (type === 'jid' ? key : undefined)
			const messages: any[] = []
			for (const child of getBinaryNodeChildren(messagesNode, 'message')) {
				const plaintextNode = getBinaryNodeChild(child, 'plaintext')
				if (!plaintextNode?.content) {
					continue
				}

				try {
					const contentBuf = typeof plaintextNode.content === 'string'
						? Buffer.from(plaintextNode.content, 'binary')
						: Buffer.from(plaintextNode.content as Uint8Array)
					const messageProto = proto.Message.decode(contentBuf).toJSON()
					const fullMessage = proto.WebMessageInfo.fromObject({
						key: {
							remoteJid: newsletterJid,
							id: child.attrs.id || child.attrs.server_id,
							server_id: child.attrs.server_id,
							fromMe: false
						},
						message: messageProto,
						messageTimestamp: child.attrs.t ? +child.attrs.t : undefined
					}).toJSON()
					messages.push(fullMessage)
				} catch (error) {
					config.logger?.error({ error }, 'newsletter message decode fail ho gaya')
				}
			}

			return messages
		},

		newsletterFetchUpdates: async (jid: string, count = 50, after?: number, since?: number) => {
			const result = await query({
				tag: 'iq',
				attrs: {
					id: generateMessageTag(),
					type: 'get',
					xmlns: 'newsletter',
					to: jid
				},
				content: [
					{
						tag: 'message_updates',
						attrs: {
							count: count.toString(),
							after: after?.toString() || '100',
							since: since?.toString() || '0'
						}
					}
				]
			})
			const updatesNode = getBinaryNodeChild(result, 'message_updates')
			const messagesNode = updatesNode ? getBinaryNodeChild(updatesNode, 'messages') : undefined
			if (!messagesNode) {
				return []
			}

			return getBinaryNodeChildren(messagesNode, 'message').map((messageNode) => {
				const viewsNode = getBinaryNodeChild(messageNode, 'views_count')
				const reactionsNode = getBinaryNodeChild(messageNode, 'reactions')
				return {
					server_id: messageNode.attrs.server_id!,
					views: parseInt(viewsNode?.attrs?.count || '0', 10),
					reactions: reactionsNode
						? getBinaryNodeChildren(reactionsNode, 'reaction').map(({ attrs }) => ({
								count: +(attrs.count || 0),
								code: attrs.code!
							}))
						: []
				}
			})
		},

		subscribeNewsletterUpdates: async (jid: string): Promise<{ duration: string } | null> => {
			const result = await query({
				tag: 'iq',
				attrs: {
					id: generateMessageTag(),
					type: 'set',
					xmlns: 'newsletter',
					to: jid
				},
				content: [{ tag: 'live_updates', attrs: {}, content: [] }]
			})
			const liveUpdatesNode = getBinaryNodeChild(result, 'live_updates')
			const duration = liveUpdatesNode?.attrs?.duration
			return duration ? { duration: duration } : null
		},

		newsletterAdminCount: async (jid: string): Promise<number> => {
			const response = await executeWMexQuery<{ admin_count: number }>(
				{ newsletter_id: jid },
				QueryIds.ADMIN_COUNT,
				XWAPaths.xwa2_newsletter_admin_count
			)
			return response.admin_count
		},

		newsletterChangeOwner: async (jid: string, newOwnerJid: string) => {
			await executeWMexQuery(
				{ newsletter_id: jid, user_id: newOwnerJid },
				QueryIds.CHANGE_OWNER,
				XWAPaths.xwa2_newsletter_change_owner
			)
		},

		newsletterDemote: async (jid: string, userJid: string) => {
			await executeWMexQuery({ newsletter_id: jid, user_id: userJid }, QueryIds.DEMOTE, XWAPaths.xwa2_newsletter_demote)
		},

		newsletterDelete: async (jid: string) => {
			await executeWMexQuery({ newsletter_id: jid }, QueryIds.DELETE, XWAPaths.xwa2_newsletter_delete_v2)
		}
	}
}

export type NewsletterSocket = ReturnType<typeof makeNewsletterSocket>
