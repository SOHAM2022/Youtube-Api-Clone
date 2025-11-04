import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();



app.use(cors({
    origin : process.env.CORS_ORIGIN,
    credentials:true
}));

app.use(express.json({limit:"16kb"})); // getting data from body
app.use(express.urlencoded({extended:true,limit:"16kb"})); // getting data from url 
app.use(express.static("public")); // serving static files 
app.use(cookieParser()); // for parsing cookies


// routes 
import userRoutes from "./routes/user.routes.js";


// routes declaration 
app.use('/api/v1/users',userRoutes);

export default app;