# Clawra

Add selfie generation superpowers to your OpenClaw agent using local Stable Diffusion.

## Quick Start

```bash
npx clawra@latest
```

This will:
1. Check OpenClaw is installed
2. Verify local Stable Diffusion WebUI setup
3. Install the skill to `~/.openclaw/skills/clawra-selfie-sd/`
4. Configure OpenClaw to use the skill
5. Add selfie capabilities to your agent's SOUL.md

## What It Does

Clawra Selfie enables your OpenClaw agent to:
- **Generate selfies** using a consistent reference image
- **Send photos** across all messaging platforms (Discord, Telegram, WhatsApp, etc.)
- **Respond visually** to "what are you doing?" and "send a pic" requests

## Prerequisites

- [OpenClaw](https://github.com/openclaw/openclaw) installed and configured
- [Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) running locally
- ControlNet extension with `ip-adapter-faceid-plusv2_sd15` model

### Stable Diffusion Requirements

Ensure Stable Diffusion WebUI is running at `http://127.0.0.1:7860` with:
- Realistic Vision V6.0 B1 checkpoint
- ControlNet extension installed
- IP-Adapter FaceID Plus V2 model

## Manual Installation

If you prefer manual setup:

### 1. Clone the Skill

```bash
git clone https://github.com/easyeye163/clawra-selfie-sd ~/.openclaw/skills/clawra-selfie-sd
```

### 2. Configure OpenClaw

Add to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "clawra-selfie-sd": {
        "enabled": true
      }
    }
  }
}
```

### 3. Update SOUL.md

Add the selfie persona to `~/.openclaw/workspace/SOUL.md`:

```markdown
## Clawra Selfie SD Capability

You have a physical appearance and can take selfies!
When users ask for pictures, use the clawra-selfie-sd skill.
```

## Usage Examples

Once installed, your agent responds to:

```
"Send me a selfie"
"Send a pic wearing a cowboy hat"
"What are you doing right now?"
"Show me you at a coffee shop"
"换成红色衣服"
```

## Reference Image

The skill uses a local reference image:

```
assets/clawra.png
```

This ensures consistent appearance across all generated images.

## Technical Details

- **Image Generation**: Local Stable Diffusion via SD WebUI API
- **Messaging**: OpenClaw Gateway API
- **Supported Platforms**: Discord, Telegram, WhatsApp, Slack, Signal, MS Teams, Feishu
- **ControlNet Model**: ip-adapter-faceid-plusv2_sd15
- **SD Checkpoint**: realisticVisionV60B1

## Command Line Usage

Generate images directly using the TypeScript script:

```bash
npx ts-node scripts/txt2img.ts <prompt> [seed]
```

### Examples

```bash
# Basic usage
npx ts-node scripts/txt2img.ts "换成红色衣服"

# With custom seed
npx ts-node scripts/txt2img.ts "换成红色衣服" 12345
```

## Project Structure

```
clawra/
├── bin/
│   └── cli.js           # npx installer
├── skill/
│   ├── SKILL.md         # Skill definition
│   ├── scripts/         # Generation scripts
│   └── assets/          # Reference image
├── templates/
│   └── soul-injection.md # Persona template
├── scripts/
│   └── txt2img.ts       # CLI image generation script
├── assets/
│   └── clawra.png       # Reference image
└── package.json
```

## Configuration

### OpenClaw Gateway Token

Generate a gateway token:

```bash
openclaw doctor --generate-gateway-token
```

### Supported Platforms

| Platform | Channel Format | Example |
|----------|----------------|---------|
| Discord | `#channel-name` or channel ID | `#general`, `123456789` |
| Telegram | `@username` or chat ID | `@mychannel`, `-100123456` |
| WhatsApp | Phone number (JID format) | `1234567890@s.whatsapp.net` |
| Slack | `#channel-name` | `#random` |
| Signal | Phone number | `+1234567890` |
| MS Teams | Channel reference | (varies) |
| Feishu | Chat ID or conversation ID | `ou_xxxxx`, `oc_xxxxx` |

## Error Handling

- **Stable Diffusion not running**: Ensure SD WebUI is accessible at `http://127.0.0.1:7860`
- **ControlNet model missing**: Install `ip-adapter-faceid-plusv2_sd15` via SD WebUI
- **OpenClaw send failed**: Verify gateway is running and channel exists
- **Image generation failed**: Check prompt content and SD WebUI logs

## Tips

1. **Outfit prompts**: "wearing a santa hat", "in a business suit", "wearing a summer dress"
2. **Location prompts**: "a cozy cafe with warm lighting", "a sunny beach at sunset"
3. **Batch sending**: Generate once, send to multiple channels
4. **Seeds**: Use the same seed for reproducible results

## License

MIT
