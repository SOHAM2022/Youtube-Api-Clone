import dotenv from "dotenv";
import mongoose from "mongoose";
import { DB_NAME } from "./constants.js";
import express from "express";
import connectDB from "./db/db.js";
import app from "./app.js";


dotenv.config({
    path:"./.env"
});

connectDB()
.then(()=>{
    app.on("error",(err)=>{
        console.log("error",err);
        throw err;
    })

    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running on port ${process.env.PORT}`);
    })
})
.catch((err)=>{
    console.log("error",err);
    throw err;
})


/*
const app = express();

;( async () =>{
    try{
        await mongoose.connect(`${process.env.MONGO_URL}/${DB_NAME}`)
        app.on("error",(err)=>{
            console.log("error",err);
            throw err;
        })

        app.listen(process.env.PORT,()=>{
            console.log(`Server is running on port ${process.env.PORT}`);
        })

    }catch(err){
        console.log("error",err);
        throw err;
    }
})()

*/