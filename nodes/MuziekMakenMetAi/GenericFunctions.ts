import type {
	ICredentialDataDecryptedObject,
	IDataObject,
	INode,
	IHttpRequestOptions,
	IHttpRequestMethods,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export const API_BASE_URL = 'https://muziekmakenmetai.nl/api/v1';

interface MmaiProblem {
	error?: { code?: string; message?: string };
}

type ApiContext = {
	getCredentials: (type: string) => Promise<ICredentialDataDecryptedObject>;
	getNode: () => INode;
	helpers: {
		httpRequest: (options: IHttpRequestOptions) => Promise<unknown>;
	};
};

export async function mmmaiApiRequest(
	context: ApiContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	extraHeaders?: IDataObject,
): Promise<IDataObject> {
	const credentials = (await context.getCredentials('muziekMakenMetAiApi')) as ICredentialDataDecryptedObject;
	const apiKey = credentials.apiKey as string | undefined;
	if (!apiKey) {
		throw new NodeOperationError(context.getNode(), 'No API key set on the Muziek maken met AI API credential.');
	}

	const options: IHttpRequestOptions = {
		method,
		url: `${API_BASE_URL}${path}`,
		json: true,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			...(extraHeaders ?? {}),
		},
	};
	if (body !== undefined) {
		options.body = body;
	}

	try {
		return (await context.helpers.httpRequest(options)) as IDataObject;
	} catch (error) {
		const problem = (error as { error?: MmaiProblem })?.error?.error;
		if (problem?.message) {
			throw new NodeApiError(context.getNode(), error as JsonObject, {
				message: problem.message,
				description: problem.code ? `API error code: ${problem.code}` : undefined,
			});
		}
		throw new NodeApiError(context.getNode(), error as JsonObject);
	}
}
