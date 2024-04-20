"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var server_exports = {};
__export(server_exports, {
  app: () => app
});
module.exports = __toCommonJS(server_exports);
var import_h33 = require("h3");

// routes/index.ts
var import_h3 = require("h3");

// utils/readFiles.ts
var import_formidable = __toESM(require("formidable"), 1);
async function readFiles(event, options) {
  const form = (0, import_formidable.default)(options);
  try {
    const [fields, files] = await form.parse(event.node.req);
    return {
      success: true,
      files: files.file ?? null
    };
  } catch (err) {
    return {
      files: null,
      error: {
        value: true,
        payload: err
      }
    };
  }
}

// routes/index.ts
var import_config2 = require("dotenv/config");

// models/api-keys.ts
var import_mongoose2 = __toESM(require("mongoose"), 1);

// utils/db.ts
var import_mongoose = __toESM(require("mongoose"), 1);
var import_config = require("dotenv/config");
var connectToDb = async () => {
  try {
    await import_mongoose.default.connect(process.env.MONGOOSE_URI, { dbName: "Uploadflare" });
    console.log("Connected");
  } catch (e) {
    console.log(e);
  }
};

// models/api-keys.ts
var { Schema } = import_mongoose2.default;
connectToDb();
var KeySchema = new Schema(
  {
    value: { type: String, unique: true, required: true },
    user_id: import_mongoose2.default.Types.ObjectId,
    active: Boolean
  },
  { timestamps: true }
);
var KeyModel = () => import_mongoose2.default.model("api-keys", KeySchema);
var Key = import_mongoose2.default.models["api-keys"] || KeyModel();

// utils/randomvalue.ts
function generateRandomInteger(max) {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  if (bytes[0] < max) {
    return bytes[0];
  }
  return generateRandomInteger(max);
}
function generateRandomString(length, alphabet = "0123456789abcdefghijklmnopqrstuvwxyz") {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += alphabet[generateRandomInteger(alphabet.length)];
  }
  return "ufl_" + result;
}

// utils/uploadToR2.ts
var import_client_s32 = require("@aws-sdk/client-s3");

// utils/s3.ts
var import_client_s3 = require("@aws-sdk/client-s3");
var { ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY } = process.env;
var S3 = new import_client_s3.S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY
  }
});

// utils/uploadToR2.ts
var import_node_fs = require("fs");
async function UploadToR2({
  file,
  bucket,
  image
}) {
  const body = (0, import_node_fs.readFileSync)(file.filepath);
  const params = {
    Bucket: bucket,
    Key: file.originalFilename,
    ContentLength: (0, import_node_fs.statSync)(file.filepath).size,
    Body: body,
    ContentType: file.mimetype,
    ContentDisposition: image ? `inline; filename=${file.originalFilename}` : void 0,
    ACL: "public-read"
  };
  const command = new import_client_s32.PutObjectCommand(params);
  S3.send(command).then(() => {
    return { error: false, payload: params.Key };
  }).catch((err) => {
    return { error: true, payload: err };
  });
}

// routes/index.ts
var UFLRouter = (0, import_h3.createRouter)();
UFLRouter.post(
  "/api-key",
  (0, import_h3.defineEventHandler)(async (event) => {
    const res = await (0, import_h3.readBody)(event);
    if (!res.user_id || typeof res.user_id !== "string") {
      throw (0, import_h3.createError)({
        status: 400,
        message: "No user ID provided or bad format",
        statusMessage: "No user ID provided or bad format"
      });
    }
    try {
      await Key.create({ value: generateRandomString(28), user_id: res.user_id });
      (0, import_h3.setResponseStatus)(event, 201, "Created API key successfully");
      return {
        success: true,
        message: "Created API key successfully"
      };
    } catch (e) {
      throw (0, import_h3.createError)({
        status: 500,
        message: "Could not create api key",
        statusMessage: "Could not create api key"
      });
    }
  })
);
UFLRouter.get(
  "/upload",
  (0, import_h3.defineEventHandler)(() => {
    return `
        <html>
        <body>
        <form method="POST" encType="multipart/form-data"> <input type="file" name="file" multiple /> <button type="submit">Submit file</button> <form/>
        <body />
        <html/>
        `;
  })
);
UFLRouter.post(
  "/upload",
  (0, import_h3.defineEventHandler)(async (event) => {
    const data = await readFiles(event);
    if (!data.files) {
      (0, import_h3.setResponseStatus)(event, 404, "No files found");
      return `${event.node.res.statusCode} No files in this dunya`;
    } else {
      try {
        const uploadedFiles = data.files.map(async (file) => {
          await UploadToR2({ file, bucket: "root", image: true });
        });
        (0, import_h3.setResponseStatus)(event, 200, "Files uploaded successfully");
        return "Files Uploaded";
      } catch (e) {
        (0, import_h3.setResponseStatus)(event, 500, "Error uploading files");
        return { payload: e.message, message: "Error uploading files" };
      }
    }
  })
);
UFLRouter.get(
  "/",
  (0, import_h3.defineEventHandler)((event) => {
    if (event.context.user) {
      return event.context.user._doc.name;
    }
    return "Bye";
  })
);

// utils/apiKeyAuth.ts
var import_h32 = require("h3");

// models/user.ts
var import_mongoose4 = __toESM(require("mongoose"), 1);

// models/Plan.ts
var import_mongoose3 = __toESM(require("mongoose"), 1);
var { Schema: Schema2 } = import_mongoose3.default;
var planSchema = new Schema2({
  active: Boolean,
  plan_type: {
    type: String,
    enum: ["Trial", "Tier 1", "Tier 2"]
  },
  totalStorage: Number,
  storageCap: Number,
  paid: { type: Boolean, default: false }
});

// models/user.ts
var { Schema: Schema3 } = import_mongoose4.default;
var userSchema = new Schema3({
  firstName: String,
  lastName: String,
  githubUserName: String,
  email: String,
  plan: planSchema
});
var UserModel = () => import_mongoose4.default.model("users", userSchema);
var User = import_mongoose4.default.models["users"] || UserModel();

// utils/apiKeyAuth.ts
async function Handler(event) {
  const apikey = (0, import_h32.getRequestHeader)(event, "api-key");
  if (!apikey) {
    throw (0, import_h32.createError)({
      statusCode: 401,
      statusMessage: "No API key provided"
    });
  }
  const existingKey = await Key.findOne({ value: apikey });
  if (!existingKey) {
    throw (0, import_h32.createError)({
      statusCode: 401,
      statusMessage: "Invalid API key"
    });
  }
  if (!event.context.key && !event.context.user) {
    const user = await User.findById(existingKey.user_id).exec();
    event.context.key = existingKey;
    event.context.user = user;
  }
}

// index.ts
var app = (0, import_h33.createApp)({
  onRequest: Handler
});
app.use(UFLRouter);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app
});
//# sourceMappingURL=index.cjs.map