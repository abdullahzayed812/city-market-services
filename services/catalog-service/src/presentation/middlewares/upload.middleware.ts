import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const uploadDir = path.join(process.cwd(), "uploads", "products");

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = randomUUID();
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const fileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. Only JPEG, PNG and WEBP are allowed."), false);
    }
};

export const uploadProductImage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
});

const categoryIconDir = path.join(process.cwd(), "uploads", "categories", "icons");

if (!fs.existsSync(categoryIconDir)) {
    fs.mkdirSync(categoryIconDir, { recursive: true });
}

const categoryIconStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, categoryIconDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = randomUUID();
        cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    },
});

const categoryIconFileFilter = (req: any, file: any, cb: any) => {
    const allowedTypes = ["image/svg+xml", "image/png", "image/jpeg", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Invalid file type. SVG, PNG and JPEG are allowed."), false);
    }
};

export const uploadCategoryIcon = multer({
    storage: categoryIconStorage,
    fileFilter: categoryIconFileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
    },
});
