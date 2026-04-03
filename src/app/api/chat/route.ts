import { streamText } from "ai";
import { NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { canAccessCopilot } from "@/lib/auth";

/**
 * POST /api/chat
 * Streaming chat endpoint for Radar Copilot AI agent
 * Requires War Room tier
 * Routes through Vercel AI Gateway for automatic failover and cost tracking
 *
 * Body:
 * - messages: Array of chat messages
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - authentication required" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if user has War Room tier (required for Copilot)
    if (!canAccessCopilot(user)) {
      return new Response(
        JSON.stringify({
          error: "Forbidden - War Room tier required to access Radar Copilot",
          tier: user.tier,
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request - messages array required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use AI Gateway with provider/model format for automatic routing
    // This routes through Vercel AI Gateway with OIDC auth, failover, and cost tracking
    const model = process.env.AI_MODEL || "anthropic/claude-sonnet-4.6";

    // Prepare system prompt for Radar Copilot
    const systemPrompt = `Você é o Radar Copilot, um assistente IA especializado em leilões industriais no Brasil.

SEU PAPEL:
- Ajudar usuários a encontrar oportunidades em leilões de sucatas, maquinários e equipamentos industriais
- Analisar riscos e retornos potenciais de forma clara e objetiva
- Buscar lotes com base em critérios do usuário (categoria, localização, faixa de preço, nível de risco)
- Configurar alertas automáticos quando solicitado
- Salvar lotes na watchlist do usuário quando solicitado

CAPACIDADES:
- Busca semântica no banco de lotes
- Análise de editais (PDFs) para extração de informações importantes
- Cálculo de ROI projetado e identificação de riscos ocultos
- Configuração de alertas personalizados

TOM DE VOZ:
- Profissional, mas acessível e amigável
- Direto e conciso nas respostas
- Sempre em português brasileiro
- Use formatação markdown para respostas longas

RESTRIÇÕES:
- Nunca invente dados sobre lotes - se não encontrar no banco, diga que não encontrou
- Sempre avise sobre riscos potenciais
- Para dados financeiros ou de investimento, sugira consulta com especialista antes de decidir

Exemplos de comandos que você pode executar:
- Busca: "Procure por esteiras catracas em São Paulo"
- Análise: "Analise o risco deste lote de maquinário"
- Alerta: "Crie um alerta para caminhões no Rio Grande do Sul abaixo de R$ 50.000"
- Watchlist: "Salve este lote na minha watchlist"

IMPORTANTE: Quando precisar buscar dados do banco de lotes ou executar ações, retorne um JSON estruturado desta forma:
\`\`\`json
{
  "action": "search_lots",
  "criteria": { "category": "Maquinário", "state": "SP" }
}
\`\`\`

O frontend irá processar essa ação e fazer a chamada API apropriada.`;

    // Add system message to the beginning
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Stream the response using AI SDK with AI Gateway
    const result = await streamText({
      model,
      messages: apiMessages,
      temperature: 0.7,
      providerOptions: {
        // Track usage per user for cost attribution
        gateway: {
          user: user.id,
          tags: ['feature:radar-copilot', `tier:${user.tier}`],
        },
      },
    });

    // Convert to UI Message Stream Response (SSE format for useChat with AI Elements)
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
