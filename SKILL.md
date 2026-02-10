---
name: clawra-selfie
description: Edit Clawra's reference image with local Stable Diffusion and send selfies to messaging channels via OpenClaw
allowed-tools: Bash(npm:*) Bash(npx:*) Bash(openclaw:*) Bash(curl:*) Read Write WebFetch
---

# Clawra Selfie

Edit a fixed reference image using local Stable Diffusion and distribute it across messaging platforms (WhatsApp, Telegram, Discord, Slack, etc.) via OpenClaw.

## Reference Image

The skill uses a local reference image:

```
assets/clawra.png
```

## When to Use

- User says "send a pic", "send me a pic", "send a photo", "send a selfie"
- User says "send a pic of you...", "send a selfie of you..."
- User asks "what are you doing?", "how are you doing?", "where are you?"
- User describes a context: "send a pic wearing...", "send a pic at..."
- User wants Clawra to appear in a specific outfit, location, or situation

## Quick Reference

### Required Environment Variables

```bash
OPENCLAW_GATEWAY_TOKEN=your_token  # From: openclaw doctor --generate-gateway-token
```

### Workflow

1. **Get user prompt** for how to edit the image
2. **Edit image** via local Stable Diffusion API with fixed reference
3. **Save generated image** to local filesystem
4. **Send to OpenClaw** with target channel(s)

## Step-by-Step Instructions

### Step 1: Collect User Input

Ask the user for:
- **User context**: What should the person in the image be doing/wearing/where?
- **Target channel(s)**: Where should it be sent? (e.g., `#general`, `@username`, channel ID)
- **Platform** (optional): Which platform? (discord, telegram, whatsapp, slack)

### Step 2: Edit Image with Local Stable Diffusion

Use the local Stable Diffusion API to edit the reference image:

```bash
# Local reference image
REFERENCE_IMAGE="assets/clawra.png"

# User prompt
PROMPT="red clothes,add_detail"

# LoRA models
LORA_LIST="<lora:ip-adapter-faceid-plusv2_sd15_lora:0.8><lora:add_detail:0.9>"

# Build JSON payload
JSON_PAYLOAD=$(jq -n \
  --arg prompt "$PROMPT$LORA_LIST" \
  '{init_images: ["base64_encoded_image"], prompt: $prompt, steps: 25, denoising_strength: 0.8, cfg_scale: 7, width: 512, height: 768}')

# Call local Stable Diffusion API
curl -X POST "http://127.0.0.1:7860/sdapi/v1/img2img" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD"
```

### Step 3: Send Image via OpenClaw

Use the OpenClaw messaging API to send the edited image:

```bash
openclaw message send \
  --action send \
  --channel "<TARGET_CHANNEL>" \
  --message "<CAPTION_TEXT>" \
  --media "<IMAGE_PATH>"
```

**Alternative: Direct API call**
```bash
curl -X POST "http://localhost:18789/message" \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "send",
    "channel": "<TARGET_CHANNEL>",
    "message": "<CAPTION_TEXT>",
    "media": "<IMAGE_PATH>"
  }'
```

## Node.js/TypeScript Implementation

### Stable Diffusion img2img Integration

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Types
interface Img2ImgInput {
  
  text_prompt: string;
  loraList: string;
  denoisingStrength: number;
  localPythonExePath: string;
  gifImageNum: number;
  seed: number;
  tileweight?: number;
  inpaintweight?: number;
  channel?: string;
}

interface StableDiffusionResponse {
  images: string[];
  parameters: any;
  info: string;
}

interface OpenClawMessage {
  action: "send";
  channel: string;
  message: string;
  media?: string;
}

/**
 * Encode image to base64
 */
async function encodeImageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = fs.readFileSync(imagePath);
  return imageBuffer.toString('base64');
}

/**
 * Submit POST request to API
 */
async function submitPost(url: string, data: any): Promise<StableDiffusionResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${error}`);
  }

  return response.json();
}

/**
 * Save base64 encoded image to file
 */
function saveEncodedImage(b64Image: string, outputPath: string): void {
  const imageBuffer = Buffer.from(b64Image, 'base64');
  // Ensure directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, imageBuffer);
}

/**
 * Send image via OpenClaw
 */
async function sendViaOpenClaw(message: OpenClawMessage, useCLI: boolean = true): Promise<void> {
  if (useCLI) {
    // Use OpenClaw CLI
    const cmd = `openclaw message send --action send --channel "${message.channel}" --message "${message.message}" --media "${message.media}"`;
    await execAsync(cmd);
    return;
  }

  // Direct API call
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
  const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (gatewayToken) {
    headers['Authorization'] = `Bearer ${gatewayToken}`;
  }

  const response = await fetch(`${gatewayUrl}/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenClaw send failed: ${error}`);
  }
}

/**
 * Join LoRA models list
 */
function joinLoraList(loraName01: string, weight01: number, loraName02: string, weight02: number, loraName03: string, weight03: number): string {
  const loraPart01 = loraName01 ? `<lora:${loraName01}:${weight01.toFixed(1)}>` : '';
  const loraPart02 = loraName02 ? `<lora:${loraName02}:${weight02.toFixed(1)}>` : '';
  const loraPart03 = loraName03 ? `<lora:${loraName03}:${weight03.toFixed(1)}>` : '';
  
  const loraList = loraPart01 + loraPart02 + loraPart03;
  console.log(loraList);
  return loraList;
}

/**
 * Get image from image using Stable Diffusion
 */
async function getImage2Image(input: Img2ImgInput): Promise<string> {
  const { text_prompt, loraList, denoisingStrength, localPythonExePath, gifImageNum, seed, tileweight = 0.1, inpaintweight = 0.1, channel } = input;
  
  const localFilePath = path.join('D:', 'SDM', 'sendReq2DB', 'Frames', `${gifImageNum}.jpg`);
  
  const promptImagePath = path.join(localPythonExePath, 'prompt_image', 'openpose.jpg');
  
  if (!fs.existsSync(promptImagePath)) {
    throw new Error(`Prompt image not found: ${promptImagePath}`);
  }
  
  const promptimage_temp_code = await encodeImageToBase64(promptImagePath);
  
  const image2Image_url = 'http://127.0.0.1:7860/sdapi/v1/img2img';
  
  const data = {
    "init_images": [promptimage_temp_code],
    "prompt": text_prompt + loraList,
    "batch_size": 1,
    "steps": 25,
    "denoising_strength": denoisingStrength,
    "cfg_scale": 7,
    "width": 512,
    "height": 768,
    "seed": seed,
    "restore_faces": true,
    "negative_prompt": "nsfw,blurry,bad anatomy,low quality,worst quality,normal quality",
    "alwayson_scripts": {
      "ControlNet": {
        "args": [
          {
            "enabled": true,
            "pixel_perfect": true,
            "module": "ip-adapter_face_id_plus",
            "model": "ip-adapter-faceid-plusv2_sd15",
            "weight": 1,
            "image": promptimage_temp_code
          }
        ]
      }
    }
  };
  
  console.log('Sending request to Stable Diffusion API...');
  const response = await submitPost(image2Image_url, data);
  
  const output_dir = 'FramesNew';
  if (!fs.existsSync(output_dir)) {
    fs.mkdirSync(output_dir, { recursive: true });
  }
  
  const output_path = path.join(output_dir, `${gifImageNum}.png`);
  saveEncodedImage(response.images[0], output_path);
  
  console.log(`图片已经生成，并保存在 ${output_path} 中`);
  
  // Send via OpenClaw if channel is provided
  if (channel) {
    console.log(`Sending image to channel: ${channel}`);
    await sendViaOpenClaw({
      action: "send",
      channel: channel,
      message: `Generated image: ${text_prompt}`,
      media: output_path
    });
    console.log(`Image sent to ${channel}`);
  }
  
  return output_path;
}

// Usage Example
async function example() {
  const result = await getImage2Image({
    text_prompt: "red clothes,((sports bar)),add_detail",
    loraList: joinLoraList("ip-adapter-faceid-plusv2_sd15_lora", 0.8, "add_detail", 0.9, "", 1.0),
    denoisingStrength: 0.8,
    localPythonExePath: "D:\\SDM\\sendReq2DB",
    gifImageNum: 0,
    seed: 12345,
    channel: "#general"
  });
  console.log(`Result: ${result}`);
}

example();
```

### Usage

```bash
# Basic usage
npx ts-node scripts/txt2img.ts "red clothes,((sports bar)),add_detail" "ip-adapter-faceid-plusv2_sd15_lora" 0.8 "add_detail" 0.9 "" 1.0 0.8 "D:\\SDM\\sendReq2DB" 0

# With seed and channel
npx ts-node scripts/txt2img.ts "red clothes,((sports bar)),add_detail" "ip-adapter-faceid-plusv2_sd15_lora" 0.8 "add_detail" 0.9 "" 1.0 0.8 "D:\\SDM\\sendReq2DB" 0 12345 #general
```

### Required Files

- `prompt_image/openpose.jpg` - Reference image for img2img
- Stable Diffusion WebUI running on `http://127.0.0.1:7860`
- ControlNet extension with `ip-adapter-faceid-plusv2_sd15` model

## Supported Platforms

OpenClaw supports sending to:

| Platform | Channel Format | Example |
|----------|----------------|---------|
| Discord | `#channel-name` or channel ID | `#general`, `123456789` |
| Telegram | `@username` or chat ID | `@mychannel`, `-100123456` |
| WhatsApp | Phone number (JID format) | `1234567890@s.whatsapp.net` |
| Slack | `#channel-name` | `#random` |
| Signal | Phone number | `+1234567890` |
| MS Teams | Channel reference | (varies) |

## Grok Imagine Edit Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `image_url` | string | required | URL of image to edit (fixed in this skill) |
| `prompt` | string | required | Edit instruction |
| `num_images` | 1-4 | 1 | Number of images to generate |
| `output_format` | enum | "jpeg" | jpeg, png, webp |

## Setup Requirements

### 1. Install fal.ai client (for Node.js usage)
```bash
npm install @fal-ai/client
```

### 2. Install OpenClaw CLI
```bash
npm install -g openclaw
```

### 3. Configure OpenClaw Gateway
```bash
openclaw config set gateway.mode=local
openclaw doctor --generate-gateway-token
```

### 4. Start OpenClaw Gateway
```bash
openclaw gateway start
```

## Error Handling

- **FAL_KEY missing**: Ensure the API key is set in environment
- **Image edit failed**: Check prompt content and API quota
- **OpenClaw send failed**: Verify gateway is running and channel exists
- **Rate limits**: fal.ai has rate limits; implement retry logic if needed

## Tips

1. **Mirror mode context examples** (outfit focus):
   - "wearing a santa hat"
   - "in a business suit"
   - "wearing a summer dress"
   - "in streetwear fashion"

2. **Direct mode context examples** (location/portrait focus):
   - "a cozy cafe with warm lighting"
   - "a sunny beach at sunset"
   - "a busy city street at night"
   - "a peaceful park in autumn"

3. **Mode selection**: Let auto-detect work, or explicitly specify for control
4. **Batch sending**: Edit once, send to multiple channels
5. **Scheduling**: Combine with OpenClaw scheduler for automated posts
