import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';


cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

/*
console.log("Cloudinary Config:", {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET ? "***set***" : "***NOT SET***"
});
*/

const uploadOnCloudinary = async (filePath)=>{
    try {
        if(!filePath){
            console.log("No file path provided to uploadOnCloudinary");
            return null;
        }
        
        console.log("Attempting to upload file:", filePath);
        
        // Check if file exists
        if(!fs.existsSync(filePath)){
            console.log("File does not exist at path:", filePath);
            return null;
        }
        
        // upload file on cloudinary 
        const response = await cloudinary.uploader.upload(filePath,{
            resource_type : "auto"
        })
        // file uploaded successfully
        console.log("file is uploaded successfully on cloudinary",response.url);

        fs.unlinkSync(filePath); // delete the file from local storage after successful upload
        return response;
    } catch (error) {
        console.log("CLOUDINARY UPLOAD ERROR:", error);
        if(fs.existsSync(filePath)){
            fs.unlinkSync(filePath); // delete the file from local storage
        }
        return null;
    }
} 


export { uploadOnCloudinary }