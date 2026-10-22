import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IHookFunctions,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { mmmaiApiRequest } from '../MuziekMakenMetAi/GenericFunctions';
import { verifyWebhookSignature } from './webhook-signature';

const WEBHOOK_PATH = 'song-finished';

export class MuziekMakenMetAiTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Muziek maken met AI Trigger',
		name: 'muziekMakenMetAiTrigger',
		icon: { light: 'file:muziekmakenmetaitrigger.svg', dark: 'file:muziekmakenmetaitrigger.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: 'Runs when a song generation finishes',
		description: 'Starts the workflow when a song generation finishes',
		defaults: {
			name: 'Muziek maken met AI Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'muziekMakenMetAiApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: WEBHOOK_PATH,
			},
		],
		properties: [
			{
				displayName:
					'Emits one item when a song generation finishes (music.generation.succeeded or music.generation.failed). Your API key has a single webhook: activating this node replaces any earlier webhook URL. Deactivating the workflow unregisters it again.',
				name: 'webhookNotice',
				type: 'notice',
				default: '',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				if (this.getMode() === 'manual') {
					return true;
				}
				const staticData = this.getWorkflowStaticData('node');
				return (
					Boolean(staticData.webhookSigningSecret) && staticData.webhookUrl === this.getNodeWebhookUrl('default')
				);
			},

			async create(this: IHookFunctions): Promise<boolean> {
				if (this.getMode() === 'manual') {
					return true;
				}
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) {
					throw new NodeOperationError(this.getNode(), 'Could not determine the webhook URL of this node.');
				}
				const response = (await mmmaiApiRequest(this, 'PUT', '/webhook/', { url: webhookUrl })) as IDataObject;
				const signingSecret = response.signing_secret;
				if (typeof signingSecret !== 'string' || !signingSecret) {
					throw new NodeOperationError(
						this.getNode(),
						'The API did not return a signing secret for the webhook. Cannot verify incoming events.',
					);
				}
				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookSigningSecret = signingSecret;
				staticData.webhookUrl = webhookUrl;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				if (this.getMode() === 'manual') {
					return true;
				}
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.webhookUrl) {
					delete staticData.webhookSigningSecret;
					return true;
				}
				await mmmaiApiRequest(this, 'PUT', '/webhook/', { url: '' });
				delete staticData.webhookUrl;
				delete staticData.webhookSigningSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const staticData = this.getWorkflowStaticData('node');
		const signingSecret = staticData.webhookSigningSecret as string | undefined;
		if (!signingSecret) {
			throw new NodeOperationError(
				this.getNode(),
				'No signing secret stored for this workflow. Activate the workflow once so the node can register the webhook and store the signing secret.',
			);
		}

		const headers = this.getHeaderData();
		const request = this.getRequestObject() as unknown as { rawBody?: Buffer };
		const rawBody = request.rawBody;
		if (!rawBody) {
			throw new NodeOperationError(this.getNode(), 'Raw request body is missing; cannot verify the signature.');
		}

		if (!verifyWebhookSignature(signingSecret, headers['x-mmmai-timestamp'], headers['x-mmmai-signature'], rawBody)) {
			throw new NodeOperationError(
				this.getNode(),
				'Invalid webhook signature. The event was not sent by MuziekMakenMetAI with the signing secret stored at activation.',
			);
		}

		const body = this.getBodyData();
		const data = (body.data ?? {}) as IDataObject;
		const eventId = String(headers['x-mmmai-event'] ?? body.id ?? '');
		const eventType = String(body.type ?? '');

		return {
			workflowData: [
				[
					{
						json: {
							...data,
							event_id: eventId,
							event_type: eventType,
						},
					},
				],
			],
		};
	}
}
