/**
 * Cloud Storage Utility
 * Supports: Local, AWS S3, Cloudinary
 * 
 * Set STORAGE_TYPE in .env: 'local', 's3', or 'cloudinary'
 */

const path = require('path');
const fs = require('fs');

// Storage type from environment
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

/**
 * AWS S3 Configuration (if using S3)
 */
let s3Client = null;
if (STORAGE_TYPE === 's3') {
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
}

/**
 * Cloudinary Configuration (if using Cloudinary)
 */
let cloudinary = null;
if (STORAGE_TYPE === 'cloudinary') {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

/**
 * Upload file to storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Filename
 * @param {string} folder - Folder path (e.g., 'profiles')
 * @returns {Promise<string>} - URL of uploaded file
 */
async function uploadFile(fileBuffer, filename, folder = 'uploads') {
  switch (STORAGE_TYPE) {
    case 's3':
      return uploadToS3(fileBuffer, filename, folder);
    case 'cloudinary':
      return uploadToCloudinary(fileBuffer, filename, folder);
    default:
      return uploadToLocal(fileBuffer, filename, folder);
  }
}

/**
 * Delete file from storage
 * @param {string} fileUrl - URL or path of file to delete
 */
async function deleteFile(fileUrl) {
  switch (STORAGE_TYPE) {
    case 's3':
      return deleteFromS3(fileUrl);
    case 'cloudinary':
      return deleteFromCloudinary(fileUrl);
    default:
      return deleteFromLocal(fileUrl);
  }
}

// ============ LOCAL STORAGE ============
async function uploadToLocal(fileBuffer, filename, folder) {
  const uploadDir = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '..', 'uploads', folder)
    : path.join(__dirname, '..', '..', 'uploads', folder);
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, fileBuffer);
  
  return `/uploads/${folder}/${filename}`;
}

async function deleteFromLocal(fileUrl) {
  const uploadsBase = process.env.NODE_ENV === 'production'
    ? path.join(__dirname, '..')
    : path.join(__dirname, '..', '..');
  const filePath = path.join(uploadsBase, fileUrl);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// ============ AWS S3 STORAGE ============
async function uploadToS3(fileBuffer, filename, folder) {
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const key = `${folder}/${filename}`;
  
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: getContentType(filename)
  }));
  
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

async function deleteFromS3(fileUrl) {
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const key = fileUrl.split('.amazonaws.com/')[1];
  
  if (key) {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    }));
  }
}

// ============ CLOUDINARY STORAGE ============
async function uploadToCloudinary(fileBuffer, filename, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `mralo/${folder}`,
        public_id: filename.split('.')[0],
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    
    uploadStream.end(fileBuffer);
  });
}

async function deleteFromCloudinary(fileUrl) {
  // Extract public_id from URL
  const parts = fileUrl.split('/');
  const publicId = parts.slice(-2).join('/').split('.')[0];
  
  await cloudinary.uploader.destroy(publicId);
}

// ============ HELPERS ============
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf'
  };
  return types[ext] || 'application/octet-stream';
}

module.exports = {
  uploadFile,
  deleteFile,
  STORAGE_TYPE
};
