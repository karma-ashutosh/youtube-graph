# AI Provider Configuration Guide

This project supports two AI providers for concept normalization. You can choose between Claude (Anthropic) or Gemini (Google) based on your preferences.

## Quick Setup

### Option 1: Use Gemini (Recommended - Free Tier Available)

1. Get your API key from [Google AI Studio](https://ai.google.dev/)
2. Add to your `.env.local`:
   ```env
   AI_PROVIDER=gemini
   GOOGLE_API_KEY=your_api_key_here
   ```

### Option 2: Use Claude (Anthropic)

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. Add to your `.env.local`:
   ```env
   AI_PROVIDER=claude
   ANTHROPIC_API_KEY=your_api_key_here
   ```

## Provider Comparison

| Feature | Gemini (Google) | Claude (Anthropic) |
|---------|----------------|-------------------|
| **Model Used** | gemini-1.5-flash | claude-3-5-haiku-20241022 |
| **Free Tier** | Yes, generous limits | Limited free credits |
| **Speed** | Very fast | Very fast |
| **Cost** | Free up to 15 RPM / 1M TPM / 1500 RPD | $0.80 per million input tokens |
| **Quality** | Excellent | Excellent |
| **Best For** | Development, testing, cost-conscious projects | Production, mission-critical applications |

## Configuration Details

### Gemini Configuration

The system uses the Gemini 1.5 Flash model with these settings:
- **Temperature**: 0.1 (for consistency)
- **Response Format**: JSON mode
- **Rate Limits**: Respects Google AI's free tier limits

### Claude Configuration

The system uses Claude 3.5 Haiku with these settings:
- **Temperature**: 0.1 (for consistency)
- **Max Tokens**: 1024
- **Model**: claude-3-5-haiku-20241022 (optimized for speed and cost)

## How Concept Normalization Works

Regardless of which provider you choose, the system:

1. **Retrieves existing concepts** from the Neo4j database
2. **Sends context to AI** with the top 50 most mentioned concepts
3. **AI analyzes** the new concept name against existing ones
4. **Returns decision**:
   - If matching: Returns existing concept ID and canonical name
   - If new: Creates a clear, concise canonical name (2-4 words)
5. **Validates response** using Zod schemas
6. **Falls back** to simple slug creation if AI fails

## Example Prompt

The AI receives a prompt like this:

```
You are normalizing concept names for a knowledge graph.

EXISTING CONCEPTS (top 50 for context):
- Product-Market Fit (aliases: PMF, Product Market Fit)
- Marketing Tactics (aliases: Marketing Tactic Selection)
- ...

NEW CONCEPT TO NORMALIZE:
"PMF"

TASK:
1. Check if this matches any existing concept (including aliases)
2. If YES: Return the existing canonical_name and concept_id
3. If NO: Create a new canonical_name (2-4 words, clear, concise)

OUTPUT (JSON only):
{
  "canonical_name": "Product-Market Fit",
  "concept_id": "product_market_fit",
  "is_new": false,
  "matched_existing_id": "product_market_fit",
  "confidence": "high"
}
```

## Switching Providers

You can switch providers at any time by changing the `AI_PROVIDER` environment variable:

```env
# Switch to Claude
AI_PROVIDER=claude

# Switch to Gemini
AI_PROVIDER=gemini
```

**Note**: Make sure you have the corresponding API key configured.

## Troubleshooting

### "API key not configured" Error

**Gemini**:
- Ensure `GOOGLE_API_KEY` is set in `.env.local`
- Verify the key is valid at [Google AI Studio](https://ai.google.dev/)

**Claude**:
- Ensure `ANTHROPIC_API_KEY` is set in `.env.local`
- Verify the key starts with `sk-ant-`
- Check your credits at [Anthropic Console](https://console.anthropic.com/)

### Rate Limiting

If you hit rate limits:
- **Gemini**: Free tier has 15 requests per minute
- **Claude**: Depends on your tier (check Anthropic Console)
- The system will fall back to simple normalization if AI fails

### Response Validation Errors

If you see JSON parsing errors:
- Both providers are configured to return valid JSON
- The system includes fallback parsing for markdown code blocks
- If issues persist, check the console logs for the raw response

## Cost Estimation

### For 1000 Segments (approximately 5000 concept normalizations)

**Gemini (Free Tier)**:
- Cost: $0 (within free tier limits)
- Time: ~5-10 minutes

**Claude**:
- Input tokens: ~500K tokens (includes context)
- Output tokens: ~50K tokens
- Cost: ~$0.40 - $0.50
- Time: ~5-10 minutes

## Best Practices

1. **Development**: Use Gemini for free, fast iterations
2. **Production**: Consider Claude for mission-critical applications if budget allows
3. **Testing**: Both providers produce excellent results - test with your data
4. **Monitoring**: Check console logs to see normalization decisions
5. **Caching**: The system caches concepts to minimize API calls

## Support

- Gemini Issues: https://ai.google.dev/docs
- Claude Issues: https://docs.anthropic.com/
- Project Issues: See main README.md
