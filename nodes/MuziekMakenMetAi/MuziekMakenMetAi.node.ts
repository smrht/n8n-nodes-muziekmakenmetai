import { randomUUID } from 'node:crypto';
import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError, sleep } from 'n8n-workflow';

import { mmmaiApiRequest } from './GenericFunctions';

const TERMINAL_STATUSES = new Set(['succeeded', 'failed']);
const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

export class MuziekMakenMetAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Muziek maken met AI',
		name: 'muziekMakenMetAi',
		icon: { light: 'file:muziekmakenmetai.svg', dark: 'file:muziekmakenmetai.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Generate songs and manage your account via the MuziekMakenMetAI API',
		defaults: {
			name: 'Muziek maken met AI',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'muziekMakenMetAiApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
					},
					{
						name: 'Song',
						value: 'song',
					},
				],
				default: 'song',
				description: 'The resource to work with',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['song'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						description:
							'Start a song generation (costs 1 credit)',
						action: 'Generate a song',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a generation, its status and its audio files',
						action: 'Get a song',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['account'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get the credit balance and rate limits',
						action: 'Get an account',
					},
				],
				default: 'get',
			},

			/* ---------------------------------- Song: create --------------------------------- */
			{
				displayName: 'Prompt',
				name: 'prompt',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['song'],
						operation: ['create'],
					},
				},
				typeOptions: {
					rows: 4,
				},
				default: '',
				description:
					'Music description in standard mode (max 500 characters) or the full song lyrics in custom mode (max 5,000 characters)',
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['song'],
						operation: ['create'],
					},
				},
				default: true,
				description:
					'Whether to poll the generation every 10 seconds until it succeeds or fails (up to 6 minutes) and return the final result with the audio URLs. When off, the node returns immediately with status "queued". If the song is still processing after 6 minutes, the latest known status is returned and you can fetch it again with Song > Get.',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				displayOptions: {
					show: {
						resource: ['song'],
						operation: ['create'],
					},
				},
				default: {},
				options: [
					{
						displayName: 'Audio Weight',
						name: 'audioWeight',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						default: 0.65,
						description:
							'Weight of linked persona audio (0-1). Only used in custom mode with a persona.',
					},
					{
						displayName: 'Creativity',
						name: 'creativity',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						default: 0.5,
						description: 'How much variation to allow (0-1). Only used in custom mode.',
					},
					{
						displayName: 'Custom Mode',
						name: 'customMode',
						type: 'boolean',
						default: false,
						description:
							'Whether the prompt is the full song lyrics (Style becomes required) or a music description',
					},
					{
						displayName: 'Duration (Seconds)',
						name: 'durationSeconds',
						type: 'number',
						typeOptions: {
							minValue: 10,
							maxValue: 360,
							numberPrecision: 0,
						},
						default: 240,
						description:
							'Track length in seconds (10-360). Only with Music V1 Pro or a Music V2 model in custom mode.',
					},
					{
						displayName: 'Instrumental',
						name: 'instrumental',
						type: 'boolean',
						default: false,
						description: 'Whether to generate a track without vocals',
					},
					{
						displayName: 'Language',
						name: 'language',
						type: 'string',
						default: 'Nederlands',
						description:
							'Full language name of the vocals, e.g. Nederlands, Engels or Duits. Other languages are allowed. Defaults to "Nederlands". Max 40 characters.',
					},
					{
						displayName: 'Model',
						name: 'model',
						type: 'options',
						options: [
							{
								name: 'Music V1',
								value: 'music-v1',
								description: 'V5 generation, previous model',
							},
							{
								name: 'Music V1 Pro',
								value: 'music-v1-pro',
								description: 'V5.5 generation, previous model with duration control',
							},
							{
								name: 'Music V2',
								value: 'music-v2',
								description: 'Latest model and recommended: more natural vocals, richer detail',
							},
							{
								name: 'Music V2 Mini',
								value: 'music-v2-mini',
								description: 'Faster version of Music V2',
							},
							{
								name: 'Music V2 Wild',
								value: 'music-v2-wild',
								description: 'More adventurous version of Music V2',
							},
						],
						default: 'music-v1',
						description: 'Every model costs 1 credit per generation',
					},
					{
						displayName: 'Negative Tags',
						name: 'negativeTags',
						type: 'string',
						default: '',
						description:
							'Comma-separated tags to avoid, e.g. "heavy metal, distortion". Only used in custom mode. Combined max 300 characters.',
					},
					{
						displayName: 'Persona ID',
						name: 'personaId',
						type: 'string',
						default: '',
						description: 'ID of one of your own personas. Only used in custom mode.',
					},
					{
						displayName: 'Persona Type',
						name: 'personaType',
						type: 'options',
						options: [
							{
								name: 'Style',
								value: 'style',
								description: 'Use the persona as a style reference',
							},
							{
								name: 'Voice',
								value: 'voice',
								description: 'Use the persona voice. Only with Music V2 models.',
							},
						],
						default: 'style',
						description: 'How the Persona ID is applied. Only used in custom mode.',
					},
					{
						displayName: 'Style',
						name: 'style',
						type: 'string',
						typeOptions: {
							rows: 2,
						},
						default: '',
						description:
							'Genre, instruments, tempo and mood. Required in custom mode. Max 1,000 characters.',
					},
					{
						displayName: 'Style Weight',
						name: 'styleWeight',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						default: 0.6,
						description: 'How strictly the generation follows the style (0-1). Only used in custom mode.',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'Track title. Max 80 characters. Defaults to a generated title.',
					},
					{
						displayName: 'Variety',
						name: 'variety',
						type: 'options',
						options: [
							{
								name: 'Strict',
								value: 0,
								description: 'Follow the prompt and style strictly',
							},
							{
								name: 'Balanced (Default)',
								value: 1,
								description: 'Standard balance',
							},
							{
								name: 'More Variation',
								value: 2,
								description: 'A bit more variation',
							},
							{
								name: 'Looser',
								value: 3,
								description: 'Clearly looser with the input',
							},
							{
								name: 'Maximum Surprise',
								value: 4,
								description: 'As surprising as possible',
							},
						],
						default: 1,
						description: 'How much the generation may deviate from the input. Only used in custom mode with Music V2 models.',
					},
					{
						displayName: 'Vocal Gender',
						name: 'vocalGender',
						type: 'options',
						options: [
							{
								name: 'Female',
								value: 'female',
							},
							{
								name: 'Male',
								value: 'male',
							},
						],
						default: 'female',
						description: 'Gender of the vocals. Only used in custom mode.',
					},
				],
			},

			/* ----------------------------------- Song: get ----------------------------------- */
			{
				displayName: 'Generation ID',
				name: 'songId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['song'],
						operation: ['get'],
					},
				},
				default: '',
				description: 'ID of the generation, as returned by Create or the trigger node',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const items = this.getInputData();
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				if (resource === 'account' && operation === 'get') {
					const account = await mmmaiApiRequest(this, 'GET', '/account/');
					returnData.push({ json: account, pairedItem: { item: itemIndex } });
					continue;
				}

				if (resource === 'song' && operation === 'get') {
					const songId = (this.getNodeParameter('songId', itemIndex) as string).trim();
					if (!songId) {
						throw new NodeOperationError(this.getNode(), 'Generation ID is empty.', { itemIndex });
					}
					const generation = await mmmaiApiRequest(this, 'GET', `/music/generations/${encodeURIComponent(songId)}/`);
					returnData.push({ json: generation, pairedItem: { item: itemIndex } });
					continue;
				}

				if (resource === 'song' && operation === 'create') {
					const generation = await createGeneration(this, itemIndex);
					returnData.push({ json: generation, pairedItem: { item: itemIndex } });
					continue;
				}

				throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, { itemIndex });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
					continue;
				}
				throw error instanceof NodeApiError || error instanceof NodeOperationError
					? error
					: new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		return [returnData];
	}
}

async function createGeneration(context: IExecuteFunctions, itemIndex: number): Promise<IDataObject> {
		const prompt = (context.getNodeParameter('prompt', itemIndex, '') as string).trim();
		if (!prompt) {
			throw new NodeOperationError(context.getNode(), 'Prompt is required.', { itemIndex });
		}
		const waitForCompletion = context.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;
		const additional = context.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
		const customMode = Boolean(additional.customMode);

		const maxPromptLength = customMode ? 5_000 : 500;
		if (prompt.length > maxPromptLength) {
			throw new NodeOperationError(
				context.getNode(),
				customMode
					? `Prompt is longer than ${maxPromptLength} characters.`
					: 'Prompt is longer than 500 characters. Turn on Custom Mode to use full song lyrics (max 5,000 characters).',
				{ itemIndex },
			);
		}

		const body: IDataObject = {
			model: additional.model ?? 'music-v1',
			prompt,
		};

		if (customMode) {
			body.custom_mode = true;
			const style = String(additional.style ?? '').trim();
			if (!style) {
				throw new NodeOperationError(
					context.getNode(),
					'Style is required in custom mode. Describe the genre, instruments, tempo and mood.',
					{ itemIndex },
				);
			}
		}

		for (const [field, apiField, maxLength] of [
			['style', 'style', 1_000],
			['title', 'title', 80],
			['language', 'language', 40],
		] as const) {
			const value = String(additional[field] ?? '').trim();
			if (!value) {
				continue;
			}
			if (value.length > maxLength) {
				throw new NodeOperationError(context.getNode(), `${apiField} is longer than ${maxLength} characters.`, {
					itemIndex,
				});
			}
			body[apiField] = value;
		}

		if (additional.instrumental !== undefined) {
			body.instrumental = Boolean(additional.instrumental);
		}

		const customOnlyFields: Array<[string, string]> = [
			['vocalGender', 'vocal_gender'],
			['styleWeight', 'style_weight'],
			['creativity', 'creativity'],
			['audioWeight', 'audio_weight'],
			['durationSeconds', 'duration_seconds'],
			['variety', 'variety'],
			['negativeTags', 'negative_tags'],
			['personaId', 'persona_id'],
			['personaType', 'persona_type'],
		];
		for (const [field, label] of customOnlyFields) {
			const value = additional[field];
			let isSet = value !== undefined && value !== '';
			if (field === 'variety' && Number(value) === 1) {
				isSet = false;
			}
			if (field === 'personaType' && !String(additional.personaId ?? '').trim()) {
				isSet = false;
			}
			if (isSet && !customMode) {
				throw new NodeOperationError(
					context.getNode(),
					`${label.replace(/_/g, ' ')} only applies in custom mode. Turn on Custom Mode or remove the field.`,
					{ itemIndex },
				);
			}
		}

		if (customMode) {
			if (additional.vocalGender) {
				body.vocal_gender = additional.vocalGender;
			}
			for (const [field, apiField] of [
				['styleWeight', 'style_weight'],
				['creativity', 'creativity'],
				['audioWeight', 'audio_weight'],
			] as const) {
				if (additional[field] !== undefined && additional[field] !== '') {
					body[apiField] = Number(additional[field]);
				}
			}
			if (additional.durationSeconds !== undefined && additional.durationSeconds !== '') {
				body.duration_seconds = Math.round(Number(additional.durationSeconds));
			}
			if (additional.variety !== undefined && additional.variety !== '') {
				body.variety = Math.round(Number(additional.variety));
			}
			const negativeTags = String(additional.negativeTags ?? '')
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean);
			if (negativeTags.length) {
				body.negative_tags = negativeTags;
			}
			const personaId = String(additional.personaId ?? '').trim();
			if (personaId) {
				body.persona_id = personaId;
				body.persona_type = additional.personaType ?? 'style';
			}
		}

		let generation = await mmmaiApiRequest(context, 'POST', '/music/generations/', body, {
			'Idempotency-Key': randomUUID(),
		});

		if (waitForCompletion && !TERMINAL_STATUSES.has(generation.status as string)) {
			const deadline = Date.now() + POLL_TIMEOUT_MS;
			while (!TERMINAL_STATUSES.has(generation.status as string) && Date.now() < deadline) {
				await sleep(POLL_INTERVAL_MS);
				generation = await mmmaiApiRequest(
					context,
					'GET',
					`/music/generations/${encodeURIComponent(generation.id as string)}/`,
				);
			}
		}

		return generation;
}
