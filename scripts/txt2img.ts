/**
 * Stable Diffusion img2img Integration
 *
 * Generates images using Stable Diffusion API via local SD WebUI
 * and supports LoRA models integration.
 *
 * Usage:
 *   npx ts-node txt2img.ts <prompt> <loraName1> <weight1> <loraName2> <weight2> <loraName3> <weight3> <denoisingStrength> <localPythonExePath> <gifImageNum> <seed> [channel]
 *
 * Environment variables:
 *   OPENCLAW_GATEWAY_TOKEN - OpenClaw gateway token (optional)
 */

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
  const { text_prompt, loraList, denoisingStrength, localPythonExePath, gifImageNum, seed, tileweight = 0.1, inpaintweight = 0.1 } = input;
  
  const localFilePath = path.join('D:', 'SDM', 'sendReq2DB', 'Frames', `${gifImageNum}.jpg`);
  
  // Use clawra.png as input image
  const promptImagePath = path.join(__dirname, '..', 'assets', 'clawra.png');
  
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
    "sd_model_checkpoint": "realisticVisionV60B1",
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
  if (input.channel) {
    console.log(`Sending image to channel: ${input.channel}`);
    await sendViaOpenClaw({
      action: "send",
      channel: input.channel,
      message: `Generated image: ${input.text_prompt}`,
      media: output_path
    });
    console.log(`Image sent to ${input.channel}`);
  }
  
  return output_path;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Simplified for testing
  if (args.length < 1) {
    console.log(`
Usage: npx ts-node txt2img.ts <prompt> [seed]`);
    console.log(`
Arguments:`);
    console.log(`  prompt    - Text prompt for image generation`);
    console.log(`  seed      - Random seed (optional)`);
    console.log(`
Example:`);
    console.log(`  npx ts-node txt2img.ts "换成红色衣服"`);
    console.log(`  npx ts-node txt2img.ts "换成红色衣服" 12345`);
    process.exit(1);
  }
  
  const [prompt, seedStr] = args;
  
  // Default values for testing
  const loraList = "";
  const denoisingStrength = 0.8;
  const localPythonExePath = ".";
  const gifImageNum = 0;
  const seed = seedStr ? parseInt(seedStr) : Math.floor(Math.random() * 10000000);
  
  try {
    const result = await getImage2Image({
      text_prompt: prompt,
      loraList,
      denoisingStrength,
      localPythonExePath,
      gifImageNum,
      seed,
      tileweight: 0.1,
      inpaintweight: 0.1
    });
    
    console.log(`\n--- Result ---`);
    console.log(`Image saved to: ${result}`);
  } catch (error) {
    console.error(`[ERROR] ${(error as Error).message}`);
    process.exit(1);
  }
}

// Export for module use
export {
  getImage2Image,
  joinLoraList,
  encodeImageToBase64,
  submitPost,
  saveEncodedImage,
  sendViaOpenClaw,
  Img2ImgInput,
  StableDiffusionResponse,
  OpenClawMessage
};

// Run if executed directly
if (require.main === module) {
  main();
}
