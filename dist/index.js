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
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  batchFetchImplementation: () => batchFetchImplementation,
  makeBatchSchedulerSignal: () => makeBatchSchedulerSignal
});
module.exports = __toCommonJS(src_exports);

// src/makeBatchFetchImplementation.ts
var import_dataloader = __toESM(require("dataloader"));
var import_node_events = require("events");

// src/makeMultipartMixedRequest/handlebarsTemplates.ts
var import_handlebars = __toESM(require("handlebars"));
var helpers = {
  inc: (x) => x + 1,
  json: JSON.stringify
};
var useBodyTemplate = (context) => import_handlebars.default.compile(
  `
{{#each requests}}
--{{../boundary}}
Content-Type: application/http
Content-ID: {{inc @index}}

{{method}} {{{path}}} HTTP/1.1
Accept: application/json
{{#each headers}}
{{@key}}: {{this}}
{{/each}}
{{#if body}}

{{{body}}}
{{/if}}


{{/each}}
{{#if requests}}
--{{boundary}}--
{{/if}}`
)(context, { helpers });
var useFullTemplate = import_handlebars.default.compile(
  `
{{method}} {{batchUrl}} HTTP/1.1
{{#each headers}}
{{@key}}: {{{this}}}
{{/each}}

{{{body}}}`
);

// src/makeMultipartMixedRequest/guessGoogleapisBatchUrl.ts
var googleapisUrl = "https://www.googleapis.com";
var guessGoogleapisBatchUrl = (url) => {
  if (url.origin === googleapisUrl) {
    const tokens = url.pathname.split("/");
    const apiName = tokens[1];
    const apiVersion = tokens[2];
    return `${googleapisUrl}/batch/${apiName}/${apiVersion}`;
  } else {
    return `${url.origin}/batch`;
  }
};

// src/makeMultipartMixedRequest/makeMultipartMixedRequestBody.ts
var toMinimalFetchRequestInfo = (req) => {
  const url = new URL(req.url);
  const batchUrl = guessGoogleapisBatchUrl(url);
  const path = url.href.substring(url.origin.length);
  const minimalRequestInfo = {
    method: req.method ?? "GET",
    body: req.body,
    headers: req.headers,
    path
  };
  return [batchUrl, minimalRequestInfo];
};
var prepareInput = (requests) => {
  const initBatchUrl = "not_a_valid_url";
  const res = {
    requests: [],
    batchUrl: initBatchUrl
  };
  for (const req of requests) {
    const [batchUrl, minimalFetchRequest] = toMinimalFetchRequestInfo(req);
    if (res.batchUrl === initBatchUrl) {
      res.batchUrl = batchUrl;
    } else if (batchUrl !== res.batchUrl) {
      throw new Error(
        `Batch requests must be for the same batching endpoint. Found ${res.batchUrl} and ${batchUrl}`
      );
    }
    res.requests = res.requests.concat(minimalFetchRequest);
  }
  return res;
};
var makeMultipartMixedRequestBody = (data) => {
  const { batchUrl, requests } = prepareInput(data.requests);
  const body = useBodyTemplate({
    requests,
    boundary: data.boundary
  });
  return { body, batchUrl };
};

// src/makeMultipartMixedRequest/makeMultipartMixedRequest.ts
var makeMultipartMixedRequest = ({
  boundary,
  requests
}) => {
  const { body, batchUrl } = makeMultipartMixedRequestBody({
    boundary,
    requests
  });
  return {
    body,
    method: "POST",
    batchUrl,
    headers: {
      "Content-Type": `multipart/mixed; boundary="${boundary}"`
    }
  };
};

// src/parseMultipartMixedResponse/parseOnePart.ts
var import_next_line = __toESM(require("next-line"));
var import_node_fetch = require("node-fetch");
var statusLineRE = /^[A-Z]+\/\d\.\d (\d{3}) (.*)$/;
var headerLineRE = /^([a-zA-Z-]+)\s*:\s*(.+)\s*$/;
var parseOnePart = (part) => {
  const getNextLine = (0, import_next_line.default)(part);
  let nextLine = null;
  let statusLine = null;
  const bodyParts = [];
  const headers = new import_node_fetch.Headers();
  do {
    nextLine = getNextLine();
    const match = nextLine?.match(statusLineRE);
    if (match != null) {
      statusLine = { code: Number(match[1]), message: match[2] };
    }
  } while (nextLine !== null && statusLine === null);
  if (statusLine === null) {
    throw new Error("Could not find a status line in this message");
  }
  let matchHeader = null;
  do {
    nextLine = getNextLine();
    matchHeader = nextLine?.match(headerLineRE) ?? null;
    if (matchHeader !== null) {
      headers.append(matchHeader[1], matchHeader[2]);
    }
  } while (nextLine !== null && matchHeader !== null);
  while (nextLine !== null) {
    bodyParts.push(nextLine);
    nextLine = getNextLine();
  }
  const body = bodyParts.length > 0 ? bodyParts.join("\n").trim() : null;
  return { statusLine, headers, body };
};
var makeFetchResponse = ({
  body,
  headers,
  statusLine
}) => {
  return new import_node_fetch.Response(body, {
    headers,
    status: statusLine.code,
    statusText: statusLine.message
  });
};

// src/parseMultipartMixedResponse/parseMultipartMixedReponse.ts
var multipartMixedBoundary = "multipart/mixed; boundary=";
var parseMultipartMixedReponse = async (rsp) => {
  const contentType = rsp.headers.get("Content-Type");
  if (typeof contentType !== "string" || !contentType.startsWith(multipartMixedBoundary)) {
    throw new Error(`Unexpected Content-Type header in response`, {
      cause: contentType
    });
  }
  const boundary = contentType.substring(multipartMixedBoundary.length).trim();
  const splitStr = `--${boundary}`;
  const endStr = `--${boundary}--`;
  const msgBody = (await rsp.text()).trim();
  if (!msgBody.startsWith(splitStr)) {
    throw new Error(
      `The body of the response does not start with the expected boundary`,
      { cause: splitStr }
    );
  }
  if (!msgBody.endsWith(endStr)) {
    throw new Error(
      `The body of the response does not end with the expected boundary`,
      { cause: endStr }
    );
  }
  return msgBody.slice(splitStr.length, msgBody.length - endStr.length).split(splitStr).map(parseOnePart).map(makeFetchResponse);
};

// src/services/nodeFetchService.ts
var import_node_fetch2 = __toESM(require("node-fetch"));
var nodeFetchService = {
  fetch: (params) => (0, import_node_fetch2.default)(params.url, params)
};

// src/services/nodeRandomStringService.ts
var nodeRandomStringService = {
  generate: () => (Math.random() + 1).toString(36).substring(2)
};

// src/logger.ts
var import_debug = __toESM(require("debug"));
var logger = (0, import_debug.default)("googleapis-batcher");

// src/makeBatchFetchImplementation.ts
var signalSymbol = Symbol("BatchSchedulerSignal");
var makeBatchSchedulerSignal = () => {
  const ee = new import_node_events.EventEmitter();
  const signal = {
    __tag: signalSymbol,
    schedule: () => {
      ee.emit("schedule");
    },
    onSchedule: (cb) => {
      ee.addListener("schedule", cb);
    }
  };
  return signal;
};
var makeBatchFetchImplementation = ({
  fetchService = nodeFetchService,
  randomStringService = nodeRandomStringService,
  options
} = {}) => {
  const dataloaderOptions = {
    cache: false
  };
  dataloaderOptions.maxBatchSize = Math.min(1e3, options?.maxBatchSize ?? 1e3);
  if (options?.signal !== void 0) {
    let callbacks = [];
    const dispatch = () => {
      callbacks.forEach((callback) => callback());
      callbacks = [];
    };
    dataloaderOptions.batchScheduleFn = (cb) => {
      callbacks.push(cb);
    };
    options.signal.onSchedule(dispatch);
  }
  if (options?.batchWindowMs !== void 0) {
    if (dataloaderOptions.batchScheduleFn !== void 0)
      throw new Error(
        "You cannot provide both batchWindowMs and signal options at the same time"
      );
    dataloaderOptions.batchScheduleFn = (cb) => {
      setTimeout(cb, options.batchWindowMs);
    };
  }
  const dataloader = new import_dataloader.default(
    async (requests) => {
      if (requests.length === 0) {
        return [];
      }
      if (requests.length === 1) {
        return [await fetchService.fetch(requests[0])];
      }
      const boundary = randomStringService.generate();
      const req = makeMultipartMixedRequest({
        boundary,
        requests
      });
      const { batchUrl, body, headers, method } = req;
      logger("Multipart request:", method, batchUrl, headers, body);
      const rsp = await fetchService.fetch({
        url: batchUrl,
        body,
        headers,
        method
      });
      return parseMultipartMixedReponse(rsp);
    },
    dataloaderOptions
  );
  return (url, params) => dataloader.load(Object.assign({}, { url }, params));
};

// src/index.ts
function batchFetchImplementation(options = {}) {
  return makeBatchFetchImplementation({ options });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  batchFetchImplementation,
  makeBatchSchedulerSignal
});
