import 'dotenv/config';
import OpenAI from 'openai';

async function main() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
        throw new Error('Falta OPENAI_API_KEY en backend/.env.');
    }

    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-6-luna';

    const client = new OpenAI({
        apiKey,
        timeout: 20000,
        maxRetries: 0,
    });

    const response = await client.responses.create({
        model,
        input: 'Respondé únicamente: Conexión de RouteRobots correcta.',
        reasoning: {
            effort: 'none',
        },
        max_output_tokens: 100,
        store: false,
    });

    const text = response.output_text.trim();

    if (!text) {
        throw new Error('La API respondió sin texto.');
    }

    console.log('Modelo:', model);
    console.log('Respuesta:', text);
}

main().catch((error: unknown) => {
    if (error instanceof OpenAI.APIError) {
        console.error('No se pudo completar la consulta.');
        console.error('Estado HTTP:', error.status);
        console.error('Código:', error.code ?? 'Sin código');
    } else {
        console.error(
            error instanceof Error
                ? error.message
                : 'No se pudo verificar la conexión.',
        );
    }

    process.exitCode = 1;
});