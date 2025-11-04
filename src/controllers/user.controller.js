import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const registerUser = asyncHandler(async (req, res) => {
    // 1. get user data from req.body
    const { fullName, email, username, password } = req.body;
    console.log(req.body);
    
    // 2. validate the data - not empty 
    if (
        [fullName, email, username, password].some((field) => {
            field?.trim() === ""
        })
    ) {
        throw new ApiError(400, "All fields are required")
    }

    // 3. check if user already exists : username , email
    const userExisted = await User.findOne({
        $or:[{username},{email}]
    })
    if(userExisted){
        throw new ApiError(400,"User already exists")
    }

    // 4. check for images , check for avatar 
    console.log("req.files:", req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    let coverImageLocalPath ;
    if(req.files && Array.isArray(req.files) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    // console.log("avatarLocalPath:", avatarLocalPath);
    // console.log("coverImageLocalPath:", coverImageLocalPath);

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }

    // 5. upload them to cloudinary , avatar 

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    
    //console.log("avatar response:", avatar);
    // console.log("coverImage response:", coverImage);
    
    if(!avatar){
        throw new ApiError(500,"Error in uploading avatar image");
    }
    
    // 6. create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        username:username.toLowerCase(),
        password
    })

    // 7. remove password and refresh token field from response 
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    // 8. check for user creation
    if(!createdUser){
        throw new ApiError(500,"some error occurred while creating user");
    }

    // 9. return res 
    return res.status(201).json(new ApiResponse(200,createdUser,"User registered successfully"));

})


const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId);
        if(!user){
            throw new ApiError(404,"User not found");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({
            validateBeforeSave:false
        });

        return {accessToken,refreshToken};
    } catch (error) {
        throw new ApiError(500,"Error in generating access and refresh tokens");
    }
}


const loginUser = asyncHandler(async (req,res)=>{
    // req body -> data 
    const {email,username,password} = req.body;

    if(!(username || email)){
        throw new ApiError(400,"Username or email are required");
    }
    const user = await User.findOne({
        $or:[
            {username},{email}
        ]
    });

    if(!user){
        throw new ApiError(404,"User not found");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Invalid credentials");
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);
    // username or email 
    // find user 
    // password check 
    // access and refresh token generations 
    // send cookie 

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    const options = {
        httpOnly:true, // only accessible by server
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(200,{
        user:loggedInUser,
        accessToken,
        refreshToken
    },"User logged in successfully"
))
})


const logoutUser = asyncHandler(async (req,res)=>{

    await User.findByIdAndUpdate(req.user._id,{
        $set:{
            refreshToken:undefined
        }
    },{
        new:true
    })
    const options = {
        httpOnly:true, // only accessible by server
        secure : true
    }
    res.status(200).clearCookie("accessToken",options).clearCookie("refreshToken",options).json(new ApiResponse(200,{},"User logged out successfully"));
})


const refreshAccessToken = asyncHandler(async(req,res)=>{
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
        if(!incomingRefreshToken){
            throw new ApiError(401,"unauthorized access");
        }
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
    
        )
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"Invalid Refresh token access");
        }
        if(user.refreshAccessToken !== incomingRefreshToken){
            throw new ApiError(401,"kRefresh token is expired");
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id);
    
        const options = {
            httpOnly:true, // only accessible by server
            secure : true
        }
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(new ApiResponse(200,{
            accessToken,
            newRefreshToken,
        },"Access token refreshed successfully"))
    } catch (error) {
        throw new ApiError(500,"Error in refreshing access token");
    }
})

const changeCurrentPassword = asyncHandler(async (req,res)=>{
    const {oldPassword,newPassword} = req.body;
    
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old Password");
    }
    user.password = newPassword;
    await user.save({validateBeforeSave:false});

    return res.status(200).json(new ApiResponse(200,{},"password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body;

    if(!(fullName || email)){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName:fullName,
                email:email
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"account details updated successfully"))
})


const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path;
    if(!avatarLocalPath){
        throw new ApiError(400,"avatar file is missing");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar.url){
        throw new ApiError(400,"error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar : avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        throw new ApiError(400,"cover image file is missing");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if(!coverImage.url){
        throw new ApiError(400,"error while uploading avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage : coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"cover Image updated successfully")
    )
})

export { registerUser , loginUser,logoutUser,refreshAccessToken , changeCurrentPassword , getCurrentUser ,updateAccountDetails , updateUserAvatar , updateUserCoverImage};