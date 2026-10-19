import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

async function main() {
    const apiKey =
        process.env.ANTHROPIC_API_KEY?.trim();

    if (!apiKey) {
        throw new Error(
            'Falta ANTHROPIC_API_KEY en backend/.env.',
        );
    }

    const model =
        process.env.ANTHROPIC_MODEL?.trim()
        || 'claude-haiku-5-5';

    const client = new Anthropic({
        apiKey,
        timeout: 20000,
        maxRetries: 0,
    });

    const response = await client.messages.create({
        model,
        max_tokens: 100,
        thinking: {
            type: 'disabled',
        },
        messages: [
            {
                role: 'user',
                content:
                    'Respondé únicamente: Conexión de RouteRobots correcta.',
            },
        ],
    });

    if (response.stop_reason !== 'end_turn') {
        throw new Error(
            'La API no completó la respuesta.',
        );
    }

    const text = response.content
        .filter(
            (block): block is Anthropic.TextBlock =>
                block.type === 'text',
        )
        .map((block) => block.text)
        .join('\n')
        .trim();

    if (!text) {
        throw new Error('La API respondió sin texto.');
    }

    console.log('Modelo:', model);
    console.log('Respuesta:', text);
    console.log('Tokens de entrada:', response.usage.input_tokens);
    console.log('Tokens de salida:', response.usage.output_tokens);
}

main().catch((error: unknown) => {
    if (error instanceof Anthropic.APIError) {
        console.error('No se pudo completar la consulta.');
        console.error('Estado HTTP:', error.status);
    } else {
        console.error(
            error instanceof Error
                ? error.message
                : 'No se pudo verificar la conexión.',
        );
    }

    process.exitCode = 1;
});