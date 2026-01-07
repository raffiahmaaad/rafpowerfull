/**
 * iLoveAPI Service Module
 * Handles JWT authentication and PDF processing via iLoveAPI
 */

// Base64 URL encoding for JWT
function base64UrlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Create JWT token for iLoveAPI authentication
export async function createJWT(publicKey: string, secretKey: string): Promise<string> {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: publicKey, // iLoveAPI requires the public key as issuer
    iat: now,
    nbf: now,
    exp: now + 7200, // 2 hours expiry
    jti: crypto.randomUUID()
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const message = `${headerB64}.${payloadB64}`;

  // Create HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const signatureB64 = base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );

  return `${message}.${signatureB64}`;
}

// iLoveAPI base URLs
const ILOVEAPI_PDF_BASE = 'https://api.ilovepdf.com/v1';
const ILOVEAPI_IMG_BASE = 'https://api.iloveimg.com/v1';

interface TaskStartResponse {
  server: string;
  task: string;
}

interface UploadResponse {
  server_filename: string;
}

interface ProcessResponse {
  download_filename: string;
  filesize: number;
  output_filesize: number;
  output_filenumber: number;
  output_extensions: string[];
  timer: string;
  status: string;
}

// PDF Tool types supported by iLovePDF API
export type ILovePDFTool = 
  | 'compress'
  | 'unlock'
  | 'protect'
  | 'officepdf'
  | 'pdfjpg'
  | 'imagepdf'
  | 'merge'
  | 'split'
  | 'rotate'
  | 'watermark'
  | 'pagenumber'
  | 'extract'
  | 'repair'
  | 'htmlpdf'
  | 'pdfocr'
  | 'pdfa';

// Image Tool types supported by iLoveIMG API
export type ILoveIMGTool =
  | 'compressimage'
  | 'resizeimage'
  | 'cropimage'
  | 'convertimage'
  | 'rotateimage'
  | 'watermarkimage'
  | 'upscaleimage'
  | 'removebackgroundimage'
  | 'repairimage'
  | 'blurface'
  | 'htmlimage';

// Combined tool type
export type ILoveAPITool = ILovePDFTool | ILoveIMGTool;

export interface ILoveAPIOptions {
  publicKey: string;
  secretKey: string;
}

export class ILoveAPIService {
  private publicKey: string;
  private secretKey: string;
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(options: ILoveAPIOptions) {
    this.publicKey = options.publicKey;
    this.secretKey = options.secretKey;
  }

  // Get the correct base URL for a tool
  private getBaseUrl(tool?: ILoveAPITool): string {
    if (!tool) return ILOVEAPI_PDF_BASE; // Default to PDF
    const imgTools: ILoveIMGTool[] = [
      'compressimage', 'resizeimage', 'cropimage', 'convertimage',
      'rotateimage', 'watermarkimage', 'upscaleimage', 'removebackgroundimage',
      'repairimage', 'blurface', 'htmlimage'
    ];
    return (imgTools as string[]).includes(tool) ? ILOVEAPI_IMG_BASE : ILOVEAPI_PDF_BASE;
  }

  // Get or create token via /auth endpoint
  private async getToken(tool?: ILoveAPITool): Promise<string> {
    // Check if token is still valid (with 5 min buffer)
    const now = Date.now();
    if (this.token && this.tokenExpiry > now + 300000) {
      return this.token;
    }

    // Request new token from iLoveAPI auth server
    const baseUrl = this.getBaseUrl(tool);
    const response = await fetch(`${baseUrl}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        public_key: this.publicKey
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Auth failed: ${error}`);
    }

    const data = await response.json() as { token: string };
    this.token = data.token;
    this.tokenExpiry = now + 7200000; // 2 hours
    
    return this.token;
  }

  // Start a new task
  async startTask(tool: ILoveAPITool): Promise<TaskStartResponse> {
    const token = await this.getToken(tool);
    const baseUrl = this.getBaseUrl(tool);
    
    const response = await fetch(`${baseUrl}/start/${tool}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start task: ${error}`);
    }

    return response.json();
  }

  // Upload file to task
  async uploadFile(
    server: string,
    task: string,
    file: ArrayBuffer,
    filename: string
  ): Promise<UploadResponse> {
    const token = await this.getToken();
    
    const formData = new FormData();
    formData.append('task', task);
    formData.append('file', new Blob([file]), filename);

    const response = await fetch(`https://${server}/v1/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to upload file: ${error}`);
    }

    return response.json();
  }

  // Process the task with specific parameters
  async processTask(
    server: string,
    task: string,
    tool: ILoveAPITool,
    files: Array<{ server_filename: string; filename: string }>,
    params: Record<string, any> = {}
  ): Promise<ProcessResponse> {
    const token = await this.getToken();

    const body: Record<string, any> = {
      task,
      tool,
      files,
      ...params
    };

    const response = await fetch(`https://${server}/v1/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to process task: ${error}`);
    }

    return response.json();
  }

  // Download the processed file
  async downloadFile(server: string, task: string): Promise<ArrayBuffer> {
    const token = await this.getToken();

    const response = await fetch(`https://${server}/v1/download/${task}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to download file: ${error}`);
    }

    return response.arrayBuffer();
  }

  // High-level helper: Complete PDF processing workflow
  async processPDF(
    tool: ILoveAPITool,
    file: ArrayBuffer,
    filename: string,
    params: Record<string, any> = {}
  ): Promise<{ data: ArrayBuffer; filename: string; originalSize: number; outputSize: number }> {
    // 1. Start task
    const { server, task } = await this.startTask(tool);

    // 2. Upload file
    const { server_filename } = await this.uploadFile(server, task, file, filename);

    // 3. Process
    const processResult = await this.processTask(
      server,
      task,
      tool,
      [{ server_filename, filename }],
      params
    );

    // 4. Download
    const data = await this.downloadFile(server, task);

    return {
      data,
      filename: processResult.download_filename,
      originalSize: processResult.filesize,
      outputSize: processResult.output_filesize
    };
  }

  // Compress PDF
  async compressPDF(
    file: ArrayBuffer,
    filename: string,
    level: 'extreme' | 'recommended' | 'low' = 'recommended'
  ) {
    return this.processPDF('compress', file, filename, {
      compression_level: level
    });
  }

  // Unlock PDF
  async unlockPDF(file: ArrayBuffer, filename: string, password?: string) {
    const params: Record<string, any> = {};
    if (password) {
      params.password = password;
    }
    return this.processPDF('unlock', file, filename, params);
  }

  // Protect PDF
  async protectPDF(file: ArrayBuffer, filename: string, password: string) {
    return this.processPDF('protect', file, filename, {
      password
    });
  }

  // Office to PDF (Word, Excel, PowerPoint)
  async officeToPDF(file: ArrayBuffer, filename: string) {
    return this.processPDF('officepdf', file, filename);
  }

  // PDF to JPG
  async pdfToJPG(file: ArrayBuffer, filename: string, mode: 'pages' | 'extract' = 'pages') {
    return this.processPDF('pdfjpg', file, filename, {
      pdfjpg_mode: mode
    });
  }

  // HTML to PDF
  async htmlToPDF(file: ArrayBuffer, filename: string) {
    return this.processPDF('htmlpdf', file, filename);
  }

  // Rotate PDF
  async rotatePDF(file: ArrayBuffer, filename: string, rotation: 0 | 90 | 180 | 270) {
    return this.processPDF('rotate', file, filename, {
      rotation
    });
  }

  // Add watermark
  async watermarkPDF(
    file: ArrayBuffer,
    filename: string,
    options: {
      mode?: 'text' | 'image';
      text?: string;
      pages?: string;
      vertical_position?: 'bottom' | 'middle' | 'top';
      horizontal_position?: 'left' | 'center' | 'right';
      mosaic?: boolean;
      rotation?: number;
      font_family?: string;
      font_size?: number;
      font_color?: string;
      transparency?: number;
      layer?: 'above' | 'below';
    }
  ) {
    return this.processPDF('watermark', file, filename, options);
  }

  // Add page numbers
  async pageNumbersPDF(
    file: ArrayBuffer,
    filename: string,
    options: {
      facing_pages?: boolean;
      first_cover?: boolean;
      pages?: string;
      starting_number?: number;
      vertical_position?: 'bottom' | 'top';
      horizontal_position?: 'left' | 'center' | 'right';
      font_family?: string;
      font_size?: number;
      font_color?: string;
    }
  ) {
    return this.processPDF('pagenumber', file, filename, options);
  }

  // Split PDF
  async splitPDF(
    file: ArrayBuffer,
    filename: string,
    options: {
      split_mode?: 'ranges' | 'fixed_range' | 'remove_pages';
      ranges?: string;
      fixed_range?: number;
      remove_pages?: string;
      merge_after?: boolean;
    }
  ) {
    return this.processPDF('split', file, filename, options);
  }

  // Merge multiple PDFs
  async mergePDFs(
    server: string,
    task: string,
    files: Array<{ server_filename: string; filename: string }>
  ): Promise<{ data: ArrayBuffer; filename: string }> {
    const token = await this.getToken();

    // Process merge
    const processResult = await this.processTask(server, task, 'merge', files);

    // Download
    const data = await this.downloadFile(server, task);

    return {
      data,
      filename: processResult.download_filename
    };
  }

  // Repair PDF
  async repairPDF(file: ArrayBuffer, filename: string) {
    return this.processPDF('repair', file, filename);
  }

  // ============================================
  // iLoveIMG Methods
  // ============================================

  // Helper for image processing workflow
  async processImage(
    tool: ILoveIMGTool,
    file: ArrayBuffer,
    filename: string,
    params: Record<string, any> = {}
  ): Promise<{ data: ArrayBuffer; filename: string; originalSize: number; outputSize: number }> {
    // 1. Start task
    const { server, task } = await this.startTask(tool);

    // 2. Upload file
    const { server_filename } = await this.uploadFile(server, task, file, filename);

    // 3. Process
    const processResult = await this.processTask(
      server,
      task,
      tool,
      [{ server_filename, filename }],
      params
    );

    // 4. Download
    const data = await this.downloadFile(server, task);

    return {
      data,
      filename: processResult.download_filename,
      originalSize: processResult.filesize,
      outputSize: processResult.output_filesize
    };
  }

  // Compress Image
  async compressImage(file: ArrayBuffer, filename: string) {
    return this.processImage('compressimage', file, filename);
  }

  // Resize Image
  async resizeImage(
    file: ArrayBuffer,
    filename: string,
    options: {
      resize_mode?: 'pixels' | 'percentage';
      pixels_width?: number;
      pixels_height?: number;
      percentage?: number;
      maintain_ratio?: boolean;
    }
  ) {
    return this.processImage('resizeimage', file, filename, options);
  }

  // Crop Image
  async cropImage(
    file: ArrayBuffer,
    filename: string,
    options: {
      x?: number;
      y?: number;
      width: number;
      height: number;
    }
  ) {
    return this.processImage('cropimage', file, filename, options);
  }

  // Convert Image format
  async convertImage(
    file: ArrayBuffer,
    filename: string,
    options: {
      to?: 'jpg' | 'png' | 'gif' | 'webp';
    }
  ) {
    return this.processImage('convertimage', file, filename, options);
  }

  // Rotate Image
  async rotateImage(
    file: ArrayBuffer,
    filename: string,
    options: {
      rotation?: 0 | 90 | 180 | 270;
    }
  ) {
    return this.processImage('rotateimage', file, filename, options);
  }

  // Watermark Image
  async watermarkImage(
    file: ArrayBuffer,
    filename: string,
    options: {
      mode?: 'text' | 'image';
      text?: string;
      font_family?: string;
      font_size?: number;
      font_color?: string;
      transparency?: number;
      vertical_position?: 'bottom' | 'middle' | 'top';
      horizontal_position?: 'left' | 'center' | 'right';
      mosaic?: boolean;
      rotation?: number;
    }
  ) {
    return this.processImage('watermarkimage', file, filename, options);
  }

  // Upscale Image
  async upscaleImage(
    file: ArrayBuffer,
    filename: string,
    options: {
      scale?: 2 | 4;
    } = { scale: 2 }
  ) {
    return this.processImage('upscaleimage', file, filename, options);
  }

  // Remove Background
  async removeBackground(file: ArrayBuffer, filename: string) {
    return this.processImage('removebackgroundimage', file, filename);
  }

  // Blur Face
  async blurFace(
    file: ArrayBuffer,
    filename: string,
    options: {
      blur_power?: number; // 1-100
    } = { blur_power: 50 }
  ) {
    return this.processImage('blurface', file, filename, options);
  }

  // Repair Image
  async repairImage(file: ArrayBuffer, filename: string) {
    return this.processImage('repairimage', file, filename);
  }
}

// Helper function to create service instance
export function createILoveAPIService(publicKey: string, secretKey: string): ILoveAPIService {
  return new ILoveAPIService({ publicKey, secretKey });
}
