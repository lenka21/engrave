import * as express from "express";
import generate from "./routes/generate";

const configurationApi: express.Router = express.Router();

configurationApi.get('/generate', generate.middleware, generate.handler);

export default configurationApi;