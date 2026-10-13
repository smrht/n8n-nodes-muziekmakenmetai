import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class MuziekMakenMetAiApi implements ICredentialType {
	name = 'muziekMakenMetAiApi';

	displayName = 'Muziek Maken Met AI API';

	icon: Icon = {
		light: 'file:muziekmakenmetai.svg',
		dark: 'file:muziekmakenmetai.svg',
	};

	documentationUrl = 'https://muziekmakenmetai.nl/developers/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			required: true,
			default: '',
			description:
				'Create an API key in the MuziekMakenMetAI developer portal: https://muziekmakenmetai.nl/developers/portal/',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://muziekmakenmetai.nl',
			url: '/api/v1/account/',
		},
	};
}
