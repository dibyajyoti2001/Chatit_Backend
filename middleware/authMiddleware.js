// import jwt from 'jsonwebtoken';
// import response from '../utils/responseHandler.js';

// const authMiddleware = async (req, res, next) => {

//     const authToken = req.cookies?.auth_token;
//     console.log(authToken)

//     if (!authToken) {
//         return response(res, 401, 'Authorization Token Missing. Access Denied!')
//     }

//     try {

//         const decode = jwt.verify(authToken, process.env.JWT_SECRET)
//         req.user = decode;
//         next();

//     } catch (error) {
//         console.log(error);
//         return response(res, 401, 'Invalid or expired token.')
//     }
// }

// export default authMiddleware;

import jwt from "jsonwebtoken";
import response from "../utils/responseHandler.js";

const authMiddleware = async (req, res, next) => {
  // First try Authorization header
  const authHeader = req.headers.authorization;
  const authToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : req.cookies?.auth_token; // fallback to cookie

  if (!authToken) {
    return response(res, 401, "Authorization Token Missing. Access Denied!");
  }

  try {
    const decode = jwt.verify(authToken, process.env.JWT_SECRET);
    req.user = decode;
    next();
  } catch (error) {
    console.log(error);
    return response(res, 401, "Invalid or expired token.");
  }
};

export default authMiddleware;
