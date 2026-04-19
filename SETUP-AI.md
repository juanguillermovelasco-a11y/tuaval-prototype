# Tu Aval — Onboarding con Claude AI

El onboarding ahora usa Claude vía **Vercel AI Gateway**. Sigue estos pasos para activarlo:

## 1. Variables de entorno en Vercel

En el dashboard de tu proyecto Vercel → **Settings → Environment Variables** añade:

| Variable | Valor |
|---|---|
| `AI_GATEWAY_API_KEY` | Tu API key de Vercel AI Gateway |

Si prefieres llamar directo a Anthropic sin Gateway, añade:

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | Tu key de Anthropic (sk-ant-...) |

> **Nota**: Vercel AI SDK v4 detecta automáticamente `AI_GATEWAY_API_KEY` y rutea `anthropic/claude-...` por el Gateway. Si no está, cae al proveedor directo con `ANTHROPIC_API_KEY`.

## 2. Deploy

```bash
vercel deploy --prod
```

Vercel detectará automáticamente:
- `package.json` → instala `@ai-sdk/anthropic` y `ai`
- `api/chat.js` → serverless function en `/api/chat`
- HTML estáticos → servidos como static

## 3. Testear localmente

```bash
vercel dev
```

Visita `http://localhost:3000/portal/estudiante/onboarding/chat.html` y dale "Comenzar".

## Modelo

Actualmente: `anthropic/claude-sonnet-4-5` (configurable en `api/chat.js`).

## Flujo

1. Usuario escribe respuesta → POST a `/api/chat` con `{ role, messages }`
2. Backend envía mensajes a Claude con `system` prompt específico del rol
3. Streaming de respuesta al frontend
4. Cuando Claude ha recopilado todos los datos, incluye marcador:
   ```
   [ONBOARDING_COMPLETE]
   {"name":"...","country":"...","age":...}
   ```
5. Frontend detecta el marcador, extrae el JSON, guarda en localStorage y redirige al dashboard.

## System prompts

Personaliza el comportamiento en `api/chat.js` → constante `SYSTEM_PROMPTS`:
- `student` — recopila nombre, país, edad, universidad, ciudad, presupuesto, fondos, fecha
- `landlord` — recopila nombre, propiedades, ciudades, rentas, inquilinos, historial
- `investor` — recopila nombre, país fiscal, capital, horizonte, experiencia, riesgo
