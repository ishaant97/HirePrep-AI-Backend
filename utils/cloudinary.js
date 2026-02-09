const path = require("path");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadPdfBuffer(buffer, originalName) {
    return new Promise((resolve, reject) => {
        const baseName = originalName
            ? path.parse(originalName).name
            : "resume";
        const uniqueSuffix = Date.now().toString(36);

        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "raw",
                folder: "resumes",
                public_id: `${baseName}-${uniqueSuffix}`,
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                return resolve(result);
            }
        );

        uploadStream.end(buffer);
    });
}

module.exports = { uploadPdfBuffer };
