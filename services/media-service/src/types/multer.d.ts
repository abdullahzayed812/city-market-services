declare module "multer" {
  import type { RequestHandler } from "express";

  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
  }

  interface Options {
    storage?: object;
    fileFilter?: (
      req: object,
      file: File,
      cb: (error: Error | null, acceptFile?: boolean) => void,
    ) => void;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
    };
  }

  interface MulterHandler {
    single(fieldname: string): RequestHandler;
    array(fieldname: string, maxCount?: number): RequestHandler;
    any(): RequestHandler;
  }

  interface MulterStatic {
    (options?: Options): MulterHandler;
    memoryStorage(): object;
  }

  const multer: MulterStatic;
  export default multer;
}

declare namespace Express {
  interface Request {
    file?: import("multer").File;
  }
}
