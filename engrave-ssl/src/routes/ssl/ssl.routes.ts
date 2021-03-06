import * as express from "express";
import validate from "./routes/validate";
import generate from "./routes/generate";

const healthApi: express.Router = express.Router();

healthApi.post('/validate', validate.middleware, validate.handler);
healthApi.post('/generate', generate.middleware, generate.handler);

export default healthApi;